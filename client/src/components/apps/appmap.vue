<template>
  <section class="app-map" aria-labelledby="app-map-title">
    <header class="app-map__header">
      <div class="app-map__heading">
        <h2 id="app-map-title" class="app-map__title">{{ t('app.map.title') }}</h2>
        <p class="app-map__description">{{ t('app.map.description') }}</p>
      </div>
      <div class="app-map__legend">
        <span v-for="status in legend" :key="status" class="app-map__legend-item">
          <span class="app-map__dot" :class="`app-map__dot--${status}`" aria-hidden="true"></span>{{ t(`app.map.legend.${status}`) }}
        </span>
        <span v-if="updatedAt" class="app-map__updated">{{ t('app.map.updated', { time: updatedAt }) }}</span>
      </div>
    </header>

    <v-progress-linear v-if="!loaded && !loadError" indeterminate color="primary" height="2" :aria-label="t('app.map.loading')" />
    <p v-if="loadError" class="app-map__notice">{{ t('app.map.loadError') }}</p>

    <div v-if="summary" role="status" class="app-map__summary" :class="`app-map__summary--${map.status}`">
      <v-icon :icon="map.status === 'problem' ? 'mdi-alert-outline' : 'mdi-progress-clock'" size="20" aria-hidden="true" />
      <p><strong>{{ summary.title }}</strong> {{ summary.detail }}</p>
    </div>

    <div class="app-map__scroll">
      <div class="app-map__tree">
        <div class="app-map__root">
          <div class="app-map__node app-map__node--root">
            <span class="app-map__icon" aria-hidden="true"><v-icon icon="mdi-layers-outline" size="20" /></span>
            <div class="app-map__body">
              <span class="app-map__kind">{{ t('app.map.kinds.app') }}</span>
              <span class="app-map__name">{{ app }}</span>
              <span v-if="loaded" class="app-map__status" :class="`app-map__status--${map.status}`">
                <span class="app-map__dot" :class="`app-map__dot--${map.status}`" aria-hidden="true"></span>{{ map.status === 'problem' ? t('app.map.app.problem', map.problems) : t(`app.map.app.${map.status}`) }}
              </span>
            </div>
          </div>
        </div>

        <ul class="app-map__branch">
          <li v-if="map.access" class="app-map__item">
            <div class="app-map__node">
              <span class="app-map__icon" aria-hidden="true"><v-icon icon="mdi-web" size="20" /></span>
              <div class="app-map__body">
                <span class="app-map__kind">{{ t('app.map.kinds.access') }}</span>
                <a class="app-map__name app-map__link" :href="map.access.url" target="_blank" rel="noopener noreferrer" :aria-label="t('app.map.access.open', { host: map.access.host })">
                  {{ map.access.host }}<v-icon icon="mdi-open-in-new" size="14" aria-hidden="true" />
                </a>
                <span v-if="loaded" class="app-map__status" :class="`app-map__status--${map.access.status}`">
                  <span class="app-map__dot" :class="`app-map__dot--${map.access.status}`" aria-hidden="true"></span>{{ t(`app.map.access.${map.access.status}`) }}
                </span>
              </div>
            </div>
          </li>

          <li v-for="workload in map.workloads" :key="workload.kind" class="app-map__item app-map__item--group" :class="{ 'app-map__item--leaf': !workload.pods.length }">
            <div class="app-map__node">
              <span class="app-map__icon" aria-hidden="true"><v-icon :icon="workload.kind === 'web' ? 'mdi-cube-outline' : 'mdi-cog-outline'" size="20" /></span>
              <div class="app-map__body">
                <span class="app-map__kind">{{ t(`app.map.kinds.${workload.kind}`) }}</span>
                <span class="app-map__name app-map__mono" :title="map.source.label">{{ map.source.label || '—' }}</span>
                <span v-if="loaded" class="app-map__status" :class="`app-map__status--${workload.status}`">
                  <span class="app-map__dot" :class="`app-map__dot--${workload.status}`" aria-hidden="true"></span>{{ workloadLabel(workload) }}
                </span>
              </div>
            </div>
            <ul v-if="workload.pods.length" class="app-map__branch">
              <li v-for="pod in workload.pods" :key="pod.name" class="app-map__item">
                <div class="app-map__node app-map__node--pod" :class="{ 'app-map__node--problem': pod.status === 'problem' }">
                  <span class="app-map__icon" aria-hidden="true"><v-icon icon="mdi-square-rounded-outline" size="20" /></span>
                  <div class="app-map__body">
                    <span class="app-map__kind">{{ t('app.map.kinds.pod') }}</span>
                    <span class="app-map__name app-map__mono" :title="pod.name">{{ pod.shortName }}</span>
                    <span class="app-map__status" :class="`app-map__status--${pod.status}`">
                      <span class="app-map__dot" :class="`app-map__dot--${pod.status}`" aria-hidden="true"></span>{{ t(`app.map.reasons.${pod.reason}`) }}
                    </span>
                    <span class="app-map__meta">{{ podDetails(pod) }}</span>
                    <template v-if="pod.action">
                      <p class="app-map__hint">{{ t(`app.map.hints.${pod.reason}`) }}</p>
                      <div v-if="pod.status === 'problem'" class="app-map__actions">
                        <v-btn
                          v-for="(action, index) in podActions(pod.action)"
                          :key="action"
                          size="small"
                          :variant="index === 0 ? 'flat' : 'outlined'"
                          color="primary"
                          @click="emit('navigate', action)"
                        >{{ t(`app.map.actions.${action}`) }}</v-btn>
                      </div>
                    </template>
                  </div>
                </div>
              </li>
            </ul>
          </li>

          <li v-for="addon in map.addons" :key="addon.host || addon.name" class="app-map__item">
            <div class="app-map__node" :class="{ 'app-map__node--problem': addon.status === 'problem' }">
              <span class="app-map__icon" aria-hidden="true"><v-icon :icon="addon.kind === 'KuberoAddonPostgres' ? 'mdi-database-outline' : 'mdi-puzzle-outline'" size="20" /></span>
              <div class="app-map__body">
                <span class="app-map__kind">{{ t('app.map.kinds.addon') }}</span>
                <span class="app-map__name">{{ addon.name }}</span>
                <span class="app-map__status" :class="`app-map__status--${addon.status}`">
                  <span class="app-map__dot" :class="`app-map__dot--${addon.status}`" aria-hidden="true"></span>{{ addonLabel(addon) }}
                </span>
                <span v-if="addon.host" class="app-map__meta">{{ t('app.map.addonHost', { host: addon.host }) }}</span>
                <template v-if="addon.action && addon.reason && addon.reason !== 'noPods'">
                  <p class="app-map__hint">{{ t(`app.map.hints.${addon.reason}`) }}</p>
                  <div v-if="addon.status === 'problem'" class="app-map__actions">
                    <v-btn
                      v-for="(action, index) in podActions(addon.action)"
                      :key="action"
                      size="small"
                      :variant="index === 0 ? 'flat' : 'outlined'"
                      color="primary"
                      @click="emit('navigate', action)"
                    >{{ t(`app.map.actions.${action}`) }}</v-btn>
                  </div>
                </template>
              </div>
            </div>
          </li>

          <li v-for="cronjob in map.cronjobs" :key="cronjob.name" class="app-map__item">
            <div class="app-map__node">
              <span class="app-map__icon" aria-hidden="true"><v-icon icon="mdi-clock-outline" size="20" /></span>
              <div class="app-map__body">
                <span class="app-map__kind">{{ t('app.map.kinds.cronjob') }}</span>
                <span class="app-map__name">{{ cronjob.name }}</span>
                <span class="app-map__status app-map__status--neutral">
                  <span class="app-map__dot app-map__dot--neutral" aria-hidden="true"></span>{{ cronLabel(cronjob) }}
                </span>
                <span v-if="cronjob.description" class="app-map__meta app-map__mono">{{ cronjob.schedule }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import {
  buildAppMap,
  type AddonStatus,
  type MapAction,
  type MapAddon,
  type MapCronjob,
  type MapPod,
  type MapWorkload,
  type Workload,
} from '@/utils/appMap'

const props = defineProps({
  pipeline: { type: String, required: true },
  phase: { type: String, required: true },
  app: { type: String, required: true },
  appData: { type: Object, default: () => ({}) },
  // solo se consulta mientras la pestaña Resumen está a la vista
  active: { type: Boolean, default: true },
  canSeeLogs: { type: Boolean, default: true },
})
const emit = defineEmits<{ (e: 'navigate', tab: MapAction): void }>()
const { t, locale } = useI18n()

const POLL_MS = 15000
const legend = ['ok', 'progress', 'problem', 'neutral'] as const
const pods = ref<Workload[]>([])
// null: no se pudo consultar (o la app no tiene addons) y se muestra solo su configuración
const addonStatuses = ref<AddonStatus[] | null>(null)
const loaded = ref(false)
const loadError = ref(false)
const updatedAt = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let loading = false
let pendingReload = false

const hasAddons = computed(() => ((props.appData as any)?.spec?.addons?.length ?? 0) > 0)
const map = computed(() => buildAppMap(props.app, (props.appData as any)?.spec, pods.value, addonStatuses.value))

const summary = computed(() => {
  if (!loaded.value) return null
  const m = map.value
  if (m.status === 'problem') {
    const detail = m.access?.status === 'ok' ? t('app.map.summary.reachable') : m.access?.status === 'problem' ? t('app.map.summary.down') : ''
    return { title: t('app.map.summary.problem', m.problems), detail }
  }
  if (m.status === 'progress') return { title: t('app.map.summary.progress'), detail: '' }
  return null
})

function workloadLabel(workload: MapWorkload) {
  if (workload.replicas === 0) return t('app.map.noReplicas')
  if (!workload.pods.length) return t('app.map.noPods')
  return t('app.map.replicas', { ready: workload.ready, total: workload.replicas })
}

// reinicios, cuándo partió y, si falla, el motivo de Kubernetes tal cual (sirve para buscarlo)
function podDetails(pod: MapPod) {
  const parts = [t('app.map.restarts', pod.restarts)]
  if (pod.startedAt) parts.push(t('app.map.started', { time: since(pod.startedAt) }))
  if (pod.status === 'problem' && pod.rawReason) parts.push(pod.rawReason)
  return parts.join(' · ')
}

function addonLabel(addon: MapAddon) {
  if (addon.status === 'neutral' || !addon.reason) return t('app.map.addonStatus')
  if (addon.reason === 'noPods') return t('app.map.noPods')
  return t(`app.map.reasons.${addon.reason}`)
}

// nombres de los días en el idioma de la interfaz; 15-11-2026 es domingo (día 0)
function weekdays(days: number[]) {
  const name = new Intl.DateTimeFormat(locale.value, { weekday: 'long' })
  const names = days.map((day) => name.format(new Date(2026, 10, 15 + day)))
  return new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(names)
}

function cronLabel(cronjob: MapCronjob) {
  const d = cronjob.description
  if (!d) return t('app.map.schedule', { schedule: cronjob.schedule })
  if (d.kind === 'weekly') return t('app.map.cron.weekly', { days: weekdays(d.days), time: d.time })
  return t(`app.map.cron.${d.kind}`, d)
}

// la acción recomendada va primero; sin permiso de registros solo quedan los eventos
function podActions(recommended: MapAction): MapAction[] {
  const actions: MapAction[] = recommended === 'logs' ? ['logs', 'events'] : ['events', 'logs']
  return actions.filter((action) => action !== 'logs' || props.canSeeLogs)
}

function since(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - now.value) / 1000)
  if (Number.isNaN(seconds)) return ''
  const format = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return format.format(seconds, 'second')
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour')
  return format.format(Math.round(seconds / 86400), 'day')
}

