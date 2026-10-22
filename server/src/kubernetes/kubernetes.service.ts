import * as YAML from 'yaml';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IKubectlPipelineList,
  IKubectlPipeline,
  IKubectlAppList,
  IKubectlApp,
  IStorageClass,
} from './kubernetes.interface';
import { IPipeline } from '../pipelines/pipelines.interface';
import { KubectlPipeline } from '../pipelines/pipeline/pipeline';
import { KubectlApp, App } from '../apps/app/app';
import { dockerfileTemplate } from '../deployments/templates/dockerfile.yaml';
import { nixpacksTemplate } from '../deployments/templates/nixpacks.yaml';
import { buildpacksTemplate } from '../deployments/templates/buildpacks.yaml';
import { applyBuildResources } from '../deployments/templates/build-resources';

import {
  KubeConfig,
  Exec,
  VersionApi,
  CoreV1Api,
  AppsV1Api,
  CustomObjectsApi,
  VersionInfo,
  PatchUtils,
  Log as KubeLog,
  V1Pod,
  CoreV1Event,
  CoreV1EventList,
  V1Namespace,
  Metrics,
  NodeMetric,
  StorageV1Api,
  BatchV1Api,
  NetworkingV1Api,
  V1Job,
  V1Secret,
} from '@kubernetes/client-node';
import { WebSocket } from 'ws';
import stream from 'stream';
import internal from 'stream';

@Injectable()
export class KubernetesService {
  private kc: KubeConfig;
  private versionApi: VersionApi = {} as VersionApi;
  private coreV1Api: CoreV1Api = {} as CoreV1Api;
  private appsV1Api: AppsV1Api = {} as AppsV1Api;
  private metricsApi: Metrics = {} as Metrics;
  private storageV1Api: StorageV1Api = {} as StorageV1Api;
  private batchV1Api: BatchV1Api = {} as BatchV1Api;
  private customObjectsApi: CustomObjectsApi = {} as CustomObjectsApi;
  private networkingV1Api: NetworkingV1Api = {} as NetworkingV1Api;
  public kubeVersion: VersionInfo | void;
  public kuberoOperatorVersion: string | undefined;
  private patchUtils: PatchUtils = {} as PatchUtils;
  public log: KubeLog;
  //public config: IKuberoConfig;
  private exec: Exec = {} as Exec;
  private readonly logger = new Logger(KubernetesService.name);
  private YAML = YAML;

  constructor() {
    this.kc = new KubeConfig();
    this.log = new KubeLog(this.kc);
    this.kubeVersion = new VersionInfo();
    this.initKubeConfig().catch((error) => {
      this.logger.error('❌ initKubeConfig failed: ' + error);
    });
  }

  private async initKubeConfig() {
    this.kc = new KubeConfig();
    this.contextClients.clear();
    this.invalidatePipelinesCache();
    //this.config = config;
    //this.kc.loadFromDefault(); // should not be used since we want also load from base64 ENV var

    if (process.env.KUBECONFIG_BASE64) {
      const buff = Buffer.from(process.env.KUBECONFIG_BASE64, 'base64');
      const kubeconfig = buff.toString('ascii');
      this.kc.loadFromString(kubeconfig);

      this.logger.debug('ℹ️  Kubeconfig loaded from base64');
    } else if (process.env.KUBECONFIG_PATH) {
      this.kc.loadFromFile(process.env.KUBECONFIG_PATH);
      this.logger.debug(
        'ℹ️  Kubeconfig loaded from file ' + process.env.KUBECONFIG_PATH,
      );
    } else {
      try {
        this.kc.loadFromCluster();
        this.logger.debug('ℹ️  Kubeconfig loaded from cluster');
      } catch {
        this.logger.error('❌ Error loading from cluster');
        //this.logger.debug(error);
      }
    }

    const configuredContext = process.env.KUBERO_CONTEXT;
    if (
      configuredContext &&
      this.kc.getContexts().length > 1 &&
      !this.kc.getContexts().some((c) => c.name === configuredContext)
    ) {
      throw new NotFoundException('Unknown configured Kubernetes context');
    }
    if (
      configuredContext &&
      this.kc.getContexts().some((c) => c.name === configuredContext)
    ) {
      this.kc.setCurrentContext(configuredContext);
    }
    this.log = new KubeLog(this.kc);
    try {
      this.versionApi = this.kc.makeApiClient(VersionApi);
      this.coreV1Api = this.kc.makeApiClient(CoreV1Api);
      this.appsV1Api = this.kc.makeApiClient(AppsV1Api);
      this.storageV1Api = this.kc.makeApiClient(StorageV1Api);
      this.batchV1Api = this.kc.makeApiClient(BatchV1Api);
      this.networkingV1Api = this.kc.makeApiClient(NetworkingV1Api);
      this.metricsApi = new Metrics(this.kc);
      this.patchUtils = new PatchUtils();
      this.exec = new Exec(this.kc);
      this.customObjectsApi = this.kc.makeApiClient(CustomObjectsApi);
    } catch {
      this.logger.error(
        '❌ Error creating api clients. Check kubeconfig, cluster connectivity and context',
      );
      //this.logger.debug(error);
      this.kubeVersion = void 0;
      return;
    }

    this.loadKubeVersion()
      .then((v) => {
        if (v && v.gitVersion) {
          this.logger.debug('ℹ️  Kube version: ' + v.gitVersion);
        } else {
          this.logger.error('❌ Failed to get Kubernetes version');
          process.env.KUBERO_SETUP = 'enabled';
        }
        this.kubeVersion = v;
      })
      .catch((_error) => {
        this.logger.error('❌ Failed to get Kubernetes version');
        //this.logger.debug(error);
      });

    await this.loadOperatorVersion().then((v) => {
      this.logger.debug('ℹ️  Operator version: ' + v);
      this.kuberoOperatorVersion = v || 'unknown';
    });
  }

