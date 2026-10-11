<template>
  <v-container class="pipelines-page" fluid>
    <header class="pipelines-header">
      <div>
        <h1 class="uct-h1">{{ $t('navigation.activity') }}</h1>
        <p>{{ $t('activity.description') }}</p>
      </div>
      <v-btn class="activity-button" prepend-icon="mdi-refresh" variant="tonal" color="primary" :loading="loading" @click="loadAudit">{{ $t('activity.refresh') }}</v-btn>
    </header>

    <section class="pipeline-panel">
      <form class="pipeline-toolbar activity-toolbar" @submit.prevent="applyFilters">
        <v-combobox
          v-model="filters.pipeline"
          class="activity-pipeline-filter"
          :items="pipelineSuggestions.items"
          :loading="pipelineSuggestions.loading"
          :error-messages="pipelineSuggestions.error"
          :no-data-text="$t(pipelineSuggestions.loading ? 'activity.loading' : 'activity.noSuggestions')"
          :hide-no-data="false"
          :label="$t('navigation.pipelines')"
          variant="outlined" density="compact" prepend-inner-icon="mdi-magnify"
          clearable hide-details="auto"
          @update:search="pipelineSearch = $event"
        />
        <v-combobox v-model="filters.action" :items="actions" :label="$t('activity.action')" variant="outlined" density="compact" clearable hide-details />
        <v-combobox
          v-model="filters.username"
          :items="usernameSuggestions.items"
          :loading="usernameSuggestions.loading"
          :error-messages="usernameSuggestions.error"
          :no-data-text="$t(usernameSuggestions.loading ? 'activity.loading' : 'activity.noSuggestions')"
          :hide-no-data="false"
          :label="$t('activity.user')"
          variant="outlined" density="compact"
          clearable hide-details="auto"
          @update:search="usernameSearch = $event"
        />
        <v-text-field v-model="filters.from" type="date" :label="$t('activity.from')" variant="outlined" density="compact" hide-details />
        <v-text-field v-model="filters.to" type="date" :label="$t('activity.to')" variant="outlined" density="compact" hide-details />
        <div class="activity-filter-actions">
          <v-btn v-if="hasClearableFilters" class="activity-button" variant="text" color="primary" prepend-icon="mdi-filter-remove-outline" :disabled="loading" @click="resetFilters">{{ $t('activity.clear') }}</v-btn>
          <v-btn class="activity-button" type="submit" color="primary" elevation="0" :disabled="loading">{{ $t('activity.apply') }}</v-btn>
        </div>
      </form>

      <v-alert v-if="error" type="error" variant="tonal" class="ma-4" role="alert">{{ error }}</v-alert>
      <v-alert v-else-if="!enabled" type="info" variant="tonal" class="ma-4">{{ $t('activity.disabled') }}</v-alert>
      <div class="table-summary" role="status" aria-live="polite">
        <span>{{ $t('activity.count', { count }) }}</span>
        <v-chip v-if="hasActiveFilters" size="small" variant="tonal" color="primary" label>{{ $t('pipeline.list.filtered') }}</v-chip>
      </div>
      <v-progress-linear v-if="loading" indeterminate color="primary" :aria-label="$t('activity.loading')" />

      <div v-if="!error && enabled" class="pipeline-table-wrap" role="region" tabindex="0" :aria-label="$t('navigation.activity')">
      <v-table class="pipeline-table activity-table" :aria-busy="loading">
        <thead><tr>
          <th>{{ $t('activity.date') }}</th><th>{{ $t('activity.user') }}</th><th>{{ $t('navigation.pipelines') }}</th><th>{{ $t('activity.action') }}</th><th>{{ $t('activity.details') }}</th>
        </tr></thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in 6" :key="`audit-skeleton-${index}`"><td colspan="5"><v-skeleton-loader type="list-item" /></td></tr>
          </template>
          <tr v-else-if="auditEvents.length === 0"><td colspan="5">
            <div class="empty-state">
              <v-icon icon="mdi-filter-off-outline" size="38" color="primary" aria-hidden="true" />
              <h2>{{ $t('activity.empty') }}</h2>
              <v-btn v-if="hasActiveFilters" color="primary" variant="outlined" @click="resetFilters">{{ $t('activity.clear') }}</v-btn>
            </div>
          </td></tr>
          <tr v-for="event in loading ? [] : auditEvents" :key="event.id">
            <td><time :datetime="event.timestamp">{{ formatDate(event.timestamp) }}</time></td>
            <td>{{ event.users?.username || $t('activity.system') }}</td>
            <td><div class="activity-identity"><v-icon :icon="event.pipeline ? 'mdi-source-branch' : 'mdi-cog-outline'" color="primary" size="21" aria-hidden="true" /><div><strong>{{ event.pipeline || $t('activity.system') }}</strong><div class="text-caption">{{ [event.phase, event.app].filter(Boolean).join(' / ') }}</div></div></div></td>
            <td><v-chip size="small" variant="tonal" label :color="event.action === 'delete' ? 'error' : 'primary'">{{ event.action }}</v-chip><div class="text-caption">{{ event.resource }}</div></td>
            <td>{{ event.message }}</td>
          </tr>
        </tbody>
      </v-table>
      </div>

      <footer v-if="!loading && !error && enabled && count > 0" class="table-footer">
        <div class="page-size"><span>{{ $t('activity.pageSize') }}</span><v-select v-model="limit" :items="[20, 50, 100]" :aria-label="$t('activity.pageSize')" variant="outlined" density="compact" hide-details @update:model-value="changePageSize" /></div>
        <v-pagination v-model="page" :length="pageCount" :total-visible="smAndDown ? 3 : 5" density="comfortable" :aria-label="$t('activity.pages')" @update:model-value="loadAudit" />
        <span class="page-range" role="status">{{ $t('activity.range', { start: count ? (page - 1) * limit + 1 : 0, end: Math.min(page * limit, count), count }) }}</span>
      </footer>
    </section>
  </v-container>