async function load() {
  // pedida mientras otra consulta sigue en curso: se repite al terminar
  if (loading) {
    pendingReload = true
    return
  }
  loading = true
  const base = `/api/apps/${props.pipeline}/${props.phase}/${props.app}`
  try {
    // el estado de los addons es un extra: si falla, el mapa sigue con los pods de la app
    const [{ data }, addons] = await Promise.all([
      axios.get(`${base}/pods`),
      hasAddons.value ? axios.get(`${base}/addons/status`).then((r) => r.data, () => null) : Promise.resolve(null),
    ])
    pods.value = Array.isArray(data) ? data : []
    addonStatuses.value = Array.isArray(addons) ? addons : null
    loadError.value = false
    loaded.value = true
    now.value = Date.now()
    updatedAt.value = new Date(now.value).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    loadError.value = true
  } finally {
    loading = false
    if (pendingReload && timer) {
      pendingReload = false
      load()
    }
  }
}

function start() {
  if (timer || !props.active || document.hidden) return
  load()
  timer = setInterval(load, POLL_MS)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

const onVisibility = () => (document.hidden ? stop() : start())

watch(() => props.active, (active) => (active ? start() : stop()), { immediate: true })
// la configuración de la app llega después del primer sondeo: si trae addons,
// se consulta su estado de inmediato en vez de esperar la vuelta siguiente
watch(hasAddons, (has) => {
  if (has && timer) load()
})
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.app-map {
  --map-gap: 32px;
  --map-line: rgba(135, 135, 135, 0.45);
  --map-ok: #047857;
  --map-progress: #7A6400;
  --map-problem: #B91C1C;
  --map-neutral: rgba(var(--v-theme-on-cardBackground), 0.72);
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--uct-corp-gray-border);
  border-radius: 12px;
  background: rgb(var(--v-theme-cardBackground));
  color: rgb(var(--v-theme-on-cardBackground));
}

