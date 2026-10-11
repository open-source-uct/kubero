<template>
  <v-container class="pipelines-page" fluid>


    <header class="pipelines-header">
      <div>
        <h1 class="uct-h1">{{ $t('pipeline.list.title') }}</h1>
        <p>{{ $t('pipeline.list.description') }}</p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        :disabled="!clusterConnected || !canWrite"
        :to="{ name: 'Pipeline Form', params: { pipeline: 'new' } }"
      >
        {{ $t('pipeline.buttons.new') }}
      </v-btn>
    </header>

    <v-alert v-if="!clusterConnected" type="error" variant="tonal" class="mb-6">
      <div class="alert-content">
        <div>
          <strong>{{ $t('pipeline.list.clusterErrorTitle') }}</strong>
          <p>{{ $t('pipeline.list.clusterErrorDescription') }}</p>
        </div>
        <v-btn color="error" variant="outlined" :to="{ name: 'Setup', params: { step: '1' } }">
          {{ $t('pipeline.list.openSetup') }}
        </v-btn>
      </div>
    </v-alert>

    <v-alert v-if="loadError" type="warning" variant="tonal" class="mb-6">
      <div class="alert-content">
        <span>{{ $t('pipeline.list.loadError') }}</span>
        <v-btn color="warning" variant="outlined" size="small" @click="loadPipelinesList">
          {{ $t('pipeline.list.retry') }}
        </v-btn>
      </div>
    </v-alert>

    <section v-if="clusterConnected" class="pipeline-panel">
      <div class="pipeline-toolbar">
        <v-text-field
          v-model="search"
          class="toolbar-search"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          :label="$t('pipeline.list.search')"
        />
        <v-select v-model="teamFilter" :items="teamOptions" density="compact" variant="outlined" hide-details :label="$t('pipeline.list.teamFilter')" />
        <v-select v-model="phaseFilter" :items="phaseOptions" density="compact" variant="outlined" hide-details :label="$t('pipeline.list.phaseFilter')" />
        <v-select v-model="sourceFilter" :items="sourceOptions" density="compact" variant="outlined" hide-details :label="$t('pipeline.list.sourceFilter')" />
        <v-btn
          v-if="hasActiveFilters"
          class="reset-filters"
          variant="text"
          color="primary"
          prepend-icon="mdi-filter-remove-outline"
          @click="resetFilters"
        >
          {{ $t('pipeline.list.clearFilters') }}
        </v-btn>
      </div>

      <div class="table-summary" aria-live="polite">
        <span>{{ resultSummary }}</span>
        <v-chip v-if="hasActiveFilters" size="small" variant="tonal" color="primary" label>{{ $t('pipeline.list.filtered') }}</v-chip>
      </div>

      <div class="pipeline-table-wrap" role="region" tabindex="0" :aria-label="$t('pipeline.list.tableRegionLabel')">
        <v-table class="pipeline-table">
          <thead>
            <tr>
              <th>{{ $t('pipeline.list.columns.pipeline') }}</th>
              <th>{{ $t('pipeline.list.columns.domain') }}</th>
              <th>{{ $t('pipeline.list.columns.teams') }}</th>
              <th>{{ $t('pipeline.list.columns.phases') }}</th>
              <th>{{ $t('pipeline.list.columns.source') }}</th>
              <th class="actions-heading"><span class="sr-only">{{ $t('pipeline.list.columns.actions') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="index in 6" :key="`pipeline-skeleton-${index}`">
                <td colspan="6"><v-skeleton-loader type="list-item" /></td>
              </tr>
            </template>

            <tr v-for="pipeline in paginatedPipelines" v-else :key="pipeline.name">
              <td>
                <div class="pipeline-identity">
                  <v-icon :icon="pipeline.git?.repository?.admin ? 'mdi-source-fork' : 'mdi-source-branch'" color="primary" size="21" aria-hidden="true" />
                  <div>
                    <RouterLink :to="{ name: 'Pipeline Apps', params: { pipeline: pipeline.name } }">{{ pipeline.name }}</RouterLink>
                    <small v-if="pipeline.git?.repository?.description">{{ pipeline.git.repository.description }}</small>
                  </div>
                </div>
              </td>
              <td>
                <span v-if="pipeline.domain" class="domain-value">{{ pipeline.domain }}</span>
                <span v-else class="muted-value">{{ $t('pipeline.list.notConfigured') }}</span>
              </td>
              <td>
                <div v-if="pipeline.access?.teams?.length" class="chip-list">
                  <v-chip v-for="team in pipeline.access.teams.slice(0, 2)" :key="team" size="x-small" variant="outlined" color="primary" label>{{ team }}</v-chip>
                  <v-chip v-if="pipeline.access.teams.length > 2" size="x-small" variant="tonal" label>+{{ pipeline.access.teams.length - 2 }}</v-chip>
                </div>
                <span v-else class="muted-value">{{ $t('pipeline.list.adminOnly') }}</span>
              </td>
              <td>
                <div class="chip-list phases-list">
                  <v-chip
                    v-for="phase in visiblePhases(pipeline)"
                    :key="phase.name"
                    :color="phase.enabled ? 'success' : undefined"
                    :variant="phase.enabled ? 'tonal' : 'outlined'"
                    size="x-small"
                    label
                  >
                    {{ $t(`pipeline.phases.${phase.name}`) }}
                  </v-chip>
                </div>
              </td>
              <td>
                <v-chip size="small" variant="tonal" label>{{ pipeline.git?.repository?.admin ? $t('pipeline.list.managed') : $t('pipeline.list.connected') }}</v-chip>
              </td>
              <td class="actions-cell">
                <v-tooltip :text="$t('pipeline.list.open')" location="top">
                  <template #activator="{ props }">
                    <v-btn v-bind="props" :to="{ name: 'Pipeline Apps', params: { pipeline: pipeline.name } }" icon="mdi-arrow-right" variant="text" color="primary" size="small" :aria-label="$t('pipeline.list.openNamed', { name: pipeline.name })" />
                  </template>
                </v-tooltip>
                <v-tooltip :text="$t('global.edit')" location="top">
                  <template #activator="{ props }">
                    <v-btn v-bind="props" :to="{ name: 'Pipeline Form', params: { pipeline: pipeline.name } }" icon="mdi-pencil-outline" variant="text" size="small" :disabled="!canWrite" :aria-label="$t('pipeline.list.editNamed', { name: pipeline.name })" />
                  </template>
                </v-tooltip>
                <v-tooltip :text="$t('global.delete')" location="top">
                  <template #activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small" :disabled="!canWrite" :loading="deletingName === pipeline.name" :aria-label="$t('pipeline.list.deleteNamed', { name: pipeline.name })" @click="deletePipeline(pipeline.name)" />
                  </template>
                </v-tooltip>
              </td>
            </tr>

            <tr v-if="!loading && !loadError && filteredPipelines.length === 0">
              <td colspan="6">
                <div class="empty-state">
                  <v-icon :icon="pipelines.length === 0 ? 'mdi-source-branch-plus' : 'mdi-filter-off-outline'" size="38" color="primary" aria-hidden="true" />
                  <h2>{{ pipelines.length === 0 ? $t('pipeline.empty.title') : $t('pipeline.list.noResultsTitle') }}</h2>
                  <p>{{ pipelines.length === 0 ? $t('pipeline.empty.description') : $t('pipeline.list.noResultsDescription') }}</p>
                  <v-btn v-if="pipelines.length === 0" color="primary" prepend-icon="mdi-plus" :disabled="!canWrite" :to="{ name: 'Pipeline Form', params: { pipeline: 'new' } }">
                    {{ $t('pipeline.empty.createFirst') }}
                  </v-btn>
                  <v-btn v-else color="primary" variant="outlined" @click="resetFilters">{{ $t('pipeline.list.clearFilters') }}</v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <footer v-if="!loading && filteredPipelines.length > 0" class="table-footer">
        <div class="page-size">
          <span>{{ $t('pipeline.list.rowsPerPage') }}</span>
          <v-select v-model="itemsPerPage" :items="pageSizeOptions" density="compact" variant="outlined" hide-details :aria-label="$t('pipeline.list.rowsPerPage')" />
        </div>
        <v-pagination v-model="page" :length="pageCount" :total-visible="paginationVisible" density="comfortable" :aria-label="$t('pipeline.list.paginationLabel')" />
        <span class="page-range">{{ pageRange }}</span>
      </footer>
    </section>
  </v-container>
</template>

<script lang="ts" setup>
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import Breadcrumbs from '../breadcrumbs.vue'
import { useAuthStore } from '../../stores/auth'
import { useKuberoStore } from '../../stores/kubero'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

type PipelinePhase = { name: string; enabled: boolean }
type Pipeline = {
  name: string
  domain?: string
  access?: { teams?: string[] }
  git?: { repository?: { admin?: boolean; description?: string } }
  phases?: PipelinePhase[]
}

const { t } = useI18n()
const { smAndDown } = useDisplay()
const authStore = useAuthStore()
const kuberoStore = useKuberoStore()
const socket = kuberoStore.kubero.socket as { on?: (event: string, callback: () => void) => void; off?: (event: string, callback: () => void) => void } | undefined

const pipelines = ref<Pipeline[]>([])
const loading = ref(true)
const loadError = ref(false)
const deletingName = ref('')
const search = ref('')
const teamFilter = ref('all')
const phaseFilter = ref('all')
const sourceFilter = ref('all')
const page = ref(1)
const itemsPerPage = ref(10)
const pageSizeOptions = [10, 25, 50]

const breadcrumbItems = [{ title: 'Dashboard.Pipelines', disabled: true, href: '/' }]
const canWrite = computed(() => authStore.hasPermission('pipeline:write'))
const clusterConnected = computed(() => kuberoStore.kubero.kubernetesVersion !== 'unknown')
const paginationVisible = computed(() => smAndDown.value ? 3 : 7)

const teamOptions = computed(() => [
  { title: t('pipeline.list.allTeams'), value: 'all' },
  ...[...new Set(pipelines.value.flatMap((pipeline) => pipeline.access?.teams ?? []))]
    .sort((a, b) => a.localeCompare(b))
    .map((team) => ({ title: team, value: team })),
])

const phaseOptions = computed(() => [
  { title: t('pipeline.list.allPhases'), value: 'all' },
  ...[...new Set(pipelines.value.flatMap((pipeline) => visiblePhases(pipeline).map((phase) => phase.name)))]
    .sort((a, b) => a.localeCompare(b))
    .map((phase) => ({ title: t(`pipeline.phases.${phase}`), value: phase })),
])

const sourceOptions = computed(() => [
  { title: t('pipeline.list.allSources'), value: 'all' },
  { title: t('pipeline.list.managed'), value: 'managed' },
  { title: t('pipeline.list.connected'), value: 'connected' },
])

const hasActiveFilters = computed(() => Boolean(search.value.trim()) || teamFilter.value !== 'all' || phaseFilter.value !== 'all' || sourceFilter.value !== 'all')

const filteredPipelines = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return pipelines.value.filter((pipeline) => {
    const searchable = [pipeline.name, pipeline.domain, pipeline.git?.repository?.description, ...(pipeline.access?.teams ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    const matchesSearch = !query || searchable.includes(query)
    const matchesTeam = teamFilter.value === 'all' || pipeline.access?.teams?.includes(teamFilter.value)
    const matchesPhase = phaseFilter.value === 'all' || visiblePhases(pipeline).some((phase) => phase.name === phaseFilter.value && phase.enabled)
    const isManaged = Boolean(pipeline.git?.repository?.admin)
    const matchesSource = sourceFilter.value === 'all' || (sourceFilter.value === 'managed' ? isManaged : !isManaged)
    return matchesSearch && matchesTeam && matchesPhase && matchesSource
  }).sort((a, b) => a.name.localeCompare(b.name))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredPipelines.value.length / itemsPerPage.value)))
const paginatedPipelines = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return filteredPipelines.value.slice(start, start + itemsPerPage.value)
})
const resultSummary = computed(() => t('pipeline.list.resultCount', { filtered: filteredPipelines.value.length, total: pipelines.value.length }))
const pageRange = computed(() => {
  const start = filteredPipelines.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
  const end = Math.min(page.value * itemsPerPage.value, filteredPipelines.value.length)
  return t('pipeline.list.pageRange', { start, end, total: filteredPipelines.value.length })
})

