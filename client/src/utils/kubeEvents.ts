// Eventos de Kubernetes: cuándo ocurrieron y en qué orden mostrarlos.

export type KubeEventTimes = {
  lastTimestamp?: string | null
  eventTime?: string | null
  series?: { lastObservedTime?: string | null } | null
  metadata?: { creationTimestamp?: string | null }
}

// Última vez que ocurrió el evento. Kubernetes junta los repetidos (un
// BackOff que pasa 50 veces) en un solo evento: creationTimestamp es la
// primera vez, y ordenar por ella dejaba al fondo el error que está pasando
// ahora. Cada campo puede faltar según la API que creó el evento.
export function eventTimestamp(event: KubeEventTimes): number {
  for (const value of [
    event.series?.lastObservedTime,
    event.lastTimestamp,
    event.eventTime,
    event.metadata?.creationTimestamp,
  ]) {
    const time = value ? new Date(value).getTime() : NaN
    if (!Number.isNaN(time)) return time
  }
  return 0
}

// Más reciente primero. Antes se comparaba getMilliseconds(), que es solo la
// parte de milisegundos de la hora (0-999), y el orden quedaba al azar.
export function sortEventsNewestFirst<T extends KubeEventTimes>(events: T[]): T[] {
  return [...events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a))
}

// Lo que se necesita del spec de la app para reconocer sus recursos
export type AppSpecNames = {
  addons?: Array<{ resourceDefinitions?: Record<string, { metadata?: { name?: string } } | undefined> }>
  extraVolumes?: Array<{ name?: string; emptyDir?: boolean }>
  cronjobs?: Array<{ name?: string }>
}

// El namespace de una fase es de todo el pipeline: trae los eventos de todas
// sus apps. Esto deja los de una sola, por el nombre de cada recurso suyo.
// Un prefijo "<app>-" no sirve: la app "api" se quedaría con los eventos de
// "api-gateway". Por eso se usan los nombres exactos que define la app:
// - lo que crea el operador: <app>-kuberoapp (Service, Ingress) y
//   <app>-kuberoapp-* (Deployment, ReplicaSet, Pod, HPA)
// - el KuberoApp mismo: <app>
// - cada addon, con su nombre completo (<app>-postgres): el recurso, sus
//   pods (<addon>-0) y el volumen del StatefulSet (data-<addon>-0)
// - los volúmenes de la app, por nombre exacto (el usuario elige el nombre)
// - los cronjobs y sus jobs y pods (<cronjob>-<marca>)
export function appResourceMatcher(app: string, spec?: AppSpecNames | null): (name: string) => boolean {
  const base = `${app}-kuberoapp`
  const addons = (spec?.addons ?? [])
    .flatMap((addon) => Object.values(addon?.resourceDefinitions ?? {}))
    .map((definition) => definition?.metadata?.name)
    .filter((name): name is string => !!name)
  const volumes = (spec?.extraVolumes ?? [])
    .filter((volume) => !volume?.emptyDir)
    .map((volume) => volume?.name)
    .filter((name): name is string => !!name)
  const cronjobs = (spec?.cronjobs ?? []).map((cron) => cron?.name).filter((name): name is string => !!name)

  const isStatefulSetVolume = (name: string, addon: string) => {
    const at = name.lastIndexOf(`-${addon}-`)
    return at > 0 && /^\d+$/.test(name.slice(at + addon.length + 2))
  }

  return (name: string) =>
    name === app ||
    name === base ||
    name.startsWith(`${base}-`) ||
    addons.some((addon) => name === addon || name.startsWith(`${addon}-`) || isStatefulSetVolume(name, addon)) ||
    volumes.includes(name) ||
    cronjobs.some((cron) => name === cron || name.startsWith(`${cron}-`))
}