.v-theme--dark .app-map {
  --map-line: rgba(135, 135, 135, 0.5);
  --map-ok: #34D399;
  --map-progress: #EDC500;
  --map-problem: #F87171;
}

.app-map__header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: flex-start;
  justify-content: space-between;
}

.app-map__heading { display: grid; gap: 4px; }

.app-map__title {
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1.4;
  text-transform: uppercase;
}

.app-map__description,
.app-map__notice {
  margin: 0;
  color: var(--map-neutral);
  font-size: 0.875rem;
}

.app-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
  color: var(--map-neutral);
  font-size: 0.75rem;
}

.app-map__legend-item { display: inline-flex; gap: 6px; align-items: center; }

.app-map__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}
.app-map__dot--ok { background: rgb(var(--v-theme-success)); }
.app-map__dot--progress { background: rgb(var(--v-theme-warning)); }
.app-map__dot--problem { background: rgb(var(--v-theme-error)); }
.app-map__dot--neutral { background: var(--uct-corp-gray); }

.app-map__summary {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid rgba(var(--v-theme-warning), 0.55);
  border-radius: 8px;
  background: rgba(var(--v-theme-warning), 0.1);
}
.app-map__summary p { margin: 0; font-size: 0.875rem; }
.app-map__summary .v-icon,
.app-map__summary strong { color: var(--map-progress); }
.app-map__summary--problem {
  border-color: rgba(var(--v-theme-error), 0.45);
  background: rgba(var(--v-theme-error), 0.07);
}
.app-map__summary--problem .v-icon,
.app-map__summary--problem strong { color: var(--map-problem); }

