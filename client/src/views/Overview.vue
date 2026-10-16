<template>
  <v-container class="overview-page" fluid>
    <header class="overview-header">
      <div>
        <h1 class="uct-h1">{{ $t('overview.title') }}</h1>
        <p>{{ $t('overview.description') }}</p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="loadOverview">
        {{ $t('overview.refresh') }}
      </v-btn>
    </header>

    <v-alert v-if="loadError" type="warning" variant="tonal" class="mb-6">
      {{ $t('overview.loadError') }}
    </v-alert>

    <section class="operations-band uct-card" :aria-label="$t('overview.summary')">
      <div class="operations-band__status">
        <span class="status-pulse" :class="{ 'status-pulse--error': !clusterHealthy }" aria-hidden="true"></span>
        <div>
          <span>{{ $t('overview.cluster.title') }}</span>
          <strong>{{ clusterHealthy ? $t('overview.cluster.connected') : $t('overview.cluster.disconnected') }}</strong>
        </div>
      </div>
      <div v-for="metric in metrics" :key="metric.label" class="operations-band__metric">
        <span>{{ metric.label }}</span>
        <v-skeleton-loader v-if="loading" type="text" width="48" />
        <strong v-else>{{ metric.value }}</strong>
      </div>
      <div class="operations-band__updated">
        <span>{{ $t('overview.lastUpdated') }}</span>
        <strong>{{ lastUpdatedLabel }}</strong>
      </div>
    </section>

    <div class="chart-grid">
      <section class="dashboard-panel dashboard-panel--wide uct-card">
        <div class="panel-heading">
          <div>
            <h2>{{ $t('overview.charts.appsByPipeline') }}</h2>
            <p>{{ $t('overview.charts.appsByPipelineDescription') }}</p>
          </div>
          <v-chip size="small" variant="tonal" color="primary" label>
            {{ $t('overview.charts.topPipelines', { count: visiblePipelineRows.length }) }}
          </v-chip>
        </div>
        <div v-if="loading" class="chart-loading"><v-progress-circular indeterminate color="primary" /></div>
        <div v-else-if="hasPipelineData" class="bar-chart" :style="barChartStyle">
          <Bar :data="appsByPipelineData" :options="barOptions" :aria-label="$t('overview.charts.appsByPipeline')" />
        </div>
        <div v-else class="chart-empty"><v-icon icon="mdi-chart-bar" size="30" /><span>{{ $t('overview.charts.noData') }}</span></div>
      </section>

      <section class="dashboard-panel uct-card">
        <div class="panel-heading">
          <div>
            <h2>{{ $t('overview.charts.appsByPhase') }}</h2>
            <p>{{ $t('overview.charts.appsByPhaseDescription') }}</p>
          </div>
        </div>
        <div v-if="loading" class="chart-loading"><v-progress-circular indeterminate color="primary" /></div>
        <div v-else-if="totalApps > 0" class="doughnut-chart">
          <Doughnut :data="appsByPhaseData" :options="doughnutOptions" :plugins="[doughnutCenterPlugin]" :aria-label="$t('overview.charts.appsByPhase')" />
          <div class="doughnut-total" :style="doughnutCenter" aria-hidden="true"><strong>{{ totalApps }}</strong><span>{{ $t('overview.metrics.apps') }}</span></div>
        </div>
        <div v-else class="chart-empty"><v-icon icon="mdi-chart-donut" size="30" /><span>{{ $t('overview.charts.noData') }}</span></div>
      </section>
    </div>

    <section class="dashboard-panel pipeline-inventory uct-card">
      <div class="panel-heading pipeline-inventory__heading">
        <div>
          <h2>{{ $t('overview.inventory.title') }}</h2>
          <p>{{ $t('overview.inventory.description') }}</p>
        </div>
        <v-btn to="/" variant="outlined" color="primary" prepend-icon="mdi-source-branch">
          {{ $t('overview.inventory.openPipelines') }}
        </v-btn>
      </div>

      <div class="pipeline-table-wrap">
        <v-table density="comfortable" class="pipeline-table">
          <thead>
            <tr>
              <th>{{ $t('overview.inventory.pipeline') }}</th>
              <th>{{ $t('overview.inventory.apps') }}</th>
              <th>{{ $t('overview.inventory.phases') }}</th>
              <th>{{ $t('overview.inventory.teams') }}</th>
              <th>{{ $t('overview.inventory.source') }}</th>
              <th><span class="sr-only">{{ $t('overview.inventory.open') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pipeline in pipelineRows" :key="pipeline.name">
              <td>
                <div class="pipeline-name"><v-icon icon="mdi-source-branch" color="primary" size="19" /><span><strong>{{ pipeline.name }}</strong><small>{{ pipeline.domain || $t('overview.unavailable') }}</small></span></div>
              </td>
              <td class="numeric-cell">{{ pipeline.appCount }}</td>
              <td>
                <div class="phase-list">
                  <v-chip v-for="phase in pipeline.phases" :key="phase.name" :color="phase.enabled ? 'success' : undefined" variant="tonal" size="x-small" label>
                    {{ phase.name }} · {{ phase.appCount }}
                  </v-chip>
                </div>
              </td>
              <td>
                <div class="team-list">
                  <v-chip v-for="team in pipeline.teams" :key="team" variant="outlined" color="primary" size="x-small" label>{{ team }}</v-chip>
                  <span v-if="pipeline.teams.length === 0">{{ $t('overview.inventory.adminOnly') }}</span>
                </div>
              </td>
              <td><v-chip variant="tonal" size="small" label>{{ pipeline.managedRepository ? $t('overview.inventory.managedRepository') : $t('overview.inventory.connectedRepository') }}</v-chip></td>
              <td class="text-end">
                <v-btn :to="`/pipeline/${encodeURIComponent(pipeline.name)}/apps`" icon="mdi-arrow-right" variant="text" color="primary" size="small" :aria-label="$t('overview.inventory.openPipeline', { name: pipeline.name })" />
              </td>
            </tr>
            <tr v-if="!loading && pipelineRows.length === 0"><td colspan="6"><div class="table-empty"><v-icon icon="mdi-source-branch" size="28" /><span>{{ $t('overview.inventory.empty') }}</span></div></td></tr>
            <template v-if="loading">
              <tr v-for="index in 3" :key="`skeleton-${index}`"><td colspan="6"><v-skeleton-loader type="list-item" /></td></tr>
            </template>
          </tbody>
        </v-table>
      </div>
    </section>

    <div class="system-grid">
      <section class="dashboard-panel uct-card">
        <div class="panel-heading"><div><h2>{{ $t('overview.cluster.title') }}</h2><p>{{ $t('overview.cluster.description') }}</p></div></div>
        <dl class="status-list">
          <div><dt>{{ $t('overview.cluster.kubernetes') }}</dt><dd>{{ kubero.kubernetesVersion || $t('overview.unavailable') }}</dd></div>
          <div><dt>{{ $t('overview.cluster.operator') }}</dt><dd>{{ kubero.operatorVersion || $t('overview.unavailable') }}</dd></div>
          <div><dt>{{ $t('overview.cluster.kubero') }}</dt><dd>{{ kubero.version || $t('overview.unavailable') }}</dd></div>
        </dl>
      </section>

      <section class="dashboard-panel uct-card">
        <div class="panel-heading"><div><h2>{{ $t('overview.capabilities.title') }}</h2><p>{{ $t('overview.capabilities.description') }}</p></div></div>
        <ul class="capability-list">
          <li v-for="capability in capabilities" :key="capability.label"><span><v-icon :icon="capability.icon" size="19" aria-hidden="true" />{{ capability.label }}</span><v-chip :color="capability.enabled ? 'success' : undefined" variant="tonal" size="small" label>{{ capability.enabled ? $t('overview.enabled') : $t('overview.disabled') }}</v-chip></li>
        </ul>
      </section>
    </div>
  </v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import axios from 'axios'
import { Bar, Doughnut } from 'vue-chartjs'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartData, type ChartOptions, type Plugin } from 'chart.js'
import { useAuthStore } from '@/stores/auth'
import { useKuberoStore } from '@/stores/kubero'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface ApiPhase { name: string; enabled: boolean; apps?: unknown[] }
interface ApiPipeline {
  name: string
  domain?: string
  phases?: ApiPhase[]
  access?: { teams?: string[] }
  git?: { repository?: { admin?: boolean } }
}
interface PipelinePhaseSummary { name: string; enabled: boolean; appCount: number }
interface PipelineRow { name: string; domain: string; appCount: number; phases: PipelinePhaseSummary[]; teams: string[]; managedRepository: boolean }

const { t, locale } = useI18n()
const router = useRouter()
const theme = useTheme()
const authStore = useAuthStore()
const kuberoStore = useKuberoStore()
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const loading = ref(false)
const loadError = ref(false)
const pipelines = ref<PipelineRow[]>([])
const userCount = ref(0)
const teamCount = ref(0)
const lastUpdated = ref<Date | null>(null)
const doughnutCenter = ref({ left: '50%', top: '50%' })
const doughnutCenterPlugin: Plugin<'doughnut'> = {
  id: 'overview-doughnut-center',
  afterLayout(chart) {
    // The legend changes the available plot area, especially when it wraps.
    const { left, right, top, bottom } = chart.chartArea
    doughnutCenter.value = { left: `${(left + right) / 2}px`, top: `${(top + bottom) / 2}px` }
  },
}

const kubero = computed(() => kuberoStore.kubero)
const clusterHealthy = computed(() => Boolean(kubero.value.kubernetesVersion && kubero.value.kubernetesVersion !== 'unknown'))
const pipelineRows = computed(() => [...pipelines.value].sort((a, b) => b.appCount - a.appCount || a.name.localeCompare(b.name)))
const visiblePipelineRows = computed(() => pipelineRows.value.slice(0, 10))
const totalApps = computed(() => pipelines.value.reduce((sum, pipeline) => sum + pipeline.appCount, 0))
const enabledPhaseCount = computed(() => pipelines.value.reduce((sum, pipeline) => sum + pipeline.phases.filter((phase) => phase.enabled).length, 0))
const hasPipelineData = computed(() => visiblePipelineRows.value.length > 0)
const lastUpdatedLabel = computed(() => lastUpdated.value ? new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(lastUpdated.value) : '—')
const barChartStyle = computed(() => ({ height: `${Math.max(260, visiblePipelineRows.value.length * 42)}px` }))

const metrics = computed(() => [
  { label: t('overview.metrics.pipelines'), value: pipelines.value.length },
  { label: t('overview.metrics.apps'), value: totalApps.value },
  { label: t('overview.metrics.activePhases'), value: enabledPhaseCount.value },
  { label: t('overview.metrics.teams'), value: teamCount.value },
  { label: t('overview.metrics.users'), value: userCount.value },
])

const capabilities = computed(() => [
  { label: t('overview.capabilities.templates'), enabled: kubero.value.templatesEnabled, icon: 'mdi-view-grid-outline' },
  { label: t('overview.capabilities.buildPipeline'), enabled: kubero.value.buildPipeline, icon: 'mdi-hammer-wrench' },
  { label: t('overview.capabilities.metrics'), enabled: kubero.value.metricsEnabled, icon: 'mdi-chart-line' },
  { label: t('overview.capabilities.audit'), enabled: kubero.value.auditEnabled, icon: 'mdi-shield-search-outline' },
])

const phaseTotals = computed(() => {
  const totals = new Map<string, number>()
  for (const pipeline of pipelines.value) {
    for (const phase of pipeline.phases) totals.set(phase.name, (totals.get(phase.name) ?? 0) + phase.appCount)
  }
  return [...totals.entries()].filter(([, count]) => count > 0)
})

const appsByPipelineData = computed<ChartData<'bar'>>(() => ({
  labels: visiblePipelineRows.value.map((pipeline) => pipeline.name),
  datasets: [{ label: t('overview.metrics.apps'), data: visiblePipelineRows.value.map((pipeline) => pipeline.appCount), backgroundColor: withAlpha(theme.current.value.colors.primary, .82), borderColor: theme.current.value.colors.primary, borderWidth: 1, borderRadius: 4, barThickness: 20 }],
}))

const appsByPhaseData = computed<ChartData<'doughnut'>>(() => {
  const colors = [theme.current.value.colors.primary, theme.current.value.colors.success, theme.current.value.colors.accent, theme.current.value.colors.info, theme.current.value.colors.warning]
  return { labels: phaseTotals.value.map(([phase]) => phase), datasets: [{ data: phaseTotals.value.map(([, count]) => count), backgroundColor: phaseTotals.value.map((_, index) => withAlpha(colors[index % colors.length], .88)), borderColor: theme.current.value.colors.cardBackground, borderWidth: 3, hoverOffset: 4 }] }
})

const chartTextColor = computed(() => theme.current.value.colors['on-cardBackground'])
const gridColor = computed(() => withAlpha(chartTextColor.value, .11))
const barOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  animation: { duration: reduceMotion ? 0 : 280 },
  plugins: { legend: { display: false }, tooltip: { displayColors: false } },
  scales: {
    x: { beginAtZero: true, ticks: { color: chartTextColor.value, precision: 0 }, grid: { color: gridColor.value } },
    y: { ticks: { color: chartTextColor.value, font: { family: 'Vista Sans, Roboto, sans-serif', weight: 500 } }, grid: { display: false } },
  },
}))
const doughnutOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  animation: { duration: reduceMotion ? 0 : 280 },
  plugins: { legend: { position: 'bottom', labels: { color: chartTextColor.value, usePointStyle: true, pointStyle: 'rectRounded', padding: 16 } } },
}))

