<template>
    <v-container class="app-detail-page">
        <Breadcrumbs :items="breadcrumbItems"></Breadcrumbs>

        <header class="app-detail-header">
            <div class="app-detail-identity">
                <div class="app-detail-identity__icon" aria-hidden="true">
                    <v-icon
                        :icon="appData.spec.deploymentstrategy == 'git' ? 'mdi-source-branch' : 'mdi-docker'"
                        color="primary"
                        size="30"
                    ></v-icon>
                </div>
                <div class="app-detail-identity__copy">
                    <h1 class="uct-h1">{{ app }}</h1>
                    <div class="app-detail-meta">
                        <v-chip color="primary" size="small" variant="tonal" label>
                            <v-icon start icon="mdi-source-fork"></v-icon>
                            {{ pipeline }}
                        </v-chip>
                        <v-chip color="primary" size="small" variant="tonal" label>
                            <v-icon start icon="mdi-layers-outline"></v-icon>
                            {{ phase }}
                        </v-chip>
                        <v-chip size="small" variant="outlined" label>
                            {{ appData.spec.deploymentstrategy }}
                        </v-chip>
                    </div>
                </div>
            </div>

            <v-menu location="bottom end">
                <template v-slot:activator="{ props }">
                    <v-btn
                        class="app-detail-actions"
                        color="primary"
                        elevation="0"
                        prepend-icon="mdi-tune-variant"
                        append-icon="mdi-chevron-down"
                        size="large"
                        variant="flat"
                        v-bind="props"
                    >
                        {{ $t('app.actions.name') }}
                    </v-btn>
                </template>
                <v-list class="app-detail-menu uct-card" density="comfortable" nav>
                    <v-list-item
                        @click="ActionEditApp"
                        prepend-icon="mdi-pencil-outline"
                        :disabled="!authStore.hasPermission('app:write')"
                        :title="$t('app.actions.edit')">
                    </v-list-item>
                    <v-list-item
                        @click="ActionOpenApp"
                        prepend-icon="mdi-open-in-new"
                        :title="$t('app.actions.openApp')">
                    </v-list-item>
                    <v-list-item
                        @click="restartApp"
                        prepend-icon="mdi-restart"
                        :disabled="!authStore.hasPermission('reboot:ok')"
                        :title="$t('app.actions.restart')">
                    </v-list-item>
                    <v-list-item
                        :disabled="appData.spec.deploymentstrategy != 'docker'"
                        @click="ActionStartDownload"
                        prepend-icon="mdi-download-outline"
                        :title="$t('app.actions.downloadTemplate')">
                    </v-list-item>
                    <v-list-item
                        @click="openConsole"
                        prepend-icon="mdi-console-line"
                        :disabled="!kubero.consoleEnabled || !authStore.hasPermission('console:ok')"
                        :title="$t('app.actions.openConsole')">
                    </v-list-item>
                    <v-divider class="my-2"></v-divider>
                    <v-list-item
                        class="app-detail-menu__danger"
                        @click="deleteApp"
                        prepend-icon="mdi-delete-outline"
                        :disabled="!authStore.hasPermission('app:write')"
                        :title="$t('app.actions.delete')">
                    </v-list-item>
                </v-list>
            </v-menu>
        </header>

        <nav class="app-detail-tabs" :aria-label="$t('app.nav.overview')">
            <v-tabs v-model="tab" color="primary" show-arrows>
                <v-tab prepend-icon="mdi-view-dashboard-outline">{{ $t('app.nav.overview') }}</v-tab>
                <v-tab prepend-icon="mdi-hammer-wrench" :disabled="!hasBuilds">{{ $t('app.nav.builds') }}</v-tab>
                <v-tab prepend-icon="mdi-chart-line">{{ $t('app.nav.metrics') }}</v-tab>
                <v-tab prepend-icon="mdi-text-box-search-outline" :disabled="!authStore.hasPermission('logs:ok')">{{ $t('app.nav.logs') }}</v-tab>
                <v-tab prepend-icon="mdi-timeline-clock-outline">{{ $t('app.nav.events') }}</v-tab>
                <v-tab prepend-icon="mdi-history">{{ $t('app.nav.audit') }}</v-tab>
            </v-tabs>
        </nav>

        <v-window v-model="tab" class="app-detail-content">
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <Overview :pipeline="pipeline" :phase="phase" :app="app" :appData="appData" :pipelineData="pipelineData"/>
            </v-window-item>
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <Builds :pipeline="pipeline" :phase="phase" :app="app" :appData="appData" :pipelineData="pipelineData"/>
            </v-window-item>
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <Metrics :pipeline="pipeline" :phase="phase" :app="app" :host="appData.spec.ingress.hosts[0].host" :active="tab == 2"/>
            </v-window-item>
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <LogsTab :pipeline="pipeline" :phase="phase" :app="app" :deploymentstrategy="appData.spec.deploymentstrategy" :buildstrategy="appData.spec.buildstrategy" :hasAddons="(appData.spec.addons?.length ?? 0) > 0" :addons="appData.spec.addons ?? []"/>
            </v-window-item>
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <Events :pipeline="pipeline" :phase="phase" :app="app"/>
            </v-window-item>
            <v-window-item :transition="false" :reverse-transition="false" class="background">
                <Audit :pipeline="pipeline" :phase="phase" :app="app"/>
            </v-window-item>
        </v-window>
    </v-container>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'
