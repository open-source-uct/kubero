import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MetricsOptions,
  IMetric,
  IClusterUsage,
  PrometheusQuery,
  Rule,
} from './metrics.interface';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import {
  PrometheusDriver,
  //PrometheusQueryDate,
  QueryResult,
  RuleGroup,
} from 'prometheus-query';

// nombre de namespace válido: va dentro de un regex de PromQL
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

// Sin timeout, un Prometheus lento o caído deja colgadas las peticiones de
// métricas (y la vista que las espera). En la U cada consulta tarda ~150 ms.
const PROMETHEUS_TIMEOUT_MS = 5000;

// prometheus-query rechaza con un objeto plano ({ errorType, error, original })
// que como texto queda en "[object Object]". Solo se registran el tipo y el
// mensaje: `original` es el error de axios con toda su configuración. Si la
// URL del endpoint llevara usuario:contraseña@, se ocultan antes de registrar.
export function describePrometheusError(error: unknown): string {
  // también con una sola barra (http:/user:pass@host), como el error de axios
  // al recibir una URL mal escrita
  const redact = (text: string) =>
    text.replace(/([a-z][a-z0-9+.-]*:\/{1,2})[^/\s@]+@/gi, '$1***@');
  if (error instanceof Error) return redact(error.message);
  if (error && typeof error === 'object') {
    const { errorType, error: message } = error as {
      errorType?: unknown;
      error?: unknown;
    };
    if (typeof message === 'string') {
      return redact(
        typeof errorType === 'string' ? `${errorType}: ${message}` : message,
      );
    }
  }
  return typeof error === 'string' ? redact(error) : 'unknown error';
}

@Injectable()
export class MetricsService {
  private prom: PrometheusDriver;
  private status: boolean = false;

  constructor(
    //options: MetricsOptions
    private kubectl: KubernetesService,
  ) {
    //TODO: Migration -> Load options from settings or config
    const options = {
      enabled: true,
      endpoint:
        process.env.KUBERO_PROMETHEUS_ENDPOINT ||
        'http://kubero-prometheus-server',
    } as MetricsOptions;

    this.prom = new PrometheusDriver({
      endpoint: options.endpoint,
      preferPost: false,
      withCredentials: false,
      timeout: PROMETHEUS_TIMEOUT_MS,
    });

    if (!options.enabled) {
      Logger.log('☑️ Feature: Prometheus Metrics not enabled ...', 'Feature');
      this.status = false;
      return;
    }

    this.prom
      .status()
      .then(() => {
        Logger.log(
          '✅ Feature: Prometheus Metrics initialized with ' + options.endpoint,
          'Feature',
        );
        this.status = true;
      })
      .catch(() => {
        Logger.warn(
          '❌ Feature: Prometheus not accesible on ' + options.endpoint,
          'Feature',
        );
        //Logger.debug(error); // too noisiy
        this.status = false;
      });
  }

  public async getStatus(): Promise<boolean> {
    try {
      this.status = await this.prom.status();

      if (
        this.status === undefined ||
        this.status === null ||
        this.status === false
      ) {
        return false;
      } else {
        return true;
      }
    } catch {
      return false;
    }
  }

