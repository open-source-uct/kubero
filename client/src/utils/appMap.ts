// Arma el "mapa de la app" del Resumen: de qué está hecha una app (acceso
// público, contenedores web y worker con sus pods, addons y tareas programadas)
// y en qué estado está cada pieza, con un motivo que se muestra en palabras.
// Usa solo la configuración de la app y la lista de pods que ya entrega la API.
import { POSTGRES_ADDON_KIND, postgresServiceHost } from './postgresEnv'

export type MapStatus = 'ok' | 'progress' | 'problem' | 'neutral'
// pestaña del detalle donde se revisa el problema
export type MapAction = 'logs' | 'events'
// claves de app.map.reasons.* en las traducciones
export type PodReason = 'ready' | 'starting' | 'notReady' | 'pending' | 'crashLoop' | 'imagePull' | 'configError' | 'stopped'
  | 'noResources' | 'volumePending' | 'unschedulable'

export interface WorkloadContainer {
  name?: string
  image?: string
  restartCount?: number
  ready?: boolean
  started?: boolean
  waitingReason?: string
}

export interface Workload {
  name?: string
  status?: string
  age?: string
  startTime?: string
  containers?: WorkloadContainer[]
  // mensaje de Kubernetes cuando no pudo programar el pod (PodScheduled=False)
  unschedulable?: string
}

// pods de cada addon, de /api/apps/:pipeline/:phase/:app/addons/status
export interface AddonStatus {
  name: string
  kind: string
  pods: Workload[]
}

export interface MapPod {
  name: string
  shortName: string
  status: MapStatus
  reason: PodReason
  // motivo de Kubernetes tal cual, para quien quiera buscarlo
  rawReason: string
  restarts: number
  startedAt: string
  action?: MapAction
}

export interface MapWorkload {
  kind: 'web' | 'worker'
  replicas: number
  ready: number
  status: MapStatus
  pods: MapPod[]
}

export interface MapAccess {
  host: string
  url: string
  status: MapStatus
}

export interface MapAddon {
  name: string
  kind: string
  host: string
  // 'neutral' cuando no se pudo consultar su estado: se muestra solo la configuración
  status: MapStatus
  reason?: PodReason | 'noPods'
  rawReason?: string
  action?: MapAction
}

export interface MapCronjob {
  name: string
  schedule: string
  // la programación en palabras, o null si no es un caso conocido
  description: CronDescription | null
}

export type CronDescription =
  | { kind: 'everyMinute' }
  | { kind: 'everyMinutes'; n: number }
  | { kind: 'hourly'; minute: string }
  | { kind: 'everyHours'; n: number; minute: string }
  | { kind: 'daily'; time: string }
  | { kind: 'weekly'; days: number[]; time: string }
  | { kind: 'monthly'; day: number; time: string }
  | { kind: 'yearly' }

export interface AppMap {
  status: MapStatus
  problems: number
  // de dónde sale el código que corre: imagen o repositorio y rama
  source: { type: 'image' | 'git'; label: string }
  access: MapAccess | null
  workloads: MapWorkload[]
  addons: MapAddon[]
  cronjobs: MapCronjob[]
}

const STARTING = new Set(['ContainerCreating', 'PodInitializing'])
const IMAGE_PULL = new Set(['ImagePullBackOff', 'ErrImagePull', 'InvalidImageName'])
const CONFIG = new Set(['CreateContainerConfigError', 'CreateContainerError'])

