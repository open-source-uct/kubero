<template>
    <v-container fluid class="app-stats">
        <v-row class="ma-0">
            <v-sheet
                class="app-stats__surface"
                width="100%"
                color="transparent"
            >
                <section class="app-stats__section">
                    <h2 class="app-stats__title">{{ $t('app.nav.overview') }}</h2>
                    <v-table class="app-stats__table app-stats__table--details" density="comfortable" v-if="appData.spec.gitrepo != undefined">
                        <tbody>
                        <tr>
                            <th>{{ $t('app.domains') }}</th>
                            <td>
                                <ul class="app-stats__domains">
                                    <li v-for="host in appData.spec.ingress.hosts" :key="host.host">
                                        <a :href="'https://' + host.host" target="_blank">{{ host.host }}</a> 
                                        <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
                                    </li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <th>{{ $t('app.deploymentStrategy') }}</th>
                            <td>{{ appData.spec.deploymentstrategy }}</td>
                        </tr>
                        <tr v-if="appData.spec.deploymentstrategy == 'git' && appData.spec.deploymentstrategy == 'plain'">
                            <th>{{ $t('app.runpack') }}</th>
                            <td>{{ appData.spec.buildpack }}</td>
                        </tr>
                        <tr v-if="appData.spec.deploymentstrategy == 'git'">
                            <th>{{ $t('app.buildStrategy') }}</th>
                            <td>{{ appData.spec.buildstrategy }}</td>
                        </tr>
                        <tr v-if="appData.spec.deploymentstrategy == 'git'">
                            <th>{{ $t('app.gitRepo') }}</th>
                            <td><a :href="appData.spec.gitrepo.clone_url" target="_blank">{{ appData.spec.gitrepo.clone_url }}:{{ appData.spec.branch }}</a></td>
                        </tr>
                        <tr v-if="appData.spec.deploymentstrategy == 'git'">
                            <th>{{ $t('app.autodeploy') }}</th>
                            <td>{{ appData.spec.autodeploy }}</td>
                        </tr>
                        <tr>
                            <th>{{ $t('app.podSize') }}</th>
                            <td>{{ appData.spec.podsize.description }}</td>
                        </tr>
                        <tr>
                            <th>{{ $t('app.autoscale') }}</th>
                            <td>{{ appData.spec.autoscale }}</td>
                        </tr>
                        <tr>
                            <th>{{ $t('app.webReplicas') }}</th>
                            <td>{{ appData.spec.web.replicaCount }}</td>
                        </tr>
                        <tr>
                            <th>{{ $t('app.workerReplicas') }}</th>
                            <td>{{ appData.spec.worker.replicaCount }}</td>
                        </tr>
                        </tbody>
                    </v-table>
                    <!--
                    <div><b>Deployment Strategy : </b>{{ appData.spec.deploymentstrategy }}</div>
                    <div><b>Domain : </b>{{ appData.spec.ingress.hosts[0].host }}</div>
                    <div><b>podsize : </b>{{ appData.spec.podsize.description }}</div>
                    <div><b>autoscale : </b>{{ appData.spec.autoscale }}</div>
                    <div><b>web : </b>{{ appData.spec.web.replicaCount }}</div>
                    <div><b>worker : </b>{{ appData.spec.worker.replicaCount }}</div>
                    -->
                </section>

                <section class="app-stats__section">
                    <h2 class="app-stats__title">{{ $t('app.titles.consumption') }}</h2>
                <div class="app-stats__metrics" v-if="metricsDisplay == 'bars'">
                    <v-row>
                        <v-col cols="6" class="pb-0 text-left text-caption font-weight-light">CPU</v-col>
                        <v-col cols="6" class="pb-0 text-right text-caption font-weight-light">Memory</v-col>
                    </v-row>
                    <v-row v-for="metric in metrics" :key="metric.name" style="height:20px">
                        <v-col cols="6" class="text-left"><v-progress-linear :value="metric.cpu.percentage" color="primary" class="mr-6 float-left" rounded></v-progress-linear></v-col>
                        <v-col cols="6" class="text-right"><v-progress-linear :value="metric.memory.percentage" color="accent" class="float-left" rounded></v-progress-linear></v-col>
                    </v-row>
                </div>
                <div class="app-stats__metrics app-stats__metrics--table" v-if="metricsDisplay == 'table'">
                    <table :aria-label="$t('app.titles.consumption')">
                        <thead>
                            <tr>
                                <th scope="col">Pod</th>
                                <th scope="col">CPU</th>
                                <th scope="col">Memory</th>
                                <th scope="col">Uptime</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="metric in metrics" :key="metric.name">
                                <td>{{metric.name}}</td>
                                <td>{{metric.cpu.usage}}{{metric.cpu.unit}}</td>
                                <td>{{metric.memory.usage}}{{metric.memory.unit}}</td>
                                <td>{{metric.uptime.formatted}}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                </section>

                <section class="app-stats__section">
                    <div class="app-stats__section-header">
                    <h2 class="app-stats__title">
                        {{ $t('app.titles.environmentVariables') }}
                    </h2>
                        <v-btn
                            color="primary"
                            variant="tonal"
                            size="small"
                            class="app-stats__reveal"
                            :prepend-icon="showEnvValues ? 'mdi-eye-off' : 'mdi-eye'"
                            @click="showEnvValues = !showEnvValues"
                        >
                            {{ showEnvValues ? $t('app.form.hideEnvValues') : $t('app.form.showEnvValues') }}
                        </v-btn>
                    </div>
                    <v-table class="app-stats__table app-stats__table--code" density="comfortable">
                        <thead>
                        <tr>
                            <th class="text-left">
                            {{ $t('global.name') }}
                            </th>
                            <th class="text-left">
                            {{ $t('global.value') }}
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr
                            v-for="envVar in appData.spec.envVars" :key="envVar.name">
                            <td>{{ envVar.name }}</td>
                            <td>{{ showEnvValues ? envVar.value : '••••••••' }}</td>
                        </tr>
                        </tbody>
                    </v-table>
                </section>

                <section class="app-stats__section" v-if="appData.spec.saAnnotations?.length > 0">
                    <h2 class="app-stats__title">{{ $t('app.titles.serviceAccountAnnotations') }}</h2>
                    <v-table class="app-stats__table app-stats__table--code" density="comfortable">
                        <thead>
                        <tr>
                            <th class="text-left">
                            {{ $t('global.name') }}
                            </th>
                            <th class="text-left">
                            {{ $t('global.value') }}
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr
                            v-for="saAnnotation in appData.spec.saAnnotations" :key="saAnnotation.name">
                            <td>{{ saAnnotation.name }}</td>
                            <td>{{ saAnnotation.value }}</td>
                        </tr>
                        </tbody>
                    </v-table>
                </section>

                <section class="app-stats__section" v-if="appData.spec?.extraVolumes?.length > 0">
                    <h2 class="app-stats__title">{{ $t('app.titles.volumes') }}</h2>
                    <!--{{ appData.spec.extraVolumes }}-->
                    <v-row class="pt-5">
                        <v-col 
                        v-for="volume in appData.spec.extraVolumes" :key="volume.name"
                        cols="12"
                        md="6"
                        >
                            <v-card
                            :title="volume.name"
                            :subtitle="volume.mountPath"
                            class="app-stats__volume uct-card"
                            color="cardBackground"
                            elevation="0"
                            >
                                <v-row>
                                    <v-col class="center" style="width: 40px; flex-grow: 0;">
                                        <v-icon icon="mdi-harddisk" size="60" class="mx-auto"/>
                                    </v-col>
                                    <v-col>
                                        <v-card-text class="pt-0">
                                            <div><b>{{ $t('app.volumes.size') }}: </b>{{ volume.size }}</div>
                                            <div><b>{{ $t('app.volumes.accessMode') }}: </b>{{ volume.accessMode }}</div>
                                        </v-card-text>
                                    </v-col>
                                </v-row>
                            </v-card>
                        </v-col>
                    </v-row>
                </section>

                <section class="app-stats__section">
                    <h2 class="app-stats__title">{{ $t('app.titles.cronjobs') }}</h2>
                    <v-table class="app-stats__table app-stats__table--code" density="comfortable">
                        <thead>
                        <tr>
                            <th class="text-left">
                            {{ $t('app.cronjobs.name') }}
                            </th>
                            <th class="text-left">
                            {{ $t('app.cronjobs.schedule') }}
                            </th>
                            <th class="text-left">
                            {{ $t('app.cronjobs.command') }}
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr
                        v-for="cronjob in appData.spec.cronjobs" :key="cronjob.name">
                            <td>{{ cronjob.name }}</td>
                            <td>{{ cronjob.schedule }}</td>
                            <td>{{ cronjob.command.join(' ') }}</td>
                        </tr>
                        </tbody>
                    </v-table>
                </section>

                <section class="app-stats__section" v-if="appData.spec?.addons?.length > 0">
                    <h2 class="app-stats__title">{{ $t('app.titles.addOns') }}</h2>
                    <Addons :addons="appData.spec.addons" :showButtons="false"/>
                </section>
            </v-sheet>
            
        </v-row>
    </v-container>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'