  // Uso real de CPU/memoria de Kubero en el cluster entero, separado en:
  // - apps: el contenedor kuberoapp-web/kuberoapp-worker, el único que el
  //   operador les pone a las apps (gitlab, wazuh, etc. no lo usan)
  // - addons: el resto de los contenedores de los namespaces de los pipelines
  //   (bases de datos de los addons, builds)
  // - plataforma: el panel y el operador de Kubero
  // La memoria es el working set, la misma que muestra `kubectl top` y con la
  // que Kubernetes decide qué desalojar.
  public async getClusterWideUsage(): Promise<IClusterUsage> {
    const appContainers = 'container=~"kuberoapp-web|kuberoapp-worker"';
    // sin la serie del pod completo (container="") ni la del contenedor pausa
    const realContainers = 'container!="",container!="POD"';
    const cpu = (selector: string) =>
      `sum(rate(container_cpu_usage_seconds_total{${selector}}[5m]))`;
    const memory = (selector: string) =>
      `sum(container_memory_working_set_bytes{${selector}})`;

    const platformNamespaces = [
      process.env.KUBERO_NAMESPACE || 'kubero',
      process.env.KUBERO_OPERATOR_NAMESPACE || 'kubero-operator-system',
    ].filter((ns) => DNS_LABEL.test(ns));
    let pipelineNamespaces: string[] = [];
    try {
      pipelineNamespaces = (await this.kubectl.getPipelineNamespaces()).filter(
        (ns) => DNS_LABEL.test(ns),
      );
    } catch {
      // sin la lista de pipelines se muestra lo demás, sin los addons
      Logger.warn('cluster-wide usage: could not list pipeline namespaces');
    }
    const addons = `namespace=~"${pipelineNamespaces.join('|')}",${realContainers},container!~"kuberoapp-web|kuberoapp-worker"`;
    const platform = `namespace=~"${platformNamespaces.join('|')}",${realContainers}`;

    // Capacidad de todos los nodos, para mostrar qué parte usa Kubero. Sale de
    // kube-state-metrics y, si Prometheus no lo recolecta (como en la UCT),
    // de cAdvisor, que reporta los cores y la memoria de cada máquina.
    const cpuCapacityQuery =
      'sum(kube_node_status_allocatable{resource="cpu"}) or sum(machine_cpu_cores)';
    const memoryCapacityQuery =
      'sum(kube_node_status_allocatable{resource="memory"}) or sum(machine_memory_bytes)';

    const queries: Record<string, string | undefined> = {
      appsCpu: cpu(appContainers),
      appsMemory: memory(appContainers),
      addonsCpu: pipelineNamespaces.length ? cpu(addons) : undefined,
      addonsMemory: pipelineNamespaces.length ? memory(addons) : undefined,
      platformCpu: platformNamespaces.length ? cpu(platform) : undefined,
      platformMemory: platformNamespaces.length ? memory(platform) : undefined,
      cpuCapacity: cpuCapacityQuery,
      memoryCapacity: memoryCapacityQuery,
    };
    const values: Record<string, number> = {};
    try {
      const entries = Object.entries(queries);
      const results = await Promise.all(
        entries.map(([, query]) =>
          query ? this.prom.instantQuery(query) : undefined,
        ),
      );
      entries.forEach(([key], i) => {
        values[key] = Number(results[i]?.result[0]?.value?.value) || 0;
      });
    } catch (error) {
      Logger.warn(
        'error fetching cluster-wide usage: ' + describePrometheusError(error),
      );
    }
    const usage = (prefix: string) => ({
      cpuCores: values[prefix + 'Cpu'] ?? 0,
      memoryBytes: values[prefix + 'Memory'] ?? 0,
    });
    const breakdown = {
      apps: usage('apps'),
      addons: usage('addons'),
      platform: usage('platform'),
    };
    const parts = Object.values(breakdown);
    return {
      cpuCores: parts.reduce((sum, part) => sum + part.cpuCores, 0),
      memoryBytes: parts.reduce((sum, part) => sum + part.memoryBytes, 0),
      cpuCapacityCores: values.cpuCapacity ?? 0,
      memoryCapacityBytes: values.memoryCapacity ?? 0,
      breakdown,
    };
  }

  public async getLongTermMetrics(
    query: string,
  ): Promise<QueryResult | undefined> {
    let result: QueryResult | undefined;
    try {
      result = await this.prom.instantQuery(query);
    } catch (error) {
      console.log(error);
      console.log('query:', query);
      console.log(this.prom);
    }
    return result;

    /* Manual Query
      const res = await axios.get('http://prometheus.localhost/api/v1/query', {
          params: {
              query: query
          }
      }).catch((error) => {
          console.log(error);
      });
      if (res === undefined) {
          return undefined
      }
      return res.data.data.result
      */
  }