export function classifyPod(pod: Workload): Pick<MapPod, 'status' | 'reason' | 'rawReason' | 'action'> {
  const containers = pod.containers ?? []
  const waiting = containers.map((c) => c.waitingReason).filter((r): r is string => Boolean(r))
  const has = (set: Set<string>) => waiting.find((r) => set.has(r))

  if (waiting.includes('CrashLoopBackOff')) return { status: 'problem', reason: 'crashLoop', rawReason: 'CrashLoopBackOff', action: 'logs' }
  const pull = has(IMAGE_PULL)
  if (pull) return { status: 'problem', reason: 'imagePull', rawReason: pull, action: 'events' }
  const config = has(CONFIG)
  if (config) return { status: 'problem', reason: 'configError', rawReason: config, action: 'events' }
  const other = waiting.find((r) => !STARTING.has(r))
  if (other) return { status: 'problem', reason: 'stopped', rawReason: other, action: 'events' }
  if (pod.status === 'Failed') return { status: 'problem', reason: 'stopped', rawReason: 'Failed', action: 'events' }
  // Kubernetes no encuentra dónde ejecutarlo y dice por qué: falta memoria o CPU
  // en el clúster, o el volumen de datos todavía no está enlazado
  if (pod.status === 'Pending' && pod.unschedulable) {
    // sin el agregado "preemption: ..." del planificador, que no ayuda a resolverlo
    const message = pod.unschedulable.replace(/\s*preemption:.*$/is, '').trim()
    if (/PersistentVolumeClaim/i.test(message)) return { status: 'problem', reason: 'volumePending', rawReason: message, action: 'events' }
    if (/Insufficient (cpu|memory)/i.test(message)) return { status: 'problem', reason: 'noResources', rawReason: message, action: 'events' }
    return { status: 'problem', reason: 'unschedulable', rawReason: message, action: 'events' }
  }
  if (waiting.length) return { status: 'progress', reason: 'starting', rawReason: waiting[0] }
  // sin contenedores creados: el pod espera lugar en el clúster
  if (pod.status === 'Pending') return { status: 'progress', reason: 'pending', rawReason: 'Pending', action: 'events' }
  if (containers.length && containers.every((c) => c.ready)) return { status: 'ok', reason: 'ready', rawReason: '' }
  return { status: 'progress', reason: 'notReady', rawReason: '', action: 'logs' }
}

function toPod(app: string, pod: Workload): MapPod {
  const name = pod.name ?? ''
  const prefix = `${app}-kuberoapp-`
  return {
    name,
    shortName: name.startsWith(prefix) ? name.slice(prefix.length) : name,
    restarts: (pod.containers ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0),
    startedAt: pod.startTime ?? pod.age ?? '',
    ...classifyPod(pod),
  }
}

const pad = (value: string) => value.padStart(2, '0')
const NUMBER = /^\d+$/
const STEP = /^\*\/(\d+)$/

// Programación cron en palabras para los casos habituales; null si no se reconoce
// y entonces se muestra la expresión tal cual.
export function describeCron(expression: string): CronDescription | null {
  const text = (expression ?? '').trim().toLowerCase()
  const macros: Record<string, CronDescription> = {
    '@yearly': { kind: 'yearly' }, '@annually': { kind: 'yearly' },
    '@monthly': { kind: 'monthly', day: 1, time: '00:00' },
    '@weekly': { kind: 'weekly', days: [0], time: '00:00' },
    '@daily': { kind: 'daily', time: '00:00' }, '@midnight': { kind: 'daily', time: '00:00' },
    '@hourly': { kind: 'hourly', minute: '00' },
  }
  if (macros[text]) return macros[text]
  const fields = text.split(/\s+/)
  if (fields.length !== 5) return null
  const [minute, hour, dom, month, dow] = fields
  if (month !== '*') return null
  const anyDay = dom === '*' && dow === '*'
  if (anyDay && minute === '*' && hour === '*') return { kind: 'everyMinute' }
  const minuteStep = minute.match(STEP)
  if (anyDay && minuteStep && hour === '*') return { kind: 'everyMinutes', n: Number(minuteStep[1]) }
  if (!NUMBER.test(minute) || Number(minute) > 59) return null
  if (anyDay && hour === '*') return { kind: 'hourly', minute: pad(minute) }
  const hourStep = hour.match(STEP)
  if (anyDay && hourStep) return { kind: 'everyHours', n: Number(hourStep[1]), minute: pad(minute) }
  if (!NUMBER.test(hour) || Number(hour) > 23) return null
  const time = `${pad(hour)}:${pad(minute)}`
  if (anyDay) return { kind: 'daily', time }
  if (dom === '*') {
    const days = new Set<number>()
    for (const part of dow.split(',')) {
      const range = part.match(/^(\d)-(\d)$/)
      if (range) {
        for (let d = Number(range[1]); d <= Number(range[2]); d++) days.add(d % 7)
      } else if (/^\d$/.test(part)) {
        days.add(Number(part) % 7)
      } else {
        return null
      }
    }
    return { kind: 'weekly', days: [...days].sort((a, b) => a - b), time }
  }
  if (dow === '*' && NUMBER.test(dom) && Number(dom) >= 1 && Number(dom) <= 31) return { kind: 'monthly', day: Number(dom), time }
  return null
}

