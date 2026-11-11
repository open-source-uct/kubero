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