  public getKubeVersion(): VersionInfo | void {
    return this.kubeVersion;
  }

  public getKubernetesVersion(): string {
    return this.kubeVersion?.gitVersion || 'unknown';
  }

  public async loadKubeVersion(): Promise<VersionInfo | void> {
    // TODO and WARNING: This does not respect the context set by the user!
    try {
      const versionInfo = await this.versionApi.getCode();
      //debug.debug(JSON.stringify(versionInfo.body));
      return versionInfo.body;
    } catch {
      this.logger.debug('getKubeVersion: error getting kube version');
      //this.logger.debug(error);
    }
  }

  public getOperatorVersion(): string | undefined {
    return this.kuberoOperatorVersion;
  }

  private async loadOperatorVersion(): Promise<string | void> {
    const contextName = this.getCurrentContext();
    const namespace = 'kubero-operator-system';

    if (contextName) {
      const pods = await this.getPods(namespace, contextName).catch(() => {
        this.logger.debug('❌ Failed to get Operator Version');
        //this.logger.debug(error);
        //return 'error';
      });
      if (pods) {
        for (const pod of pods) {
          if (
            pod?.metadata?.name?.startsWith(
              'kubero-operator-controller-manager',
            )
          ) {
            const container = pod?.spec?.containers.filter(
              (c: any) => c.name == 'manager',
            )[0];
            return container?.image?.split(':')[1] || 'unknown';
          }
        }
      } else {
        return 'error getting operator version';
      }
    }
  }

  public getContexts() {
    return this.kc.getContexts();
  }

  // Each API client retains a private KubeConfig. Never change the context of
  // a config already used by an in-flight request or a long-lived stream.
  private contextClients = new Map<
    string,
    ReturnType<KubernetesService['createClients']>
  >();

  private createClients(kc: KubeConfig) {
    return {
      coreV1Api: kc.makeApiClient(CoreV1Api),
      customObjectsApi: kc.makeApiClient(CustomObjectsApi),
      batchV1Api: kc.makeApiClient(BatchV1Api),
      metricsApi: new Metrics(kc),
      exec: new Exec(kc),
      log: new KubeLog(kc),
    };
  }

  private clientsForContext(context?: string) {
    if (!context || context === this.kc.getCurrentContext()) {
      return {
        coreV1Api: this.coreV1Api,
        customObjectsApi: this.customObjectsApi,
        batchV1Api: this.batchV1Api,
        metricsApi: this.metricsApi,
        exec: this.exec,
        log: this.log,
      };
    }
    const contexts = this.kc.getContexts();
    let resolved = context;
    if (!contexts.some((c) => c.name === context)) {
      if (contexts.length !== 1) {
        throw new NotFoundException(`Unknown kubernetes context "${context}"`);
      }
      // Preserve the existing single-cluster alias compatibility.
      resolved = contexts[0].name;
    }
    let clients = this.contextClients.get(resolved);
    if (!clients) {
      const kc = new KubeConfig();
      kc.loadFromString(this.kc.exportConfig());
      kc.setCurrentContext(resolved);
      clients = this.createClients(kc);
      this.contextClients.set(resolved, clients);
    }
    return clients;
  }

  public getLog(context?: string): KubeLog {
    return this.clientsForContext(context).log;
  }

  public getCurrentContext() {
    return this.kc.getCurrentContext();
  }

  public async getNamespaces(): Promise<V1Namespace[]> {
    const namespaces = await this.coreV1Api.listNamespace();
    return namespaces.body.items;
  }

  // La lista de pipelines se lee de Kubernetes en cada request autorizado
  // (getContext -> listPipelines). Con la pantalla de métricas pidiendo varias
  // series cada pocos segundos eso eran decenas de lecturas por minuto. Se
  // guarda unos segundos, se comparte la misma lectura entre llamadas
  // simultáneas y se descarta al crear, editar o borrar un pipeline.
  private static readonly PIPELINES_CACHE_MS = 5000;
  private pipelinesCache?: { at: number; data: Promise<IKubectlPipelineList> };

  private invalidatePipelinesCache() {
    this.pipelinesCache = undefined;
  }