.app-map__scroll { overflow-x: auto; padding-bottom: 4px; }

/* árbol horizontal: las líneas salen de los bordes de cada lista (::before y ::after) */
.app-map__tree { display: flex; align-items: center; min-width: max-content; }

.app-map__root { position: relative; padding-right: var(--map-gap); }
.app-map__root::after {
  position: absolute;
  top: 50%;
  right: 0;
  width: var(--map-gap);
  border-top: 2px solid var(--map-line);
  content: '';
}

.app-map__branch {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0 0 0 var(--map-gap);
  list-style: none;
}

.app-map__item { position: relative; display: flex; align-items: center; }
.app-map__item::before {
  position: absolute;
  top: 50%;
  left: calc(-1 * var(--map-gap));
  width: var(--map-gap);
  border-top: 2px solid var(--map-line);
  content: '';
}
.app-map__item::after {
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: calc(-1 * var(--map-gap));
  border-left: 2px solid var(--map-line);
  content: '';
}
.app-map__item:first-child::after { top: 50%; }
.app-map__item:last-child::after { bottom: 50%; }
.app-map__item:only-child::after { display: none; }

/* un contenedor con pods: la línea sale de su nodo hacia la lista de pods */
.app-map__item--group > .app-map__node { position: relative; margin-right: var(--map-gap); }
.app-map__item--group > .app-map__node::after {
  position: absolute;
  top: 50%;
  right: calc(-1 * var(--map-gap));
  width: var(--map-gap);
  border-top: 2px solid var(--map-line);
  content: '';
}
.app-map__item--leaf > .app-map__node { margin-right: 0; }
.app-map__item--leaf > .app-map__node::after { display: none; }
.app-map__item--group > .app-map__branch { padding-left: 0; }
.app-map__item--group > .app-map__branch > .app-map__item::before,
.app-map__item--group > .app-map__branch > .app-map__item::after { left: 0; }
.app-map__item--group > .app-map__branch > .app-map__item { padding-left: var(--map-gap); }