  // Lo que llega desde la URL (pipeline, fase, app) y desde la query string
  // (host, calc) se pegaba tal cual dentro de la consulta PromQL: con un valor
  // como `x"} or {namespace="otro-equipo` se podían leer las métricas de
  // cualquier namespace del cluster, saltándose el control por equipo. Solo se
  // aceptan nombres de recursos válidos y `calc` es una lista cerrada.
  private static readonly SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

  private safe(name: string, value: unknown): string {
    if (typeof value !== 'string' || !MetricsService.SAFE_LABEL.test(value)) {
      throw new BadRequestException(`Invalid ${name}`);
    }
    return value;
  }

  private namespaceOf(q: PrometheusQuery): string {
    return `${this.safe('pipeline', q.pipeline)}-${this.safe('phase', q.phase)}`;
  }

  private calcOf(q: PrometheusQuery): 'rate' | 'increase' {
    return q.calc === 'increase' ? 'increase' : 'rate';
  }

  // El namespace contiene todas las apps del pipeline: sin filtrar por pod, la
  // gráfica de una app mostraba también los pods de las demás.
  private podFilter(q: PrometheusQuery): string {
    return `pod=~"${this.safe('app', q.app)}-kuberoapp-.*"`;
  }

  // Con 24 h o 7 d cada pod que existió en el rango es una serie (se recrean
  // en cada despliegue): webinfo llegaba a 96 áreas superpuestas y el navegador
  // se congelaba al dibujarlas. Se dejan las más recientes.
  private static readonly MAX_SERIES = 12;

  private limitSeries(series: IMetric[]): IMetric[] {
    const lastSeen = (s: IMetric) => {
      const d = s.data as unknown as number[][];
      return d.length ? d[d.length - 1][0] : 0;
    };
    return [...series]
      .sort((a, b) => lastSeen(b) - lastSeen(a) || a.name.localeCompare(b.name))
      .slice(0, MetricsService.MAX_SERIES);
  }

  public async queryMetrics(
    metric: string,
    q: PrometheusQuery,
  ): Promise<QueryResult | undefined> {
    const query = `${metric}{namespace="${this.namespaceOf(q)}", container=~"kuberoapp-web|kuberoapp-worker", ${this.podFilter(q)}}`;
    //console.log(query);
    const { end, start, step } = this.getStepsAndStart(q.scale);
    let result: QueryResult | undefined;
    try {
      result = await this.prom.rangeQuery(query, start, end, step);
    } catch (error) {
      console.log(error);
      console.log(q);
      console.log('query:', query);
      console.log(end, start, step);
      console.log(this.prom);
    }
    return result;
  }

  public async getMemoryMetrics(q: PrometheusQuery): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;
    try {
      const res = await this.queryMetrics('container_memory_rss', q);
      if (res === undefined) {
        throw new Error('no metrics found');
      } else {
        metrics = res;
      }
    } catch (error) {
      console.log('error fetching load metrics');
      throw error;
    }
    for (let i = 0; i < metrics.result.length; i++) {
      const data = metrics.result[i].values.map((v: any) => {
        return [Date.parse(v.time), v.value / 1000000];
      });
      resp.push({
        name: metrics.result[i].metric.labels.pod,
        metric: metrics.result[i].metric,
        data: data,
      });
    }