  private fetchPipelines(): Promise<IKubectlPipelineList> {
    const now = Date.now();
    if (
      this.pipelinesCache &&
      now - this.pipelinesCache.at < KubernetesService.PIPELINES_CACHE_MS
    ) {
      return this.pipelinesCache.data;
    }
    const data = this.customObjectsApi
      .listNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        process.env.KUBERO_NAMESPACE || 'kubero',
        'kuberopipelines',
      )
      .then((ps) => ps.body as IKubectlPipelineList);
    this.pipelinesCache = { at: now, data };
    // un error no se guarda: el siguiente request vuelve a intentarlo
    data.catch(() => {
      if (this.pipelinesCache?.data === data) {
        this.pipelinesCache = undefined;
      }
    });
    return data;
  }

  public async getPipelinesList(
    userGroups: string[] = [],
  ): Promise<IKubectlPipelineList> {
    let pipelines = {} as IKubectlPipelineList;
    pipelines.items = [];
    try {
      // copia propia: el objeto de la caché se comparte y no debe modificarse
      pipelines = structuredClone(await this.fetchPipelines());
    } catch (error) {
      this.logger.error('❌ getPipelinesList: error getting pipelines!');
      throw error;
    }
    if (pipelines.items.length > 0) {
      pipelines.items = pipelines.items.filter((pipeline) => {
        if (!pipeline.spec || !pipeline.spec.access) return true;
        if (userGroups.includes('admin')) return true;
        const accessGroups = pipeline.spec.access.teams || [];
        return accessGroups.some((group) => userGroups.includes(group));
      });
    }

    return pipelines;
  }

  public async createPipeline(pl: IPipeline) {
    this.invalidatePipelinesCache();
    this.logger.debug('create pipeline: ' + pl.name);
    const pipeline = new KubectlPipeline(pl);

    await this.customObjectsApi
      .createNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        process.env.KUBERO_NAMESPACE || 'kubero',
        'kuberopipelines',
        pipeline,
      )
      .catch((error) => {
        this.logger.error('❌ Error creating pipeline: ' + pl.name);
        throw error;
      })
      .finally(() => this.invalidatePipelinesCache());
  }

  public async updatePipeline(pl: IPipeline, resourceVersion: string) {
    this.invalidatePipelinesCache();
    this.logger.debug('update pipeline: ' + pl.name);
    const pipeline = new KubectlPipeline(pl);
    pipeline.metadata.resourceVersion = resourceVersion;

    await this.customObjectsApi
      .replaceNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        process.env.KUBERO_NAMESPACE || 'kubero',
        'kuberopipelines',
        pl.name,
        pipeline,
      )
      .catch((error) => {
        this.logger.error('❌ Error updating pipeline: ' + pl.name);
        throw error;
      })
      .finally(() => this.invalidatePipelinesCache());
  }

  public async deletePipeline(pipelineName: string) {
    this.invalidatePipelinesCache();
    this.logger.debug('delete pipeline: ' + pipelineName);
    await this.customObjectsApi
      .deleteNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        process.env.KUBERO_NAMESPACE || 'kubero',
        'kuberopipelines',
        pipelineName,
      )
      .catch(() => {
        // this.logger.debug(error);
      })
      .finally(() => this.invalidatePipelinesCache());
  }

  public async getPipeline(pipelineName: string): Promise<IKubectlPipeline> {
    const pipeline = await this.customObjectsApi
      .getNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        process.env.KUBERO_NAMESPACE || 'kubero',
        'kuberopipelines',
        pipelineName,
      )
      .catch((error) => {
        //this.logger.debug(error);
        this.logger.debug('getPipeline: error getting pipeline');
        throw error;
      });
    if (pipeline) {
      return pipeline.body as IKubectlPipeline;
    } else {
      throw new Error('Pipeline not found');
      //return {} as IKubectlPipeline;
    }
  }

  public async createApp(app: App, context: string) {
    const { customObjectsApi } = this.clientsForContext(context);
    this.logger.debug('create app: ' + app.name);

    const appl = new KubectlApp(app);

    const namespace = app.pipeline + '-' + app.phase;

    await customObjectsApi
      .createNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoapps',
        appl,
      )
      .catch((error) => {
        this.logger.error('❌ Error creating app: ' + app.name);
        throw error;
      });
  }

  public async updateApp(app: App, resourceVersion: string, context: string) {
    const { customObjectsApi } = this.clientsForContext(context);
    this.logger.debug('update app: ' + app.name);

    const appl = new KubectlApp(app);
    appl.metadata.resourceVersion = resourceVersion;

    const namespace = app.pipeline + '-' + app.phase;

    await customObjectsApi
      .replaceNamespacedCustomObject(
        //await customObjectsApi.patchNamespacedCustomObject(
        // patch : https://stackoverflow.com/questions/67520468/patch-k8s-custom-resource-with-kubernetes-client-node
        // https://github.com/kubernetes-client/javascript/blob/master/examples/patch-example.js
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoapps',
        app.name,
        appl,
      )
      .catch(() => {
        // this.logger.debug(error);
      });
  }

  public async deleteApp(
    pipelineName: string,
    phaseName: string,
    appName: string,
    context: string,
  ) {
    const { customObjectsApi } = this.clientsForContext(context);
    this.logger.debug('delete app: ' + appName);

    const namespace = pipelineName + '-' + phaseName;

    await customObjectsApi
      .deleteNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoapps',
        appName,
      )
      .catch(() => {
        // this.logger.debug(error);
      });
  }

  public async getApp(
    pipelineName: string,
    phaseName: string,
    appName: string,
    context: string,
  ): Promise<IKubectlApp> {
    const { customObjectsApi } = this.clientsForContext(context);
    const namespace = pipelineName + '-' + phaseName;

    const app = await customObjectsApi
      .getNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoapps',
        appName,
      )
      .catch(() => {
        // this.logger.debug(error);
      });

    if (app) {
      return app.body as IKubectlApp;
    } else {
      return {} as IKubectlApp;
    }
  }

  public async getAppsList(
    namespace: string,
    context: string,
  ): Promise<IKubectlAppList> {
    const { customObjectsApi } = this.clientsForContext(context);
    try {
      const appslist = await customObjectsApi.listNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoapps',
      );
      return appslist.body as IKubectlAppList;
    } catch {
      //this.logger.debug(error);
      this.logger.debug('getAppsList: error getting apps');
    }
    const appslist = {} as IKubectlAppList;
    appslist.items = [];
    return appslist;
  }

  public async getAllAppsList(context: string): Promise<IKubectlAppList> {
    const { customObjectsApi } = this.clientsForContext(context);
    try {
      const appslist = await customObjectsApi.listClusterCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        'kuberoapps',
      );
      return appslist.body as IKubectlAppList;
    } catch {
      //this.logger.debug(error);
      this.logger.debug('getAppsList: error getting apps');
    }
    const appslist = {} as IKubectlAppList;
    appslist.items = [];
    return appslist;
  }

  public async restartApp(
    pipelineName: string,
    phaseName: string,
    appName: string,
    workloadType: string,
    context: string,
  ) {
    const { customObjectsApi } = this.clientsForContext(context);
    this.logger.debug('restart app: ' + appName);

    const namespace = pipelineName + '-' + phaseName;
    const deploymentName = appName + '-kuberoapp-' + workloadType;
    const date = new Date();

    // format : https://jsonpatch.com/
    const patch = [
      {
        op: 'add',
        path: '/spec/restartedAt',
        value: {
          restartedAt: date.toISOString(),
        },
      },
    ];

    const apiVersion = 'v1alpha1';
    const group = 'application.kubero.dev';
    const plural = 'kuberoapps';

    const options = {
      headers: { 'Content-type': 'application/json-patch+json' },
    };
    try {
      await customObjectsApi.patchNamespacedCustomObject(
        group,
        apiVersion,
        namespace,
        plural,
        appName,
        patch,
        undefined,
        undefined,
        undefined,
        options,
      );
      this.logger.debug(
        `Deployment ${deploymentName} in Pipeline ${namespace} updated`,
      );
    } catch (error) {
      if (error.body.message) {
        this.logger.debug('ERROR: ' + error.body.message);
      }
      this.logger.debug('ERROR: ' + error);
    }
  }

  public async getOperators() {
    // TODO list operators from all clusters
    let operators = { items: [] };
    try {
      const response = await this.customObjectsApi.listNamespacedCustomObject(
        'operators.coreos.com',
        'v1alpha1',
        'operators',
        'clusterserviceversions',
      );
      //let operators = response.body as KubernetesListObject<KubernetesObject>;
      operators = response.body as any; // TODO : fix type. This is a hacky way to get the type to work
    } catch {
      //this.logger.debug(error);
      this.logger.debug('error getting operators');
    }

    return operators.items;
  }

  public async getCustomresources() {
    // TODO list operators from all clusters
    let operators = { items: [] };
    try {
      const response = await this.customObjectsApi.listClusterCustomObject(
        'apiextensions.k8s.io',
        'v1',
        'customresourcedefinitions',
      );
      operators = response.body as any; // TODO : fix type. This is a hacky way to get the type to work
    } catch {
      //this.logger.debug(error);
      this.logger.debug('error getting customresources');
    }

    return operators.items;
  }

  public async getPods(namespace: string, context: string): Promise<V1Pod[]> {
    const { coreV1Api } = this.clientsForContext(context);
    // faltaba cambiar de contexto antes de consultar (a diferencia de
    // getAppsList y el resto de los métodos de este archivo), así que
    // siempre leía del último contexto usado, no del que se le pasaba
    const pods = await coreV1Api.listNamespacedPod(namespace);
    return pods.body.items;
  }

  public async createEvent(
    type: 'Normal' | 'Warning',
    reason: string,
    eventName: string,
    message: string,
  ) {
    this.logger.debug('create event: ' + eventName);

    const event = new CoreV1Event();
    event.apiVersion = 'v1';
    event.kind = 'Event';
    event.type = type;
    event.message = message;
    event.reason = reason;
    event.metadata = {
      name: eventName + '.' + Date.now().toString(),
      namespace: process.env.KUBERO_NAMESPACE || 'kubero',
    };
    event.involvedObject = {
      kind: 'Kubero',
      namespace: process.env.KUBERO_NAMESPACE || 'kubero',
    };

    await this.coreV1Api
      .createNamespacedEvent(process.env.KUBERO_NAMESPACE || 'kubero', event)
      .catch(() => {
        // this.logger.debug(error);
      });
  }

  public async getEvents(
    namespace: string,
    context?: string,
  ): Promise<CoreV1Event[]> {
    const { coreV1Api } = this.clientsForContext(context);
    try {
      const events = await coreV1Api.listNamespacedEvent(namespace);
      return events.body.items;
    } catch {
      //this.logger.debug(error);
      this.logger.debug('getEvents: error getting events');
    }
    const events = {} as CoreV1EventList;
    events.items = [];
    return events.items;
  }

  public async getPodMetrics(
    namespace: string,
    appName: string,
    context?: string,
  ): Promise<any> {
    const { coreV1Api, metricsApi } = this.clientsForContext(context);
    //TODO make this a real type
    const ret: {
      name: string;
      namespace: string;
      memory: {
        unit: string;
        request: number;
        limit: number;
        usage: number;
        percentage: number;
      };
      cpu: {
        unit: string;
        request: number;
        limit: number;
        usage: number;
        percentage: number;
      };
    }[] = [];

    try {
      const metrics = await metricsApi.getPodMetrics(namespace);

      for (let i = 0; i < metrics.items.length; i++) {
        const metric = metrics.items[i];

        if (!metric.metadata.name.startsWith(appName + '-')) continue;

        const pod = await coreV1Api.readNamespacedPod(
          metric.metadata.name,
          namespace,
        );
        const requestCPU = this.normalizeCPU(
          pod.body.spec?.containers[0].resources?.requests?.cpu || '0',
        );
        const requestMemory = this.normalizeMemory(
          pod.body.spec?.containers[0].resources?.requests?.memory || '0',
        );
        const limitsCPU = this.normalizeCPU(
          pod.body.spec?.containers[0].resources?.limits?.cpu || '0',
        );
        const limitsMemory = this.normalizeMemory(
          pod.body.spec?.containers[0].resources?.limits?.memory || '0',
        );
        const usageCPU = this.normalizeCPU(metric.containers[0].usage.cpu);
        const usageMemory = this.normalizeMemory(
          metric.containers[0].usage.memory,
        );
        const percentageCPU = Math.round((usageCPU / limitsCPU) * 100);
        const percentageMemory = Math.round((usageMemory / limitsMemory) * 100);

        /* debug caclulation */ /*
                console.log("resource CPU    : " + requestCPU, pod.body.spec?.containers[0].resources?.requests?.cpu)
                console.log("limits CPU      : " + limitsCPU, pod.body.spec?.containers[0].resources?.limits?.cpu)
                console.log("usage CPU       : " + usageCPU, metric.containers[0].usage.cpu)
                console.log("percent CPU     : " + percentageCPU + "%")
                console.log("resource Memory : " + requestMemory, pod.body.spec?.containers[0].resources?.limits?.cpu)
                console.log("limits Memory   : " + limitsMemory, pod.body.spec?.containers[0].resources?.limits?.memory)
                console.log("usage Memory    : " + usageMemory, metric.containers[0].usage.memory)
                console.log("percent Memory  : " + percentageMemory + "%")
                console.log("------------------------------------")
                /* end debug calculations*/

        const m = {
          name: metric.metadata.name,
          namespace: metric.metadata.namespace,
          memory: {
            unit: 'Mi',
            request: requestMemory,
            limit: limitsMemory,
            usage: usageMemory,
            percentage: percentageMemory,
          },
          cpu: {
            unit: 'm',
            request: requestCPU,
            limit: limitsCPU,
            usage: usageCPU,
            percentage: percentageCPU,
          },
        };
        ret.push(m);
      }
    } catch (error: any) {
      this.logger.debug('ERROR fetching metrics: ' + error);
    }

    return ret;
  }

  private normalizeCPU(resource: string): number {
    const regex = /([0-9]+)([a-zA-Z]*)/;
    const matches = resource.match(regex);

    let value = 0;
    let unit = '';
    if (matches !== null && matches[1]) {
      value = parseInt(matches[1]);
    }
    if (matches !== null && matches[2]) {
      unit = matches[2];
    }

    //console.log("CPU unit: " + unit + " value: " + value + " :: " +resource);
    switch (unit) {
      case 'm':
        return value / 1;
      case 'n':
        return Math.round(value / 1000000);
      default:
        return value * 1000;
    }
    return 0;
  }

  private normalizeMemory(resource: string): number {
    const regex = /([0-9]+)([a-zA-Z]*)/;
    const matches = resource.match(regex);

    let value = 0;
    let unit = '';
    if (matches !== null && matches[1]) {
      value = parseInt(matches[1]);
    }
    if (matches !== null && matches[2]) {
      unit = matches[2];
    }
    //console.log("CPU unit: " + unit + " value: " + value + " :: " +resource);

    switch (unit) {
      case 'Gi':
        return value * 1000;
      case 'Mi':
        return value / 1;
      case 'Ki':
        return Math.round(value / 1000);
      default:
        return value;
    }
    return 0;
  }

  public async getNodeMetrics(): Promise<NodeMetric[]> {
    const metrics = await this.metricsApi.getNodeMetrics();
    return metrics.items;
  }

  private getPodUptimeMS(pod: V1Pod): number {
    const startTime = pod.status?.startTime;
    if (startTime) {
      const start = new Date(startTime);
      const now = new Date();
      const uptime = now.getTime() - start.getTime();
      return uptime;
    }
    return -1;
  }

  public async getPodUptimes(
    namespace: string,
    context?: string,
  ): Promise<object> {
    const { coreV1Api } = this.clientsForContext(context);
    const pods = await coreV1Api.listNamespacedPod(namespace);
    const ret = Object();
    for (let i = 0; i < pods.body.items.length; i++) {
      const pod = pods.body.items[i];
      const uptime = this.getPodUptimeMS(pod);
      if (pod.metadata && pod.metadata.name) {
        ret[pod.metadata.name] = {
          ms: uptime,
          formatted: this.formatUptime(uptime),
        };
      }
    }
    return ret;
  }

  private formatUptime(uptime: number): string {
    // 0-120s show seconds
    // 2-10m show minutes and seconds
    // 10-120m show minutes
    // 2-48h show hours and minutes
    // 2-30d show days and hours
    // >30d show date

    if (uptime < 0) {
      return '';
    }
    if (uptime < 120000) {
      const seconds = Math.floor(uptime / 1000);
      return seconds + 's';
    }
    if (uptime < 600000) {
      const minutes = Math.floor(uptime / (1000 * 60));
      const seconds = Math.floor((uptime - minutes * 1000 * 60) / 1000);
      if (seconds > 0) {
        return minutes + 'm' + seconds + 's';
      }
      return minutes + 'm';
    }
    if (uptime < 7200000) {
      const minutes = Math.floor(uptime / (1000 * 60));
      return minutes + 'm';
    }
    if (uptime < 172800000) {
      const hours = Math.floor(uptime / (1000 * 60 * 60));
      const minutes = Math.floor(
        (uptime - hours * 1000 * 60 * 60) / (1000 * 60),
      );
      if (minutes > 0) {
        return hours + 'h' + minutes + 'm';
      }
      return hours + 'h';
    }
    //if (uptime < 2592000000) {
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptime - days * 1000 * 60 * 60 * 24) / (1000 * 60 * 60),
    );
    if (hours > 0) {
      return days + 'd' + hours + 'h';
    }
    return days + 'd';
    //}
  }

  public async getStorageClasses(): Promise<IStorageClass[]> {
    const ret: IStorageClass[] = [];
    try {
      const storageClasses = await this.storageV1Api.listStorageClass();
      for (let i = 0; i < storageClasses.body.items.length; i++) {
        const sc = storageClasses.body.items[i];
        const storageClass = {
          name: sc.metadata?.name,
          provisioner: sc.provisioner,
          reclaimPolicy: sc.reclaimPolicy,
          volumeBindingMode: sc.volumeBindingMode,
          //allowVolumeExpansion: sc.allowVolumeExpansion,
          //parameters: sc.parameters
        } as IStorageClass;
        ret.push(storageClass);
      }
    } catch (error) {
      this.logger.error(error);
      this.logger.error('ERROR fetching storageclasses');
    }
    return ret;
  }

  public async getIngressClasses(): Promise<object[]> {
    // undefind = default
    const ret = [
      {
        name: undefined,
      },
    ] as object[];
    try {
      const ingressClasses = await this.networkingV1Api.listIngressClass();
      for (let i = 0; i < ingressClasses.body.items.length; i++) {
        const ic = ingressClasses.body.items[i];
        const ingressClass = {
          name: ic.metadata?.name,
        };
        ret.push(ingressClass);
      }
    } catch (error) {
      this.logger.error(error);
      this.logger.error('ERROR fetching ingressclasses');
    }
    return ret;
  }

  public deployApp(
    namespace: string,
    appName: string,
    tag: string,
    context?: string,
  ) {
    const { customObjectsApi } = this.clientsForContext(context);
    const deploymentName = appName + '-kuberoapp-web';
    this.logger.error(
      'deploy app: ' + appName,
      ',namespace: ' + namespace,
      ',tag: ' + tag,
      ',deploymentName: ' + deploymentName,
    );

    // format : https://jsonpatch.com/
    const patch = [
      {
        op: 'replace',
        path: '/spec/image/tag',
        value: tag,
      },
    ];

    const apiVersion = 'v1alpha1';
    const group = 'application.kubero.dev';
    const plural = 'kuberoapps';

    const options = {
      headers: { 'Content-type': 'application/json-patch+json' },
    };
    customObjectsApi
      .patchNamespacedCustomObject(
        group,
        apiVersion,
        namespace,
        plural,
        appName,
        patch,
        undefined,
        undefined,
        undefined,
        options,
      )
      .then(() => {
        this.logger.debug(
          `Deployment ${deploymentName} in Pipeline ${namespace} updated`,
        );
      })
      .catch((error) => {
        if (error.body.message) {
          this.logger.debug('ERROR: ' + error.body.message);
        }
        this.logger.debug('ERROR: ' + error);
      });
  }

  public async getAllIngress(): Promise<any> {
    const ingresses = await this.networkingV1Api.listIngressForAllNamespaces();
    return ingresses.body.items;
  }

  public async getDomains(): Promise<any> {
    const allIngress = await this.getAllIngress();
    const domains: string[] = [];
    allIngress.forEach((ingress: any) => {
      ingress.spec.rules.forEach((rule: any) => {
        domains.push(rule.host);
      });
    });
    return domains;
  }

  public async execInContainer(
    namespace: string,
    podName: string,
    containerName: string,
    command: string,
    stdin: internal.PassThrough,
    stdout: stream.Writable,
    stderr: stream.Writable,
    context?: string,
  ): Promise<WebSocket> {
    const { exec } = this.clientsForContext(context);
    //const command = ['ls', '-al', '.']
    //const command = ['bash']
    //const command = "bash"
    const ws = await exec.exec(
      namespace,
      podName,
      containerName,
      command,
      stdout,
      stderr,
      stdin,
      true,
    );
    return ws;
  }

  public async getKuberoConfig(namespace: string) {
    try {
      const config = await this.customObjectsApi.getNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoes',
        'kubero',
      );
      //console.log(config.body);
      return config.body as any;
    } catch {
      // this.logger.debug(error);
      this.logger.debug('getKuberoConfig: error getting config');
    }
  }

  public async updateKuberoConfig(namespace: string, config: any) {
    const patch = [
      {
        op: 'replace',
        path: '/spec',
        value: config.spec,
      },
    ];

    const options = {
      headers: { 'Content-type': 'application/json-patch+json' },
    };
    try {
      await this.customObjectsApi.patchNamespacedCustomObject(
        'application.kubero.dev',
        'v1alpha1',
        namespace,
        'kuberoes',
        'kubero',
        patch,
        undefined,
        undefined,
        undefined,
        options,
      );
    } catch {
      // this.logger.debug(error);
    }
  }

  public async updateKuberoSecret(namespace: string, secret: any) {
    const patch = [
      {
        op: 'replace',
        path: '/stringData',
        value: secret,
      },
    ];

    const options = {
      headers: { 'Content-type': 'application/json-patch+json' },
    };
    try {
      await this.coreV1Api.patchNamespacedSecret(
        'kubero-secrets',
        namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options,
      );
    } catch {
      // this.logger.debug(error);
    }
  }

  // Copia el secreto TLS compartido (wildcard del dominio) al namespace de una app, si
  // todavía no tiene una copia. Así el Ingress puede apuntar directo a él, igual que el
  // resto de los proyectos del cluster, sin pasarle nada a cert-manager. Desactivado por
  // defecto: sin KUBERO_SHARED_TLS_SECRET_NAME no se hace ninguna llamada a la API.
  public async ensureSharedTlsSecret(
    targetNamespace: string,
    context: string,
  ): Promise<string | null> {
    const secretName = process.env.KUBERO_SHARED_TLS_SECRET_NAME;
    if (!secretName) {
      return null;
    }
    const { coreV1Api } = this.clientsForContext(context);
    const sourceNamespace =
      process.env.KUBERO_SHARED_TLS_SECRET_NAMESPACE ||
      process.env.KUBERO_NAMESPACE ||
      'kubero';

    try {
      await coreV1Api.readNamespacedSecret(secretName, targetNamespace);
      return secretName;
    } catch {
      // no existe en el namespace destino, hay que copiarlo
    }

    try {
      const { body: source } = await coreV1Api.readNamespacedSecret(
        secretName,
        sourceNamespace,
      );
      const copy: V1Secret = {
        apiVersion: 'v1',
        kind: 'Secret',
        type: source.type,
        data: source.data,
        metadata: {
          name: secretName,
          namespace: targetNamespace,
        },
      };
      await coreV1Api.createNamespacedSecret(targetNamespace, copy);
      return secretName;
    } catch {
      this.logger.error(
        'No se pudo preparar el secreto TLS compartido en ' + targetNamespace,
      );
      return null;
    }
  }

  public async createBuildJob(
    namespace: string,
    appName: string,
    pipelineName: string,
    buildstrategy: 'buildpacks' | 'dockerfile' | 'nixpacks' | 'plain',
    dockerfilePath: string | undefined,
    git: {
      url: string;
      ref: string;
    },
    repository: {
      image: string;
      tag: string;
    },
    context?: string,
  ): Promise<any> {
    const { batchV1Api, coreV1Api } = this.clientsForContext(context);
    const job = this.loadJob(buildstrategy) as any;
    //const job = new Object() as any;

    const id = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/[T]/g, '-')
      .substring(0, 13);
    const name = appName + '-' + pipelineName + '-' + id;

    job.metadata.name = name.substring(0, 53); // max 53 characters allowed within kubernetes
    //job.metadata.namespace = namespace;
    job.metadata.labels['job-name'] = name.substring(0, 53);
    job.metadata.labels['batch.kubernetes.io/job-name'] = name.substring(0, 53);
    job.metadata.labels['kuberoapp'] = appName;
    job.metadata.labels['kuberopipeline'] = pipelineName;
    job.spec.template.metadata.labels['job-name'] = name.substring(0, 53);
    job.spec.template.metadata.labels['batch.kubernetes.io/job-name'] =
      name.substring(0, 53);
    job.spec.template.metadata.labels['kuberoapp'] = appName;
    job.spec.template.metadata.labels['kuberopipeline'] = pipelineName;
    job.spec.template.spec.serviceAccountName = appName + '-kuberoapp';
    job.spec.template.spec.serviceAccount = appName + '-kuberoapp';
    job.spec.template.spec.initContainers[0].env[0].value = git.url;
    job.spec.template.spec.initContainers[0].env[1].value = git.ref;
    job.spec.template.spec.containers[0].env[0].value = repository.image;
    job.spec.template.spec.containers[0].env[1].value =
      repository.tag + '-' + id;
    job.spec.template.spec.containers[0].env[2].value = appName;

    if (buildstrategy === 'buildpacks') {
      // configure build container
      job.spec.template.spec.initContainers[2].args[1] =
        repository.image + ':' + repository.tag + '-' + id;
    }
    if (buildstrategy === 'dockerfile') {
      // configure push container
      job.spec.template.spec.initContainers[1].env[1].value =
        repository.image + ':' + repository.tag + '-' + id;
      job.spec.template.spec.initContainers[1].env[2].value = dockerfilePath;
    }
    if (buildstrategy === 'nixpacks') {
      // configure push container
      job.spec.template.spec.initContainers[2].env[1].value =
        repository.image + ':' + repository.tag + '-' + id;
      job.spec.template.spec.initContainers[2].env[2].value = dockerfilePath;
    }

    // Old API servers or disabled feature gates can drop hostUsers. Check a
    // Pod through admission without persisting or executing it, before creating
    // a Job whose builder needs namespace-local mount capabilities.
    const admitted = await coreV1Api.createNamespacedPod(
      namespace,
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { generateName: job.metadata.name + '-check-', namespace },
        spec: job.spec.template.spec,
      },
      undefined,
      'All',
    );
    if (admitted.body.spec?.hostUsers !== false) {
      throw new BadRequestException(
        'Builds require Kubernetes pod user namespace support (hostUsers: false)',
      );
    }
    this.logger.log('create build job: ' + job.metadata.name);

    try {
      return await batchV1Api.createNamespacedJob(namespace, job);
    } catch (error) {
      this.logger.error('ERROR creating build job');
      throw error;
    }
  }

  public async deleteKuberoBuildJob(
    namespace: string,
    buildName: string,
    context?: string,
  ) {
    const { batchV1Api } = this.clientsForContext(context);
    try {
      await batchV1Api.deleteNamespacedJob(buildName, namespace);
    } catch {
      // this.logger.debug(error);
    }
  }

  public async getJob(namespace: string, jobName: string): Promise<any> {
    try {
      const job = await this.batchV1Api.readNamespacedJob(jobName, namespace);
      return job.body;
    } catch {
      // this.logger.debug(error);
      this.logger.debug('getJob: error getting job');
    }
  }

  public async getJobs(namespace: string, context?: string): Promise<any> {
    const { batchV1Api } = this.clientsForContext(context);
    try {
      const jobs = await batchV1Api.listNamespacedJob(namespace);
      return jobs.body;
    } catch {
      // this.logger.debug(error);
      this.logger.debug('getJobs: error getting jobs');
    }
  }

  public async validateKubeconfig(
    kubeconfig: string,
    kubeContext: string,
  ): Promise<{ error: any; valid: boolean }> {
    // validate config for setup process

    //let buff = Buffer.from(configBase64, 'base64');
    //const kubeconfig = buff.toString('ascii');

    const kc = new KubeConfig();
    kc.loadFromString(kubeconfig);
    kc.setCurrentContext(kubeContext);

    try {
      const versionApi = kc.makeApiClient(VersionApi);
      const versionInfo = await versionApi.getCode();
      this.logger.debug(JSON.stringify(versionInfo.body));
      return { error: null, valid: true };
    } catch (error: any) {
      this.logger.error('Error validating kubeconfig: ' + error);
      this.logger.error(error);
      return { error: error.message, valid: false };
    }
  }

  public updateKubectlConfig(kubeconfig: string, kubeContext: string) {
    // update kubeconfig in the kubectl instance
    /*
        this.kc.loadFromString(kubeconfig);
        this.kc.setCurrentContext(kubeContext);
        */
    this.initKubeConfig().catch((error) => {
      this.logger.error('❌ initKubeConfig failed: ' + error);
    });
    this.logger.debug(kubeContext, this.kc.getCurrentContext());

    this.logger.log('Kubeconfig updated');
  }

  public async checkNamespace(namespace: string): Promise<boolean> {
    try {
      await this.coreV1Api.readNamespace(namespace);
      return true;
    } catch {
      return false;
    }
  }

  public async checkPod(namespace: string, podName: string): Promise<boolean> {
    try {
      await this.coreV1Api.readNamespacedPod(podName, namespace);
      return true;
    } catch {
      return false;
    }
  }

  public async checkDeployment(
    namespace: string,
    deploymentName: string,
  ): Promise<boolean> {
    try {
      await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
      return true;
    } catch {
      return false;
    }
  }

  public async checkCustomResourceDefinition(plural: string): Promise<boolean> {
    try {
      await this.customObjectsApi.listClusterCustomObject(
        'apiextensions.k8s.io',
        'v1',
        plural,
      );
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  public async createNamespace(namespace: string): Promise<any> {
    const ns = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
      },
    };
    try {
      return await this.coreV1Api.createNamespace(ns);
    } catch {
      //console.log(error);
      this.logger.error('ERROR creating namespace');
    }
  }

  private loadJob(jobname: string): V1Job {
    const allowedJobNames = ['buildpacks', 'dockerfile', 'nixpacks', 'plain'];
    if (!allowedJobNames.includes(jobname)) {
      throw new Error(`Invalid job name: ${jobname}`);
    }

    let job = '';
    switch (jobname) {
      case 'buildpacks':
        job = buildpacksTemplate;
        break;
      case 'dockerfile':
        job = dockerfileTemplate;
        break;
      case 'nixpacks':
        job = nixpacksTemplate;
        break;
      default:
        break;
    }
    return applyBuildResources(this.YAML.parse(job) as V1Job);
  }
}