watch([search, teamFilter, phaseFilter, sourceFilter, itemsPerPage], () => { page.value = 1 })
watch(pageCount, (count) => { if (page.value > count) page.value = count })

function visiblePhases(pipeline: Pipeline) {
  return (pipeline.phases ?? []).filter((phase) => pipeline.git?.repository?.admin || phase.name !== 'review')
}

function resetFilters() {
  search.value = ''
  teamFilter.value = 'all'
  phaseFilter.value = 'all'
  sourceFilter.value = 'all'
}

async function loadPipelinesList() {
  loading.value = true
  loadError.value = false
  try {
    const response = await axios.get('/api/pipelines')
    pipelines.value = Array.isArray(response.data?.items) ? response.data.items : []
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function deletePipeline(pipeline: string) {
  const confirmed = await confirmDestructiveAction({
    title: t('pipeline.list.deleteTitle', { name: pipeline }),
    text: t('pipeline.list.deleteDescription'),
    confirmButtonText: t('global.delete'),
    cancelButtonText: t('global.cancel'),
  })
  if (!confirmed) return

  deletingName.value = pipeline
  try {
    await axios.delete(`/api/pipelines/${encodeURIComponent(pipeline)}`, handledApiErrorConfig)
    pipelines.value = pipelines.value.filter((item) => item.name !== pipeline)
  } catch (error) {
    notifyApiError(error, 'deletePipeline')
  } finally {
    deletingName.value = ''
  }
}

function handlePipelineUpdate() {
  loadPipelinesList()
}

onMounted(() => {
  loadPipelinesList()
  socket?.on?.('updatePipeline', handlePipelineUpdate)
})

onBeforeUnmount(() => {
  socket?.off?.('updatePipeline', handlePipelineUpdate)
})
</script>

<style scoped src="../../styles/resource-list.css"></style>
<style scoped>
.alert-content { display: flex; justify-content: space-between; gap: 24px; align-items: center; }
.alert-content p { margin: 4px 0 0; }
.reset-filters { grid-column: 1 / -1; justify-self: start; }
.pipeline-identity { display: flex; min-width: 220px; gap: 11px; align-items: flex-start; }
.pipeline-identity > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.pipeline-identity a { color: rgb(var(--v-theme-on-cardBackground)); font-size: .875rem; font-weight: 600; text-decoration-color: rgba(var(--v-theme-primary), .45); text-decoration-thickness: 1px; text-underline-offset: 3px; }
.pipeline-identity a:hover { color: rgb(var(--v-theme-primary)); text-decoration-color: currentColor; }
.pipeline-identity small { max-width: 280px; overflow: hidden; color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.domain-value { font-family: var(--uct-font-mono); font-size: .75rem; }
.muted-value { color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; }
.chip-list { display: flex; min-width: 140px; flex-wrap: wrap; gap: 5px; }
.phases-list { min-width: 220px; }
.actions-heading { width: 140px; }
.actions-cell { display: flex; justify-content: flex-end; gap: 2px; white-space: nowrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1050px) {
  .toolbar-search { grid-column: 1 / -1; }
}

@media (max-width: 700px) {
  .toolbar-search { grid-column: auto; }
  .alert-content { align-items: flex-start; flex-direction: column; }
}

</style>
