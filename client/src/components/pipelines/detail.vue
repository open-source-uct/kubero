<template>
  <v-container class="apps-page" fluid>
    <Breadcrumbs :items="breadcrumbItems" />

    <header class="apps-header">
      <div>
        <h1 class="uct-h1">{{ $t('app.list.title', { pipeline }) }}</h1>
        <p>{{ $t('app.list.description') }}</p>
      </div>
      <v-btn
        v-if="authStore.hasPermission('pipeline:write')"
        color="primary"
        prepend-icon="mdi-pencil-outline"
        :to="{ name: 'Pipeline Form', params: { pipeline } }"
      >
        {{ $t('pipeline.buttons.edit') }}
      </v-btn>
    </header>

    <div class="phase-list">
      <section
        v-if="loading"
        class="app-panel"
        aria-busy="true"
        :aria-label="$t('app.list.loading')"
      >
        <header class="phase-header" aria-hidden="true">
          <span class="phase-title-skeleton" />
          <span class="phase-action-skeleton" />
        </header>

        <div class="app-table-wrap">
          <v-table class="app-table">
            <thead>
              <tr>
                <th>{{ $t('app.list.columns.application') }}</th>
                <th>{{ $t('app.list.columns.deployment') }}</th>
                <th>{{ $t('app.list.columns.resources') }}</th>
                <th>{{ $t('app.list.columns.addons') }}</th>
                <th class="actions-heading"><span class="sr-only">{{ $t('app.actions.name') }}</span></th>
              </tr>
            </thead>
            <tbody aria-hidden="true">
              <tr v-for="row in 6" :key="`app-skeleton-${row}`" class="app-skeleton-row">
                <td v-for="column in 5" :key="column">
                  <span class="cell-skeleton" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </section>

      <template v-else>
      <section v-for="phase in activePhases" :key="phase.name" class="app-panel">
        <header class="phase-header">
          <div class="phase-identity">
            <span class="uct-section-title">{{ $t(`pipeline.phases.${phase.name}`) }}</span>
            <v-chip label size="x-small" color="primary" variant="tonal">
              <v-icon icon="mdi-kubernetes" start size="small" />
              {{ phase.context }}
            </v-chip>
          </div>
          <v-btn
            v-if="authStore.hasPermission('app:write')"
            variant="tonal"
            prepend-icon="mdi-plus"
            :to="{ name: 'App Form', params: { phase: phase.name, pipeline, app: 'new' } }"
            color="primary"
            size="small"
          >
            {{ $t('app.buttons.new') }}
          </v-btn>
        </header>

        <div
          class="app-table-wrap"
          role="region"
          tabindex="0"
          :aria-label="$t('app.list.tableRegionLabel', { phase: $t(`pipeline.phases.${phase.name}`) })"
        >
          <v-table class="app-table">
            <thead>
              <tr>
                <th>{{ $t('app.list.columns.application') }}</th>
                <th>{{ $t('app.list.columns.deployment') }}</th>
                <th>{{ $t('app.list.columns.resources') }}</th>
                <th>{{ $t('app.list.columns.addons') }}</th>
                <th class="actions-heading"><span class="sr-only">{{ $t('app.actions.name') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <Appcard
                v-for="app in phase.apps"
                :key="app.name"
                :pipeline="pipeline"
                :phase="phase.name"
                :app="app"
              />
              <tr v-if="phase.apps.length === 0">
                <td colspan="5">
                  <div class="phase-empty-state">
                    <v-icon icon="mdi-cube-outline" color="primary" size="30" aria-hidden="true" />
                    <span>{{ $t('app.list.emptyPhase') }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <div v-if="phase.name === 'review' && pullrequests.length" class="review-section">
          <h2>{{ $t('app.list.availablePullRequests') }}</h2>
          <div class="review-grid">
            <PRcard
              v-for="pr in pullrequests"
              :key="pr.number"
              :pipeline="pipeline"
              :pullrequest="pr"
            />
          </div>
        </div>
      </section>
      </template>
    </div>
  </v-container>
</template>

<script lang="ts">
import axios from "axios";
import Appcard from "./appcard.vue";
import PRcard from "./prcard.vue";
import Breadcrumbs from "../breadcrumbs.vue";
import { useKuberoStore } from '../../stores/kubero'
import { useAuthStore } from '../../stores/auth'
const authStore = useAuthStore();

import { reactive, ref, defineComponent } from 'vue'

type Phase = {
    name: string,
    context: string,
    enabled: boolean,
    apps: Array<App>,
}

type App = {
    name: string,
    enabled: boolean,
    autodeploy: boolean,
}

type Git = {
    ssh_url: string,
    provider: string,
}

type Pullrequest = {
    number: number,
    branch: string,
    title: string,
    ssh_url: string,
    created_at: string,
    updated_at: string,
}
const socket = useKuberoStore().kubero.socket as any;

const phases = ref([] as Array<Phase>);
const reviewapps = ref(false);
const git = reactive({} as Git);
const pullrequests = ref([] as Array<Pullrequest>);
const pipelineName = ref("");
const loading = ref(true);


async function loadPipeline() {
    loading.value = true;
    return axios.get('/api/pipelines/' + pipelineName.value + '/apps')
    .then(response => {
        //console.log("loadPipeline Phases", response.data.phases);
        phases.value = response.data.phases;
        reviewapps.value = response.data.reviewapps;
        git.ssh_url = response.data.git.repository.ssh_url;
        git.provider = response.data.git.provider;
        if (reviewapps.value) {
            loadPullrequests();
        }
        return response.data.phases;
    })
    .catch(error => {
        console.log(error);
    })
    .finally(() => {
        loading.value = false;
    });
}

async function loadPullrequests() {
    if (git.provider == "") {
        return;
    }

    const gitrepoB64 = btoa(git.ssh_url);

    axios.get('/api/repo/'+git.provider+'/' + gitrepoB64 + '/pullrequests')
    .then(response => {

        pullrequests.value = [] as Array<Pullrequest>;

        // iterate over response.data and search in phases[0].name for a match
        // if not found, add the pullrequest to the phase.apps array
        response.data.forEach((pr: Pullrequest) => {
            let found = false;
            phases.value[0].apps.forEach((app: App) => {
                console.log(app.name, pr.branch);
                if (app.name == pr.branch) {
                    found = true;
                }
            });
            if (!found) {
                pullrequests.value.push(pr);
            }
        });

        //pullrequests.value = response.data;
        return response.data;
    })
    .catch(error => {
        console.log(error);
    });
}

socket.on('deleteApp', async () => {
    //console.log("deleteApp", instances);
    // sleep 1 second to give the app time to start
    await new Promise(r => setTimeout(r, 1000));
    loadPipeline();
});

socket.on('updatedApps', async (instances: Array<App>) => {
    console.log("updatedApps", instances);
    // sleep 1 second to give the app time to start
    await new Promise(r => setTimeout(r, 1000));
    loadPipeline();
});


export default defineComponent({
    setup(props) {
        pipelineName.value = props.pipeline;
        return {
            phases,
            reviewapps,
            git,
            pullrequests,
            authStore,
            loading,
        }
    },
    mounted() {
        loadPipeline();
    },
    unmounted() {
        socket.off('deleteApp');
        socket.off('updatedApps');

        // empty the phases array
        phases.value = [] as Array<Phase>;
        pullrequests.value = [] as Array<Pullrequest>;
        loading.value = true;
    },
    props: {
      pipeline: {
        type: String,
        default: "MISSING"
      },
    },
    data () {return {
        breadcrumbItems: [
            {
                label: 'breadcrumbs.dashboard',
                textKey: 'navigation.pipelines',
                disabled: false,
                to: { name: 'Pipelines', params: {}}
            },
            {
                label: 'breadcrumbs.pipeline',
                text: this.pipeline,
                disabled: true,
                to: { name: 'Pipeline Apps', params: { pipeline: this.pipeline }}
            }
        ],
    }},
    computed: {
        activePhases() {
            let phases = [] as Array<Phase>;
            if (this.phases) {
                this.phases.forEach((phase: Phase) => {
                    if (phase.enabled) {
                        phases.push(phase);
                    }
                });
            }
            return phases;
        }
    },
    components: {
        PRcard,
        Appcard,
        Breadcrumbs,
    },
    
    methods: {
        loadPipeline,
        loadPullrequests,
    },
})
</script>

<style scoped>
.apps-page {
  max-width: 1440px;
  padding: 28px 28px 48px;
}

.apps-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin: 10px 0 24px;
}

.apps-header h1 {
  margin: 0;
}

.apps-header p {
  max-width: 70ch;
  margin: 6px 0 0;
  color: rgb(var(--v-theme-on-background));
  font-size: .875rem;
  line-height: 1.55;
  opacity: .68;
}

.phase-list {
  display: grid;
  gap: 24px;
}

.app-panel {
  overflow: hidden;
  border: 1px solid var(--uct-corp-gray-border);
  border-radius: 8px;
  background: rgb(var(--v-theme-cardBackground));
}

.phase-header {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--uct-corp-gray-border);
}

.phase-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.app-table-wrap {
  overflow: hidden;
}

.app-table {
  min-width: 900px;
  background: transparent;
}

.app-table :deep(.v-table__wrapper) {
  overflow-x: auto;
}

.app-table :deep(th) {
  height: 44px !important;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .6875rem;
  font-weight: 600 !important;
  letter-spacing: .05em;
  text-transform: uppercase;
  opacity: .62;
}

.actions-heading {
  width: 180px;
}

.phase-title-skeleton {
  width: 180px;
  height: 14px;
}

.phase-action-skeleton {
  width: 112px;
  height: 36px;
}

.phase-title-skeleton,
.phase-action-skeleton,
.cell-skeleton {
  display: block;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-cardBackground), .12);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.cell-skeleton {
  width: 100%;
  height: 12px;
}

.app-skeleton-row {
  height: 64px;
}

.app-skeleton-row .cell-skeleton {
  max-width: 180px;
}

.app-skeleton-row td:nth-child(2) .cell-skeleton,
.app-skeleton-row td:nth-child(4) .cell-skeleton {
  max-width: 92px;
}

.app-skeleton-row td:last-child .cell-skeleton {
  max-width: 140px;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: .5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .phase-title-skeleton,
  .phase-action-skeleton,
  .cell-skeleton {
    animation: none;
  }
}

.phase-empty-state {
  display: flex;
  min-height: 140px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .875rem;
  opacity: .68;
}

.review-section {
  padding: 20px;
  border-top: 1px solid var(--uct-corp-gray-border);
}

.review-section h2 {
  margin: 0 0 12px;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .875rem;
  font-weight: 600;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 700px) {
  .apps-page {
    padding: 20px 14px 36px;
  }

  .apps-header {
    align-items: stretch;
    flex-direction: column;
  }

  .apps-header .v-btn,
  .phase-header .v-btn {
    align-self: flex-start;
  }

  .phase-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 16px;
  }

}
</style>