.app-map__node {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 300px;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--uct-corp-gray-border);
  border-radius: 10px;
  background: rgb(var(--v-theme-cardBackground));
}
.app-map__node--root { width: 220px; border: 2px solid rgb(var(--v-theme-primary)); }
.app-map__node--pod { width: 360px; }
.app-map__node--problem {
  border: 2px solid rgba(var(--v-theme-error), 0.5);
  background: rgba(var(--v-theme-error), 0.06);
}

.app-map__icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.app-map__node--problem .app-map__icon { background: rgba(var(--v-theme-error), 0.12); color: var(--map-problem); }

.app-map__body { display: grid; gap: 3px; min-width: 0; }

.app-map__kind {
  color: var(--map-neutral);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.app-map__name {
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-map__mono { font-family: var(--uct-font-mono); font-size: 0.8125rem; font-weight: 500; }

.app-map__link {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.app-map__link:hover { text-decoration: underline; }
.app-map__link:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; border-radius: 2px; }

/* el punto queda junto a la primera línea aunque el texto ocupe dos */
.app-map__status {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}
.app-map__status > .app-map__dot { margin-top: 0.3em; }
.app-map__status--ok { color: var(--map-ok); }
.app-map__status--progress { color: var(--map-progress); }
.app-map__status--problem { color: var(--map-problem); }
.app-map__status--neutral { color: var(--map-neutral); }

.app-map__meta { color: var(--map-neutral); font-size: 0.75rem; font-weight: 400; }

.app-map__hint { margin: 4px 0 0; font-size: 0.8125rem; line-height: 1.45; white-space: normal; }
.app-map__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }

/* en pantallas angostas el árbol pasa a una lista con sangría */
@media (max-width: 900px) {
  .app-map { padding: 18px 16px; }
  .app-map__tree { flex-direction: column; align-items: stretch; min-width: 0; }
  .app-map__root { padding-right: 0; }
  .app-map__root::after { display: none; }
  .app-map__branch,
  .app-map__item--group > .app-map__branch {
    margin: 12px 0 0 18px;
    padding: 0 0 0 16px;
    border-left: 2px solid var(--map-line);
  }
  .app-map__item { display: block; }
  .app-map__item::after { display: none; }
  .app-map__item::before,
  .app-map__item--group > .app-map__branch > .app-map__item::before {
    top: 26px;
    left: -16px;
    width: 14px;
  }
  .app-map__item--group > .app-map__branch > .app-map__item { padding-left: 0; }
  .app-map__item--group > .app-map__node { margin-right: 0; }
  .app-map__item--group > .app-map__node::after { display: none; }
  .app-map__node,
  .app-map__node--root,
  .app-map__node--pod { width: 100%; }
  .app-map__name { white-space: normal; overflow-wrap: anywhere; }
}

@media (prefers-reduced-motion: reduce) {
  .app-map * { transition: none !important; }
}
</style>