</template>

<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useAuditSuggestions } from '../../composables/useAuditSuggestions'

type AuditEvent = {
  id: number
  timestamp: string
  pipeline: string
  phase: string
  app: string
  action: string
  resource: string
  message: string
  users?: { username: string }
}
const { t, locale } = useI18n()
const { smAndDown } = useDisplay()
const emptyFilters = () => ({ pipeline: '', action: '', username: '', from: '', to: '' })
const filters = reactive(emptyFilters())
const appliedFilters = ref(emptyFilters())
const hasActiveFilters = computed(() => Object.values(appliedFilters.value).some(value => Boolean(value?.trim())))
const hasClearableFilters = computed(() => hasActiveFilters.value || Object.values(filters).some(value => Boolean(value?.trim())))
const pipelineSearch = ref('')
const usernameSearch = ref('')
const pipelineSuggestions = useAuditSuggestions('pipeline', () => pipelineSearch.value)
const usernameSuggestions = useAuditSuggestions('username', () => usernameSearch.value, () => filters.pipeline)
const actions = ['create', 'update', 'delete', 'start', 'stop', 'restart', 'scale', 'rollback', 'promote', 'demote', 'approve', 'reject', 'pause', 'resume', 'deploy', 'undeploy', 'release']
const auditEvents = ref<AuditEvent[]>([])
const loading = ref(false)
const enabled = ref(true)
const error = ref('')
const page = ref(1)
const limit = ref(20)
const count = ref(0)
const pageCount = computed(() => Math.max(1, Math.ceil(count.value / limit.value)))
let request: AbortController | undefined

function dateBoundary(value: string, nextDay = false) {
  const date = new Date(`${value}T00:00:00`)
  if (nextDay) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

async function loadAudit() {
  request?.abort()
  const current = new AbortController()
  request = current
  loading.value = true
  error.value = ''
  try {
    const selected = appliedFilters.value
    const response = await axios.get('/api/audit', { signal: current.signal, params: {
      page: page.value, limit: limit.value,
      pipeline: selected.pipeline?.trim() || undefined,
      action: selected.action?.trim() || undefined,
      username: selected.username?.trim() || undefined,
      from: selected.from ? dateBoundary(selected.from) : undefined,
      to: selected.to ? dateBoundary(selected.to, true) : undefined,
    } })
    if (current.signal.aborted) return
    count.value = response.data.count
    enabled.value = response.data.enabled !== false
    if (page.value > pageCount.value) {
      page.value = pageCount.value
      await loadAudit()
      return
    }
    auditEvents.value = response.data.audit
  } catch (cause) {
    if (current.signal.aborted) return
    auditEvents.value = []
    count.value = 0
    error.value = axios.isAxiosError(cause) && cause.response?.status === 403 ? t('activity.forbidden') : t('activity.error')
  } finally {
    if (request === current) loading.value = false
  }
}

function applyFilters() {
  if (filters.from && filters.to && filters.from > filters.to) {
    error.value = t('activity.invalidDates')
    return
  }
  appliedFilters.value = { ...filters }
  page.value = 1
  void loadAudit()
}

function resetFilters() {
  Object.assign(filters, emptyFilters())
  pipelineSearch.value = ''
  usernameSearch.value = ''
  applyFilters()
}

function changePageSize() {
  page.value = 1
  void loadAudit()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
}

onMounted(loadAudit)
onBeforeUnmount(() => request?.abort())
</script>

<style scoped src="../../styles/resource-list.css"></style>
<style scoped>
.activity-toolbar { grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(150px, 1fr)); align-items: start; }
.activity-filter-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 12px; }
.activity-button { min-width: 180px; height: 40px; border-radius: 8px; }
.activity-table :deep(td) { overflow-wrap: anywhere; }
.activity-table :deep(td:last-child) { min-width: 240px; }
.activity-table time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.activity-identity { display: flex; min-width: 220px; gap: 11px; align-items: flex-start; }
.activity-identity strong { font-size: .875rem; font-weight: 600; }
@media (max-width: 1100px) {
  .activity-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .activity-pipeline-filter { grid-column: 1 / -1; }
}
@media (max-width: 700px) {
  .activity-toolbar { grid-template-columns: minmax(0, 1fr); }
  .activity-filter-actions .activity-button { flex: 1 1 180px; }
}
</style>