//import { AppData } from '@/types/appData'
import Addons from './addons.vue'



interface GitRepo {
  admin: boolean;
  clone_url: string;
  ssh_url: string;
}

interface Resources {
  limits: {
    cpu: string;
    memory: string;
  };
  requests: {
    cpu: string;
    memory: string;
  };
}

interface PodSize {
  default: boolean;
  description: string;
  name: string;
  resources: Resources;
}

interface Autoscaling {
  maxReplicas: number;
  minReplicas: number;
  targetCPUUtilizationPercentage: number;
  targetMemoryUtilizationPercentage: number;
}

interface Web {
  autoscaling: Autoscaling;
  replicaCount: number;
}

interface Worker {
  autoscaling: Autoscaling;
  replicaCount: number;
}

interface SecurityContext {
  runAsUser: number;
  runAsGroup: number;
  allowPrivilegeEscalation: boolean;
  readOnlyRootFilesystem: boolean;
  runAsNonRoot: boolean;
  capabilities: {
    add: string[];
    drop: string[];
  };
}

interface Image {
  containerPort: number;
  pullPolicy: string;
  repository: string;
  tag: string;
  fetch: {
    readOnlyAppStorage: boolean;
    repository: string;
    securityContext: SecurityContext;
    tag: string;
  };
  build: {
    command: string;
    readOnlyAppStorage: boolean;
    repository: string;
    securityContext: SecurityContext;
    tag: string;
  };
  run: {
    command: string;
    readOnlyAppStorage: boolean;
    repository: string;
    securityContext: SecurityContext;
    tag: string;
  };
}

