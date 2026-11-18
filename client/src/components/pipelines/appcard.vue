<template>
  <tr v-if="deleted === false" class="app-row">
    <td>
      <div class="app-identity">
        <v-icon
          :icon="app.deploymentstrategy !== 'docker' ? 'mdi-git' : 'mdi-docker'"
          :color="app.deploymentstrategy !== 'docker' ? 'primary' : 'info'"
          size="21"
          aria-hidden="true"
        />
        <div>
          <router-link :to="{ name: 'App Dashboard', params: { pipeline, phase, app: app.name } }">
            {{ app.name }}
          </router-link>
          <small v-if="app.deploymentstrategy !== 'docker'" :title="app.gitrepo.ssh_url">
            {{ app.gitrepo.ssh_url }}
          </small>
          <small v-else :title="`${app.image.repository}:${app.image.tag}`">
            {{ app.image.repository }}:{{ app.image.tag }}
          </small>
        </div>
      </div>
    </td>

    <td>
      <div class="deployment-details">
        <v-chip
          v-if="app.deploymentstrategy !== 'docker'"
          size="x-small"
          label
          variant="tonal"
          color="primary"
          prepend-icon="mdi-source-branch"
        >
          {{ app.branch }}
        </v-chip>
        <v-chip
          v-if="app.deploymentstrategy !== 'docker' && app.commithash"
          size="x-small"
          label
          variant="outlined"
          class="commit-chip"
        >
          {{ app.commithash }}
        </v-chip>
        <span v-if="autodeploy" class="autodeploy-label">
          <v-icon icon="mdi-sync" size="14" aria-hidden="true" />
          {{ $t('app.autodeploy') }}
        </span>
        <v-chip v-if="app.deploymentstrategy === 'docker'" size="x-small" label variant="tonal" color="info">
          {{ app.image.tag }}
        </v-chip>
      </div>
    </td>

    <td>
      <div class="resource-cell">
        <v-progress-linear v-if="loadingState" color="primary" height="2" indeterminate />
        <template v-if="metrics.length">
          <div v-for="metric in metrics" :key="metric.name" class="resource-row">
            <span class="pod-name" :title="metric.name">{{ metric.name }}</span>
            <span v-if="metric.cpu.percentage != null" class="resource-value">
              {{ $t('app.cpu') }} {{ metric.cpu.percentage }}%
            </span>
            <span v-else class="resource-value">
              {{ $t('app.cpu') }} {{ metric.cpu.usage }}{{ metric.cpu.unit }}
            </span>
            <span v-if="metric.memory.percentage != null" class="resource-value">
              {{ $t('app.memory') }} {{ metric.memory.percentage }}%
            </span>
            <span v-else class="resource-value">
              {{ $t('app.memory') }} {{ metric.memory.usage }}{{ metric.memory.unit }}
            </span>
          </div>
        </template>
        <span v-else class="muted-value">{{ $t('app.list.metricsUnavailable') }}</span>
      </div>
    </td>

    <td>
      <div v-if="app.addons.length" class="addon-list">
        <v-tooltip v-for="addon in app.addons" :key="addon.id" :text="addon.displayName" location="top">
          <template #activator="{ props }">
            <v-avatar
              v-bind="props"
              rounded="sm"
              size="28"
              color="secondary"
              :image="addon.icon"
              :aria-label="addon.displayName"
            />
          </template>
        </v-tooltip>
      </div>
      <span v-else class="muted-value">—</span>
    </td>

    <td>
      <div class="actions-cell">
        <!-- cada acción aparece solo si el rol tiene el permiso que exige la API para ella -->
        <v-tooltip v-if="authStore.hasPermission('reboot:ok')" :text="$t('app.actions.restart')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-reload-alert"
              color="primary"
              variant="text"
              size="small"
              :aria-label="`${$t('app.actions.restart')} ${app.name}`"
              @click="restartApp()"
            />
          </template>
        </v-tooltip>
        <v-tooltip v-if="authStore.hasPermission('app:read') || authStore.hasPermission('app:write')" :text="$t('app.nav.overview')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-arrow-right"
              color="primary"
              variant="text"
              size="small"
              :aria-label="`${$t('app.nav.overview')} ${app.name}`"
              :to="{ name: 'App Dashboard', params: { pipeline, phase, app: app.name } }"
            />
          </template>
        </v-tooltip>
        <v-tooltip v-if="authStore.hasPermission('app:write')" :text="$t('app.actions.edit')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              :aria-label="`${$t('app.actions.edit')} ${app.name}`"
              :to="{ name: 'App Form', params: { pipeline, phase, app: app.name } }"
            />
          </template>
        </v-tooltip>
        <v-tooltip v-if="app.ingress.hosts.length" :text="$t('app.actions.openApp')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-open-in-new"
              color="primary"
              variant="text"
              size="small"
              :aria-label="`${$t('app.actions.openApp')} ${app.name}`"
              :href="`//${app.ingress.hosts[0].host}`"
              target="_blank"
              rel="noopener noreferrer"
            />
          </template>
        </v-tooltip>
        <v-tooltip v-if="authStore.hasPermission('app:write')" :text="$t('app.actions.delete')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              size="small"
              :aria-label="`${$t('app.actions.delete')} ${app.name}`"
              @click="deleteApp()"
            />
          </template>
        </v-tooltip>
      </div>
    </td>
  </tr>
</template>

<script lang="ts">
import axios from "axios";
import {  defineComponent } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'
const authStore = useAuthStore();