// estado de un addon a partir de sus pods; sin datos, solo su configuración
function addonState(statuses: AddonStatus[] | null, resource: string): Pick<MapAddon, 'status' | 'reason' | 'rawReason' | 'action'> {
  if (!statuses) return { status: 'neutral' }
  const pods = (statuses.find((s) => s.name === resource)?.pods ?? []).map(classifyPod)
  if (!pods.length) return { status: 'progress', reason: 'noPods' }
  const pick = pods.find((p) => p.status === 'problem') ?? pods.find((p) => p.status !== 'ok') ?? pods[0]
  return { status: pick.status, reason: pick.reason, rawReason: pick.rawReason, action: pick.action }
}

function workloadStatus(replicas: number, pods: MapPod[]): MapStatus {
  if (pods.some((p) => p.status === 'problem')) return 'problem'
  if (replicas === 0 && pods.length === 0) return 'neutral'
  const ready = pods.filter((p) => p.status === 'ok').length
  return ready >= replicas && ready > 0 ? 'ok' : 'progress'
}

export function buildAppMap(app: string, spec: any, workloads: Workload[], addonStatuses: AddonStatus[] | null = null): AppMap {
  spec = spec ?? {}
  const result: MapWorkload[] = []
  for (const kind of ['web', 'worker'] as const) {
    const replicas = Number(spec[kind]?.replicaCount ?? (kind === 'web' ? 1 : 0)) || 0
    const pods = workloads
      .filter((w) => (w.name ?? '').startsWith(`${app}-kuberoapp-${kind}-`))
      .map((w) => toPod(app, w))
    // el worker apagado no se muestra; el web siempre, porque es la app
    if (kind === 'worker' && replicas === 0 && pods.length === 0) continue
    result.push({ kind, replicas, ready: pods.filter((p) => p.status === 'ok').length, status: workloadStatus(replicas, pods), pods })
  }

  const web = result.find((w) => w.kind === 'web')
  const ingress = spec.ingress ?? {}
  const host: string = ingress.enabled === false ? '' : ingress.hosts?.[0]?.host ?? ''
  const tls = (ingress.tls ?? []).some((t: any) => (t.hosts ?? []).includes(host))
  const access: MapAccess | null = host
    ? { host, url: `${tls ? 'https' : 'http'}://${host}`, status: !web || web.ready > 0 ? 'ok' : web.status === 'problem' ? 'problem' : 'progress' }
    : null

  const addons: MapAddon[] = (spec.addons ?? []).map((addon: any) => {
    const definition = Object.values(addon?.resourceDefinitions ?? {})[0] as any
    const resource: string = definition?.metadata?.name ?? ''
    return {
      name: addon?.displayName || addon?.id || addon?.kind || resource,
      kind: addon?.kind ?? '',
      host: addon?.kind === POSTGRES_ADDON_KIND && resource ? postgresServiceHost(resource) : resource,
      ...addonState(addonStatuses, resource),
    }
  })

  const cronjobs: MapCronjob[] = (spec.cronjobs ?? []).map((c: any) => ({
    name: c?.name ?? '',
    schedule: c?.schedule ?? '',
    description: describeCron(c?.schedule ?? ''),
  }))

  const git = spec.deploymentstrategy === 'git' && spec.gitrepo
  const repo: string = git ? (spec.gitrepo.clone_url || spec.gitrepo.ssh_url || '') : ''
  const source = git
    ? { type: 'git' as const, label: `${repo.replace(/^.*[/:]([^/]+\/[^/]+?)(\.git)?$/, '$1')}${spec.branch ? ' · ' + spec.branch : ''}` }
    : { type: 'image' as const, label: [spec.image?.repository, spec.image?.tag].filter(Boolean).join(':') }

  const problems = result.reduce((n, w) => n + w.pods.filter((p) => p.status === 'problem').length, 0)
    + addons.filter((a) => a.status === 'problem').length
  const starting = result.some((w) => w.status === 'progress') || addons.some((a) => a.status === 'progress')
  const status: MapStatus = problems ? 'problem' : starting ? 'progress' : 'ok'
  return { status, problems, source, access, workloads: result, addons, cronjobs }
}