function withAlpha(color: string, alpha: number) {
  const value = color.replace('#', '')
  if (value.length !== 6) return color
  const number = Number.parseInt(value, 16)
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`
}

function summarizePipeline(pipeline: ApiPipeline): PipelineRow {
  const phases = (pipeline.phases ?? []).map((phase) => ({ name: phase.name, enabled: phase.enabled, appCount: phase.apps?.length ?? 0 }))
  return {
    name: pipeline.name,
    domain: pipeline.domain ?? '',
    phases,
    appCount: phases.reduce((sum, phase) => sum + phase.appCount, 0),
    teams: pipeline.access?.teams ?? [],
    managedRepository: Boolean(pipeline.git?.repository?.admin),
  }
}

async function loadPipelineDetails(source: ApiPipeline[]) {
  const rows = new Array<PipelineRow>(source.length)
  let cursor = 0
  async function worker() {
    while (cursor < source.length) {
      const index = cursor++
      const pipeline = source[index]
      try {
        const response = await axios.get(`/api/pipelines/${encodeURIComponent(pipeline.name)}/apps`)
        rows[index] = summarizePipeline(response.data ?? pipeline)
      } catch {
        rows[index] = summarizePipeline(pipeline)
        loadError.value = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, source.length) }, () => worker()))
  return rows
}

async function loadOverview() {
  loading.value = true
  loadError.value = false

  const [pipelinesResult, usersResult, groupsResult] = await Promise.allSettled([
    axios.get('/api/pipelines'),
    axios.get('/api/users/count'),
    axios.get('/api/groups'),
  ])

  if (pipelinesResult.status === 'fulfilled') {
    const source = (pipelinesResult.value.data?.items ?? []) as ApiPipeline[]
    pipelines.value = await loadPipelineDetails(source)
  } else {
    pipelines.value = []
    loadError.value = true
  }
  if (usersResult.status === 'fulfilled') userCount.value = Number(usersResult.value.data) || 0
  else loadError.value = true
  if (groupsResult.status === 'fulfilled') teamCount.value = Array.isArray(groupsResult.value.data) ? groupsResult.value.data.length : 0
  else loadError.value = true

  lastUpdated.value = new Date()
  loading.value = false
}

onMounted(() => {
  if (authStore.role !== 'admin') {
    router.replace('/')
    return
  }
  loadOverview()
})
</script>

<style scoped>
.overview-page { max-width: 1440px; padding: 32px 28px 48px; }
.overview-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
.overview-header h1 { margin: 0; }
.overview-header p, .panel-heading p { max-width: 68ch; margin: 6px 0 0; color: rgb(var(--v-theme-on-background)); font-size: .875rem; line-height: 1.55; opacity: .68; }
.operations-band { display: grid; grid-template-columns: minmax(180px, 1.25fr) repeat(5, minmax(100px, .75fr)) minmax(120px, .85fr); margin-bottom: 24px; background: rgb(var(--v-theme-cardBackground)); }
.operations-band > div { min-width: 0; padding: 18px 20px; border-right: 1px solid var(--uct-corp-gray-border); }
.operations-band > div:last-child { border-right: 0; }
.operations-band span { display: block; color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600; letter-spacing: .045em; text-transform: uppercase; opacity: .58; }
.operations-band strong { display: block; margin-top: 4px; color: rgb(var(--v-theme-on-cardBackground)); font-size: 1.25rem; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.2; }
.operations-band__status { display: flex; gap: 12px; align-items: center; }
.operations-band__status strong, .operations-band__updated strong { font-size: .875rem; }
.status-pulse { width: 10px; height: 10px; flex: 0 0 10px; border-radius: 50%; background: rgb(var(--v-theme-success)); box-shadow: 0 0 0 4px rgba(var(--v-theme-success), .12); }
.status-pulse--error { background: rgb(var(--v-theme-error)); box-shadow: 0 0 0 4px rgba(var(--v-theme-error), .12); }
.chart-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, .85fr); gap: 24px; margin-bottom: 24px; }
.dashboard-panel { min-width: 0; padding: 24px; background: rgb(var(--v-theme-cardBackground)); }
.panel-heading { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
.panel-heading h2 { margin: 0; color: rgb(var(--v-theme-on-cardBackground)); font-size: 1rem; font-weight: 600; line-height: 1.4; }
.bar-chart { min-height: 260px; }
.doughnut-chart { position: relative; height: 320px; }
.doughnut-total { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; }
.doughnut-total strong { color: rgb(var(--v-theme-on-cardBackground)); font-size: 1.5rem; line-height: 1.1; }
.doughnut-total span { color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; opacity: .58; }
.chart-loading, .chart-empty { display: flex; min-height: 280px; flex-direction: column; gap: 10px; align-items: center; justify-content: center; color: rgb(var(--v-theme-on-cardBackground)); opacity: .62; }
.pipeline-inventory { margin-bottom: 24px; }
.pipeline-inventory__heading { align-items: center; }
.pipeline-table-wrap { overflow-x: auto; border: 1px solid var(--uct-corp-gray-border); border-radius: 8px; }
.pipeline-table { min-width: 880px; background: transparent; }
.pipeline-table :deep(th) { color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600 !important; letter-spacing: .05em; text-transform: uppercase; opacity: .6; }
.pipeline-table :deep(tbody tr:last-child td) { border-bottom: 0; }
.pipeline-name { display: flex; min-width: 180px; gap: 10px; align-items: center; }
.pipeline-name span { display: flex; min-width: 0; flex-direction: column; }
.pipeline-name strong { color: rgb(var(--v-theme-on-cardBackground)); font-size: .875rem; font-weight: 600; }
.pipeline-name small { max-width: 260px; overflow: hidden; color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; opacity: .58; }
.numeric-cell { font-family: var(--uct-font-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
.phase-list, .team-list { display: flex; min-width: 180px; flex-wrap: wrap; gap: 6px; }
.team-list > span { color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; opacity: .62; }
.table-empty { display: flex; min-height: 120px; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: rgb(var(--v-theme-on-cardBackground)); opacity: .6; }
.system-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.status-list { margin: 0; border-top: 1px solid var(--uct-corp-gray-border); }
.status-list > div { display: flex; justify-content: space-between; gap: 20px; padding: 15px 0; border-bottom: 1px solid var(--uct-corp-gray-border); }
.status-list dt { color: rgb(var(--v-theme-on-cardBackground)); font-size: .8125rem; opacity: .65; }
.status-list dd { margin: 0; color: rgb(var(--v-theme-on-cardBackground)); font-family: var(--uct-font-mono); font-size: .8125rem; font-weight: 500; text-align: right; overflow-wrap: anywhere; }
.capability-list { padding: 0; margin: 0; list-style: none; border-top: 1px solid var(--uct-corp-gray-border); }
.capability-list li { display: flex; justify-content: space-between; gap: 20px; align-items: center; min-height: 52px; border-bottom: 1px solid var(--uct-corp-gray-border); }
.capability-list li > span { display: flex; gap: 10px; align-items: center; color: rgb(var(--v-theme-on-cardBackground)); font-size: .875rem; font-weight: 500; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1100px) {
  .operations-band { grid-template-columns: repeat(4, 1fr); }
  .operations-band > div { border-bottom: 1px solid var(--uct-corp-gray-border); }
  .operations-band > div:nth-child(4n) { border-right: 0; }
  .operations-band > div:nth-last-child(-n+3) { border-bottom: 0; }
  .chart-grid { grid-template-columns: 1fr; }
}

@media (max-width: 759px) {
  .overview-page { padding: 24px 16px 40px; }
  .overview-header { display: block; }
  .overview-header .v-btn { width: 100%; margin-top: 18px; }
  .operations-band { grid-template-columns: repeat(2, 1fr); }
  .operations-band > div:nth-child(2n) { border-right: 0; }
  .operations-band > div:nth-last-child(-n+3) { border-bottom: 1px solid var(--uct-corp-gray-border); }
  .operations-band > div:last-child { border-bottom: 0; }
  .operations-band__status { grid-column: 1 / -1; }
  .dashboard-panel { padding: 20px 16px; }
  .panel-heading { display: block; }
  .panel-heading > .v-chip, .pipeline-inventory__heading > .v-btn { width: 100%; margin-top: 16px; }
  .system-grid { grid-template-columns: 1fr; }
  .doughnut-chart { height: 300px; }
}

@media (prefers-reduced-motion: reduce) {
  .status-pulse { box-shadow: none; }
}
</style>