type Metric = {
    name: string,
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
    setup() {
        return {
            authStore,
        }
    },
    props: {
      pipeline: {
        type: String,
        default: "pipelineName"
      },
      phase: {
        type: String,
        default: "phaseName"
      },
      app: {
        type: Object,
        default: () => ({}),
      },
      gitrepo: {
        type: Object,
        default: () => ({}),
        /*
        default: {
          repository: {
            ssh_url: ""
          },
          webhook: {
            url: ""
          }
        }
        */
      },
      branch: {
        type: String,
        default: "master"
      },
      commithash: {
        type: String,
        default: "c142824f"
      },
      domain: {
        type: String,
      },
      autodeploy: {
        type: Boolean,
        default: false
      }
    },
    data: () => ({
      deleted: false,
      loadingState: false,
      metrics: [] as Metric[],
      metricsDisplay: "dots",
      metricsInterval: 0 as any, // can't find the right type for this "as unknown as NodeJS.Timeout,"
    }),
    mounted() {
        this.loadMetrics();
        this.metricsInterval = setInterval(this.loadMetrics, 40000);
    },
    unmounted() {
        clearInterval(this.metricsInterval);
    },
    methods: {
        async deleteApp() {
          const confirmed = await confirmDestructiveAction({
                title: this.$t('app.list.deleteTitle', { name: this.app.name }),
                text: this.$t('app.list.deleteDescription'),
                confirmButtonText: this.$t('global.delete'),
                cancelButtonText: this.$t('global.cancel'),
            });
            if (confirmed) {
                  axios.delete(`/api/apps/${this.pipeline}/${this.phase}/${this.app.name}`)
                    .then(() => {
                      //this.$router.push(`/pipeline/${this.pipeline}/apps`);
                      //console.log("deleteApp");
                      this.deleted = true;
                      //console.log(response);
                    })
                    .catch(error => {
                      console.log(error);
                    });
                return;
            }
        },
        async restartApp() {
            axios.get(`/api/apps/${this.pipeline}/${this.phase}/${this.app.name}/restart`)
            .then(() => {
                this.loadingState = true;
            })
            .catch(error => {
                console.log(error);
            });

            // TODO - this is a hack to wait for the restart to complete. It is not so easy to get the status of the restart.
            await new Promise(r => setTimeout(r, 15000));
            this.loadingState = false;
        },
        loadMetrics() {
            axios.get(`/api/metrics/resources/${this.pipeline}/${this.phase}/${this.app.name}`)
            .then(response => {
                for (var i = 0; i < response.data.length; i++) {
                    if (response.data[i].cpu.percentage != null && response.data[i].memory.percentage != null) {
                        this.metricsDisplay = "bars";
                    }
                    if (
                      (response.data[i].cpu.percentage == null && response.data[i].memory.percentage == null) &&
                      (response.data[i].cpu.usage != null && response.data[i].memory.usage != null)
                     ){
                        this.metricsDisplay = "table";
                    }
                }
                this.metrics = response.data;
            })
            .catch(error => {
                console.log(error);
            });
        },
    }
});
</script>

<style scoped>
.app-row {
  transition: background-color 140ms ease-out;
}

.app-row:hover {
  background: rgba(var(--v-theme-primary), .045);
}

.app-row > td {
  min-height: 76px;
  padding-right: 12px !important;
  padding-left: 12px !important;
  padding-top: 12px !important;
  padding-bottom: 12px !important;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .8125rem;
  vertical-align: middle;
}

.app-identity {
  display: flex;
  min-width: 180px;
  align-items: flex-start;
  gap: 11px;
}

.app-identity > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.app-identity a {
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .875rem;
  font-weight: 600;
  text-decoration-color: rgba(var(--v-theme-primary), .45);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.app-identity a:hover {
  color: rgb(var(--v-theme-primary));
  text-decoration-color: currentColor;
}

.app-identity small {
  display: block;
  max-width: 220px;
  overflow: hidden;
  color: rgb(var(--v-theme-on-cardBackground));
  font-family: var(--uct-font-mono);
  font-size: .6875rem;
  opacity: .62;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deployment-details {
  display: flex;
  min-width: 120px;
  max-width: 210px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.commit-chip {
  max-width: 112px;
  font-family: var(--uct-font-mono);
}

.commit-chip :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.autodeploy-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .6875rem;
  opacity: .68;
}

.resource-cell {
  display: grid;
  min-width: 210px;
  gap: 5px;
}

.resource-row {
  display: grid;
  grid-template-columns: minmax(78px, 1fr) auto auto;
  gap: 6px;
  align-items: center;
}

.pod-name {
  overflow: hidden;
  font-family: var(--uct-font-mono);
  font-size: .6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-value {
  color: rgb(var(--v-theme-on-cardBackground));
  font-family: var(--uct-font-mono);
  font-size: .6875rem;
  font-variant-numeric: tabular-nums;
  opacity: .72;
  white-space: nowrap;
}

.addon-list {
  display: flex;
  min-width: 60px;
  flex-wrap: wrap;
  gap: 6px;
}

.addon-list .v-avatar {
  background-color: rgba(var(--v-theme-on-cardBackground), .08);
}

.muted-value {
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .75rem;
  opacity: .55;
}

.actions-cell {
  display: flex;
  min-width: 160px;
  justify-content: flex-end;
  gap: 2px;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .app-row {
    transition: none;
  }
}
</style>