interface Host {
  host: string;
  paths: {
    path: string;
    pathType: string;
  }[];
}

interface Ingress {
  annotations: {};
  className: string;
  enabled: boolean;
  hosts: Host[];
  tls: any[];
}

interface ServiceAccount {
  annotations: {};
  create: boolean;
  name: string;
}

interface Spec {
  name: string;
  pipeline: string;
  phase: string;
  buildpack: string;
  deploymentstrategy: string;
  buildstrategy: string;
  gitrepo: GitRepo;
  branch: string;
  autodeploy: boolean;
  podsize: PodSize;
  autoscale: boolean;
  envVars: any[];
  extraVolumes: any[];
  cronjobs: any[];
  addons: any[];
  web: Web;
  worker: Worker;
  affinity: {};
  autoscaling: {
    enabled: boolean;
  };
  fullnameOverride: string;
  image: Image;
  imagePullSecrets: any[];
  ingress: Ingress;
  nameOverride: string;
  nodeSelector: {};
  podAnnotations: {};
  podSecurityContext: {};
  replicaCount: number;
  resources: Resources;
  service: {
    port: number;
    type: string;
  };
  serviceAccount: ServiceAccount;
  tolerations: any[];
}

interface appDataa {
  resourceVersion: string;
  spec: Spec;
}

type appData = {
    resourceVersion: string,
    spec: {
        name: string,
        pipeline: string,
        phase: string,
        buildpack: string,
        deploymentstrategy: string,
        buildstrategy: string,
        gitrepo: GitRepo,
        branch: string,
        autodeploy: boolean,
        podsize: PodSize,
        autoscale: boolean,
        envVars: any[],
        extraVolumes: any[],
        cronjobs: any[],
        addons: any[],
        web: Web,
        worker: Worker,
        affinity: {},
        autoscaling: {
            enabled: boolean,
        },
        fullnameOverride: string,
        image: Image,
        imagePullSecrets: any[],
        ingress: Ingress,
        nameOverride: string,
        nodeSelector: {},
        podAnnotations: {},
        podSecurityContext: {},
        replicaCount: number,
        resources: Resources,
        service: {
            port: number,
            type: string,
        },
        serviceAccount: ServiceAccount,
        tolerations: any[],
    }
}

type Metric = {
    name: string,
    uptime: {
        formatted: string,
        ms: number,
    },
    cpu: {
        percentage: number,
        usage: number,
        unit: string,
    },
    memory: {
        percentage: number,
        usage: number,
        unit: string,
    }
}

