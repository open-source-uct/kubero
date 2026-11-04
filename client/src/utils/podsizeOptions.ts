// Opciones de CPU y memoria para los tamaños de pod. Antes se escribían a mano
// ("250m", "0.5Gi"...) y desde #226 esos valores llegan a los contenedores como
// requests y limits: con una lista no se puede escribir una cantidad inválida
// ni una unidad equivocada.

export type PodsizeResources = {
  requests: { cpu: string; memory: string }
  limits: { cpu: string; memory: string }
}

export type QuantityOption = { title: string; value: string }

// hasta 4 núcleos y 8 GiB: más que eso no tiene sentido para una app de curso
// y se acerca a lo que tiene un nodo entero
export const CPU_VALUES = ['50m', '100m', '250m', '500m', '750m', '1', '1500m', '2', '3', '4']
export const MEMORY_VALUES = ['64Mi', '128Mi', '256Mi', '512Mi', '768Mi', '1Gi', '1536Mi', '2Gi', '3Gi', '4Gi', '6Gi', '8Gi']

const QUANTITY = /^\+?(\d+(?:\.\d+)?|\.\d+)(?:[eE]([+-]?\d+))?(m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)?$/

const SUFFIX: Record<string, number> = {
  '': 1,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Ki: 2 ** 10,
  Mi: 2 ** 20,
  Gi: 2 ** 30,
  Ti: 2 ** 40,
  Pi: 2 ** 50,
  Ei: 2 ** 60,
}

// Cantidad de Kubernetes a número: núcleos para CPU, bytes para memoria.
// null si no es una cantidad válida.
export function parseQuantity(quantity: string | undefined | null): number | null {
  const match = QUANTITY.exec(String(quantity ?? '').trim())
  if (!match) return null
  const [, number, exponent, suffix = ''] = match
  return Number(number) * 10 ** Number(exponent ?? 0) * SUFFIX[suffix]
}

const sameQuantity = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9

const trimNumber = (n: number) => String(Number(n.toFixed(3)))

function cpuTitle(value: string): string {
  const cores = parseQuantity(value) ?? 0
  return `${value} (${trimNumber(cores)} ${cores === 1 ? 'core' : 'cores'})`
}

function memoryTitle(value: string): string {
  const bytes = parseQuantity(value) ?? 0
  return bytes >= 2 ** 30 ? `${trimNumber(bytes / 2 ** 30)} GiB` : `${trimNumber(bytes / 2 ** 20)} MiB`
}

// La opción de la lista que vale lo mismo que `current` ("1000m" -> "1",
// "0.5Gi" -> "512Mi"); si no hay ninguna, `current` tal cual.
export function canonicalQuantity(current: string, values: string[]): string {
  const parsed = parseQuantity(current)
  return values.find((value) => sameQuantity(parseQuantity(value), parsed)) ?? current
}

// Opciones del select. Un valor guardado que no está en la lista (un tamaño
// creado antes, a mano) se agrega para que se vea y se pueda conservar.
function options(values: string[], current: string, title: (v: string) => string): QuantityOption[] {
  const items = values.map((value) => ({ title: title(value), value }))
  if (current && !values.includes(current) && parseQuantity(current) !== null) {
    items.push({ title: title(current), value: current })
    items.sort((a, b) => (parseQuantity(a.value) ?? 0) - (parseQuantity(b.value) ?? 0))
  }
  return items
}

export const cpuOptions = (current = '') => options(CPU_VALUES, current, cpuTitle)
export const memoryOptions = (current = '') => options(MEMORY_VALUES, current, memoryTitle)

// Los valores de un tamaño expresados como las opciones de la lista
export function canonicalResources(resources: PodsizeResources): PodsizeResources {
  return {
    requests: {
      cpu: canonicalQuantity(resources.requests.cpu, CPU_VALUES),
      memory: canonicalQuantity(resources.requests.memory, MEMORY_VALUES),
    },
    limits: {
      cpu: canonicalQuantity(resources.limits.cpu, CPU_VALUES),
      memory: canonicalQuantity(resources.limits.memory, MEMORY_VALUES),
    },
  }
}

// Kubernetes rechaza un contenedor cuya reserva supera su límite
export function requestAboveLimit(resources: PodsizeResources): { cpu: boolean; memory: boolean } {
  const above = (request: string, limit: string) => {
    const r = parseQuantity(request)
    const l = parseQuantity(limit)
    return r !== null && l !== null && r > l && !sameQuantity(r, l)
  }
  return {
    cpu: above(resources.requests.cpu, resources.limits.cpu),
    memory: above(resources.requests.memory, resources.limits.memory),
  }
}

export function resourcesComplete(resources: PodsizeResources): boolean {
  return [resources.requests.cpu, resources.requests.memory, resources.limits.cpu, resources.limits.memory].every(
    (value) => parseQuantity(value) !== null,
  )
}
