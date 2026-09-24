import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MetricsOptions,
  IMetric,
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
      case '7d':
        start = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
        step = 60 * 120; // 700 minutes
        vector = '20m';
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
        const data = metrics.result[i].values.map((v: any) => {
          return [Date.parse(v.time), v.value];
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
    // rate(nginx_ingress_controller_requests{namespace="asdf-production", host="a.a.localhost"}[10m])
    const query = `${this.calcOf(q)}(nginx_ingress_controller_requests{namespace="${this.namespaceOf(q)}", host="${this.safe('host', q.host)}"}[${vector}])`;
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
    // rate(nginx_ingress_controller_response_duration_seconds_count{namespace="asdf-production", host="a.a.localhost",status="200"}[10m]) //in ms
    const query = `${this.calcOf(q)}(nginx_ingress_controller_response_duration_seconds_count{namespace="${this.namespaceOf(q)}", host="${this.safe('host', q.host)}", status="200"}[${vector}])`;
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
  ) {
    const namespace = pipelineName + '-' + phaseName;
    return this.kubectl.getPodMetrics(namespace, appName);
  }

  public getUptimes(pipelineName: string, phaseName: string) {
    const namespace = pipelineName + '-' + phaseName;
    return this.kubectl.getPodUptimes(namespace);
  }
}