export default defineComponent({
    props: {
        pipeline: {
            type: String,
            default: "MISSING"
        },
        phase: {
            type: String,
            default: "MISSING"
        },
        app: {
            type: String,
            default: "new"
        },
        appData: {
            type: Object,
            default: () => {}
        },
        pipelineData : {
            type: Object,
            default: () => {}
        },
    },
    data () {
        return {
            metrics: [] as Metric[],
            metricsDisplay: "bars",
            metricsInterval: 0 as any, // can't find the right type for this
            uptimes: {} as any,
            showEnvValues: false,
        }
    },
    components: {
        Addons,
    },
    mounted() {
        this.loadUptimes();
        this.metricsInterval = setInterval(this.loadMetrics, 40000);
    },
    unmounted() {
        clearInterval(this.metricsInterval);
    },
    methods: {
        loadUptimes() {
            axios.get(`/api/metrics/uptimes/${this.pipeline}/${this.phase}`)
            .then(response => {
                this.uptimes = response.data;
                this.loadMetrics();
            })
            .catch(error => {
                console.log(error);
            });
        },

        loadMetrics() {
            axios.get(`/api/metrics/resources/${this.pipeline}/${this.phase}/${this.app}`)
            .then(response => {
                for (var i = 0; i < response.data.length; i++) {
                    if (response.data[i].cpu.percentage != null && response.data[i].memory.percentage != null) {
                        this.metricsDisplay = "table";
                    }
                    if (
                      (response.data[i].cpu.percentage == null && response.data[i].memory.percentage == null) &&
                      (response.data[i].cpu.usage != null && response.data[i].memory.usage != null)
                     ){
                        this.metricsDisplay = "table";
                    }
                    response.data[i].uptime = this.uptimes[response.data[i].name];
                }
                this.metrics = response.data;
            })
            .catch(error => {
                console.log(error);
            });
        },
    },
});
</script>

<style scoped>
.app-stats {
  padding: 0;
}

.app-stats__surface {
  display: grid;
  gap: 16px;
}

.app-stats__section {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--uct-corp-gray-border);
  border-radius: 12px;
  background: rgb(var(--v-theme-cardBackground));
}

.app-stats__title {
  margin: 0 0 18px;
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1.4;
  text-transform: uppercase;
}

.app-stats__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.app-stats__section-header .app-stats__title {
  margin: 0;
}

.app-stats__reveal {
  flex: 0 0 auto;
  min-height: 40px;
  border-radius: 8px;
  font-weight: 600;
}

.app-stats__table {
  overflow: hidden;
  border: 1px solid var(--uct-corp-gray-border);
  border-radius: 8px;
  background: transparent !important;
}

.app-stats__table :deep(th) {
  height: 46px !important;
  background: rgba(var(--v-theme-secondary), 0.52);
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: 0.6875rem;
  font-weight: 700 !important;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.app-stats__table :deep(td) {
  height: 48px !important;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.app-stats__table :deep(tr:not(:last-child) > *) {
  border-bottom-color: var(--uct-corp-gray-border) !important;
}

.app-stats__table--details :deep(th) {
  width: 34%;
  background: rgba(var(--v-theme-secondary), 0.36);
}

.app-stats__table--code :deep(td) {
  font-family: var(--uct-font-mono);
  font-size: 0.8125rem;
}

.app-stats__domains {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.app-stats__domains a {
  border-radius: 3px;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  text-underline-offset: 3px;
}

.app-stats__domains a:hover {
  text-decoration: underline;
}

.app-stats__domains a:focus-visible,
.app-stats__reveal:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.app-stats__metrics {
  padding: 2px 4px 4px;
}

.app-stats__metrics--table table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.app-stats__metrics--table th,
.app-stats__metrics--table td {
  padding: 8px;
  vertical-align: top;
  text-align: right;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
}

.app-stats__metrics--table th {
  font-size: 0.75rem;
  font-weight: 500;
}

.app-stats__metrics--table th:first-child,
.app-stats__metrics--table td:first-child {
  width: 55%;
  text-align: left;
}

.app-stats__metrics--table tbody tr:nth-child(even) {
  background-color: rgba(var(--v-theme-primary), .04);
}

.app-stats__metrics--table tbody tr:nth-child(odd) {
  background-color: rgba(var(--v-theme-primary), .08);
}

.app-stats__volume {
  height: 100%;
}

.app-stats__volume :deep(.v-card-title) {
  font-size: 0.9375rem;
  font-weight: 600;
}

.app-stats__section :deep(.v-card) {
  box-shadow: none;
}

@media (max-width: 599px) {
  .app-stats__metrics--table th,
  .app-stats__metrics--table td {
    padding: 8px 4px;
  }

  .app-stats__metrics--table th:first-child,
  .app-stats__metrics--table td:first-child {
    width: 40%;
  }

  .app-stats__section {
    padding: 18px 16px;
  }

  .app-stats__section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-stats__reveal {
    width: 100%;
  }

  .app-stats__table--details :deep(th) {
    width: 42%;
  }
}
</style>