import Breadcrumbs from "../breadcrumbs.vue";
import Overview from "./overview.vue";
import Events from "./events.vue";
import Audit from "./eventsAudit.vue";
import LogsTab from "./logstab.vue";
import Metrics from "./metrics.vue";
import Builds from "./builds.vue";
import { useKuberoStore } from '../../stores/kubero'
import { mapState } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'
const authStore = useAuthStore();


export default defineComponent({
    name: 'AppDetail',
    setup() {
        return {
            authStore,
        }
    },
    data () {
        return {
            loadingState: false,
            tab: null,
            breadcrumbItems: [
                {
                    title: 'Dashboard.Pipelines',
                    disabled: false,
                    to: { name: 'Pipelines', params: {}}
                },
                {
                    title: 'Pipeline.'+this.pipeline,
                    disabled: false,
                    to: { name: 'Pipeline Apps', params: { pipeline: this.pipeline }}
                },
                {
                    title: 'Phase.'+this.phase,
                    disabled: true,
                    href: `/pipeline/${this.pipeline}/${this.phase}/${this.app}/detail`,
                },
                {
                    title: 'App.'+this.app,
                    disabled: true,
                    href: `/pipeline/${this.pipeline}/${this.phase}/${this.app}/detail`,
                }
            ],
            pipelineData: {},
            appData: {
                spec: {
                    deploymentstrategy: "git",
                    buildstrategy: "plain",
                    ingress: {
                        hosts: [{
                            host: '',
                        }]
                    },
                    addons: [] as unknown[],
                }
            }
        }
    },
    computed: {
      ...mapState(useKuberoStore, ['kubero']),
      hasBuilds() {
        // disable the builds tab if the buildstrategy is plain or external
        return this.appData.spec.deploymentstrategy == 'git' && this.appData.spec.buildstrategy != 'plain' && this.appData.spec.buildstrategy != 'external';
      }
    },
    mounted() {
        this.loadPipeline();
        this.loadApp();
    },
    methods: {
        loadPipeline() {
            axios.get('/api/pipelines/'+this.pipeline).then(response => {
                this.pipelineData = response.data;
            });
        },
        loadApp() {
            axios.get('/api/apps/'+this.pipeline+'/'+this.phase+'/'+this.app).then(response => {
                this.appData = response.data;
                //console.log(this.appData);
            });
        },
        ActionOpenApp() {
            window.open(`https://${this.appData.spec.ingress.hosts[0].host}`, '_blank');
        },
        ActionEditApp() {
            this.$router.push(`/pipeline/${this.pipeline}/${this.phase}/apps/${this.app}`);
        },
        ActionStartDownload() {
            axios.get('/api/apps/'+this.pipeline+'/'+this.phase+'/'+this.app+'/download').then(response => {
                //console.log(response.data);
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', this.app+'.yaml');
                document.body.appendChild(link);
                link.click();
            });
        },
        async deleteApp() {
            const confirmed = await confirmDestructiveAction({
                title: this.$t('app.list.deleteTitle', { name: this.app }),
                text: this.$t('app.list.deleteDescription'),
                confirmButtonText: this.$t('global.delete'),
                cancelButtonText: this.$t('global.cancel'),
            });
            if (confirmed) {
                    axios.delete(`/api/apps/${this.pipeline}/${this.phase}/${this.app}`)
                    .then(response => {
                        // sleep 1 second
                        setTimeout(() => {
                            this.$router.push(`/pipeline/${this.pipeline}/apps`);
                        }, 1000);
                        //console.log("deleteApp", response);
                    })
                    .catch(error => {
                        console.log(error);
                    });
                return;
            }
        },
        async restartApp() {
            axios.get(`/api/apps/${this.pipeline}/${this.phase}/${this.app}/restart`)
            .then(response => {
                //console.log(response);
                this.loadingState = true;
            })
            .catch(error => {
                console.log(error);
            });

            // TODO - this is a hack to wait for the restart to complete. It is not so easy to get the status of the restart.
            await new Promise(r => setTimeout(r, 15000));
            this.loadingState = false;
        },
        openConsole() {
            window.open(`/popup/console/${this.pipeline}/${this.phase}/${this.app}`, '_blank', 'popup=yes,location=no,height=720,width=900,scrollbars=yes,status=no');
        },
    },

    components: {
        Breadcrumbs,
        Events,
        Audit,
        LogsTab,
        Overview,
        Metrics,
        Builds
    },
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
      }
    },
})
</script>