    return this.limitSeries(resp);
  }

  public async getLoadMetrics(q: PrometheusQuery): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;
    try {
      const res = await this.queryMetrics('container_cpu_load_average_10s', q);
      if (res === undefined) {
        throw new Error('no metrics found');
      } else {
        metrics = res;
      }
    } catch (error) {
      console.log('error fetching load metrics');
      throw error;
    }
    for (let i = 0; i < metrics.result.length; i++) {
      const data = metrics.result[i].values.map((v: any) => {
        return [Date.parse(v.time), v.value];
      });
      resp.push({
        name: metrics.result[i].metric.labels.pod,
        metric: metrics.result[i].metric,
        data: data,
      });
    }

    return this.limitSeries(resp);
  }

  private getStepsAndStart(scale: string): {
    end: Date;
    start: number;
    step: number;
    vector: string;
  } {
    const end = new Date();
    let start = new Date().getTime() - 24 * 60 * 60 * 1000;
    let step = 60 * 10;
    let vector = '5m';
    switch (scale) {
      case '2h':
        start = new Date().getTime() - 2 * 60 * 60 * 1000;
        step = 48; // 48 seconds
        vector = '5m';
        break;
      case '24h':
        start = new Date().getTime() - 24 * 60 * 60 * 1000;
        step = 60 * 10; // 10 minutes
        vector = '10m';
        break;
    }

    return {
      end: end,
      start: start,
      step: step,
      vector: vector,
    };
  }

  public async getCPUMetrics(q: PrometheusQuery): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;

    const { end, start, step, vector } = this.getStepsAndStart(q.scale);
    // rate(nginx_ingress_controller_requests{namespace="asdf-production", host="a.a.localhost"}[10m])
    const query = `${this.calcOf(q)}(container_cpu_usage_seconds_total{namespace="${this.namespaceOf(q)}", container=~"kuberoapp-web|kuberoapp-worker", ${this.podFilter(q)}}[${vector}])`;
    //console.log(query);
    try {
      metrics = await this.prom.rangeQuery(query, start, end, step);
      for (let i = 0; i < metrics.result.length; i++) {
        // rate(...) de container_cpu_usage_seconds_total viene en cores; el
        // eje Y del gráfico dice "millicores", así que se convierte acá.
        const data = metrics.result[i].values.map((v: any) => {
          return [Date.parse(v.time), v.value * 1000];
        });
        resp.push({
          name: metrics.result[i].metric.labels.pod,
          metric: metrics.result[i].metric,
          data: data,
        });
      }
    } catch (error) {
      console.log(error);
      console.log(q);
      console.log('query:', query);
      console.log(end, start, step);
      console.log(this.prom);
    }
    return this.limitSeries(resp);
  }

  public async getHttpStatusCodesMetrics(
    q: PrometheusQuery,
  ): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;

    const { end, start, step, vector } = this.getStepsAndStart(q.scale);
    // Sin el ingress ahora corre en varios pods (uno por nodo), y cada uno expone su
    // propio contador: sin el sum by (status), el mismo código 200 salía repetido
    // una vez por pod que atendió al menos una petición.
    const query = `sum by (status) (${this.calcOf(q)}(nginx_ingress_controller_requests{namespace="${this.namespaceOf(q)}", host="${this.safe('host', q.host)}"}[${vector}]))`;
    //console.log(query);
    try {
      metrics = await this.prom.rangeQuery(query, start, end, step);
      for (let i = 0; i < metrics.result.length; i++) {
        const data = metrics.result[i].values.map((v: any) => {
          return [Date.parse(v.time), v.value];
        });
        resp.push({
          name: metrics.result[i].metric.labels.status,
          metric: metrics.result[i].metric,
          data: data,
        });
      }
    } catch (error) {
      console.log(error);
      console.log(q);
      console.log('query:', query);
      console.log(end, start, step);
      console.log(this.prom);
    }
    return resp;
  }

  public async getHttpResponseTimeMetrics(
    q: PrometheusQuery,
  ): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;

    const { end, start, step, vector } = this.getStepsAndStart(q.scale);
    // mismo motivo que en getHttpStatusCodesMetrics: varios pods de ingress, sin
    // sumarlos salían varias series todas con status="200"
    const query = `sum by (status) (${this.calcOf(q)}(nginx_ingress_controller_response_duration_seconds_count{namespace="${this.namespaceOf(q)}", host="${this.safe('host', q.host)}", status="200"}[${vector}]))`;
    //console.log(query);
    try {
      metrics = await this.prom.rangeQuery(query, start, end, step);
      for (let i = 0; i < metrics.result.length; i++) {
        const data = metrics.result[i].values.map((v: any) => {
          return [Date.parse(v.time), v.value / 1000];
        });
        resp.push({
          name: metrics.result[i].metric.labels.status,
          metric: metrics.result[i].metric,
          data: data,
        });
      }
    } catch (error) {
      console.log(error);
      console.log(q);
      console.log('query:', query);
      console.log(end, start, step);
      console.log(this.prom);
    }
    return resp;
  }

  public async getHttpResponseTrafficMetrics(
    q: PrometheusQuery,
  ): Promise<IMetric[]> {
    const resp = [] as IMetric[];
    let metrics: QueryResult;

    const { end, start, step, vector } = this.getStepsAndStart(q.scale);
    // sum(rate(nginx_ingress_controller_response_size_sum{namespace="asdf-production", host="a.a.localhost"}[10m]))
    const query = `sum(${this.calcOf(q)}(nginx_ingress_controller_response_size_sum{namespace="${this.namespaceOf(q)}", host="${this.safe('host', q.host)}"}[${vector}]))`;
    //console.log(query);
    try {
      metrics = await this.prom.rangeQuery(query, start, end, step);
      for (let i = 0; i < metrics.result.length; i++) {
        const data = metrics.result[i].values.map((v: any) => {
          return [Date.parse(v.time), v.value / 1000];
        });
        resp.push({
          name: metrics.result[i].metric.labels.status,
          metric: metrics.result[i].metric,
          data: data,
        });
      }
    } catch (error) {
      console.log(error);
      console.log(q);
      console.log('query:', query);
      console.log(end, start, step);
      console.log(this.prom);
    }
    return resp;
  }

  public async getRules(q: {
    app: string;
    phase: string;
    pipeline: string;
  }): Promise<any> {
    let rules: RuleGroup[] = [];
    try {
      rules = await this.prom.rules();
    } catch {
      console.log('error fetching rules');
    }

    const ruleslist: Rule[] = [];

    // filter for dedicated app
    for (let i = 0; i < rules.length; i++) {
      for (let j = 0; j < rules[i].rules.length; j++) {
        // remove not matching alerts
        rules[i].rules[j].alerts = rules[i].rules[j].alerts.filter((a: any) => {
          console.log(
            'a.labels.namespace: ' +
              a.labels.namespace +
              ' == q.pipeline: ' +
              q.pipeline +
              '-' +
              q.phase,
          );
          console.log(
            'a.labels.service: ' +
              a.labels.service +
              ' q.app: ' +
              q.app +
              '-kuberoapp',
          );
          return (
            a.labels.namespace === q.pipeline + '-' + q.phase &&
            (a.labels.service === q.app + '-kuberoapp' ||
              a.labels.deployment?.startsWith(q.app + '-kuberoapp') ||
              a.labels.replicaset?.startsWith(q.app + '-kuberoapp') ||
              a.labels.statefulset === q.app + '-kuberoapp' ||
              a.labels.daemonset === q.app + '-kuberoapp' ||
              a.labels.pod === q.app + '-kuberoapp' ||
              a.labels.container === q.app + '-kuberoapp' ||
              a.labels.job === q.app + '-kuberoapp')
          );
        });

        const r: Rule = {
          alert: rules[i].rules[j].alerts[0],
          duration: rules[i].rules[j].duration || 0,
          health: rules[i].rules[j].health || '',
          labels: rules[i].rules[j].labels || {},
          name: rules[i].rules[j].name || '',
          query: rules[i].rules[j].query || '',
          alerting: rules[i].rules[j].alerts.length > 0 ? true : false,
        };

        if (rules[i].rules[j].type === 'alerting') {
          ruleslist.push(r);
        }
      }
    }

    return ruleslist;
  }

  public getPodMetrics(
    pipelineName: string,
    phaseName: string,
    appName: string,
    context?: string,
  ) {
    const namespace = pipelineName + '-' + phaseName;
    return this.kubectl.getPodMetrics(namespace, appName, context);
  }

  public getUptimes(pipelineName: string, phaseName: string, context?: string) {
    const namespace = pipelineName + '-' + phaseName;
    return this.kubectl.getPodUptimes(namespace, context);
  }
}