<style scoped>
.app-detail-page {
    max-width: 1320px;
    padding: 24px 28px 48px;
}

.app-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin: 10px 0 24px;
}

.app-detail-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 16px;
}

.app-detail-identity__icon {
    display: grid;
    flex: 0 0 56px;
    width: 56px;
    height: 56px;
    place-items: center;
    border-radius: 14px;
    background: rgba(var(--v-theme-primary), 0.1);
}

.app-detail-identity__copy {
    min-width: 0;
}

.app-detail-identity__copy .uct-h1 {
    margin: 0 0 8px;
    overflow-wrap: anywhere;
}

.app-detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.app-detail-meta :deep(.v-chip) {
    max-width: 100%;
    font-weight: 600;
}

.app-detail-actions {
    min-width: 148px;
    border-radius: 8px;
    font-weight: 600;
}

.app-detail-menu {
    min-width: 260px;
    padding: 8px;
}

.app-detail-menu :deep(.v-list-item) {
    min-height: 44px;
    border-radius: 6px;
}

.app-detail-menu__danger {
    color: rgb(var(--v-theme-error));
}

.app-detail-tabs {
    overflow: hidden;
    border: 1px solid var(--uct-corp-gray-border);
    border-radius: 12px;
    background: rgb(var(--v-theme-cardBackground));
}

.app-detail-tabs :deep(.v-tabs) {
    min-height: 56px;
}

.app-detail-tabs :deep(.v-tab) {
    min-width: 132px;
    min-height: 56px;
    padding-inline: 18px;
    color: rgb(var(--v-theme-on-cardBackground));
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.025em;
    text-transform: none;
}

.app-detail-tabs :deep(.v-tab--selected) {
    background: rgba(var(--v-theme-primary), 0.08);
}

.app-detail-tabs :deep(.v-tab:focus-visible),
.app-detail-actions:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -3px;
}

.app-detail-content {
    margin-top: 20px;
}

@media (max-width: 959px) {
    .app-detail-page {
        padding-inline: 20px;
    }

    .app-detail-header {
        align-items: flex-start;
    }
}

@media (max-width: 599px) {
    .app-detail-page {
        padding: 16px 12px 32px;
    }

    .app-detail-header {
        flex-direction: column;
        gap: 18px;
    }

    .app-detail-identity__icon {
        flex-basis: 48px;
        width: 48px;
        height: 48px;
        border-radius: 12px;
    }

    .app-detail-actions {
        width: 100%;
    }

    .app-detail-tabs :deep(.v-tab) {
        min-width: 116px;
        padding-inline: 14px;
    }
}
</style>

<style>
.v-window__container {
    transition: none !important;
}
canvas {
        transition: none !important;
    }
</style>
