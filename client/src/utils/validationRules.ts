import { parseQuantity } from './podsizeOptions'

export interface ValidationRule {
  key: string
  params?: Record<string, string | number>
  test: (value: unknown) => boolean
  required?: boolean
}

export const empty = (value: unknown): boolean => value == null ||
  (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
const text = (value: unknown) => typeof value === 'string' ? value : ''
export const check = (key: string, test: ValidationRule['test'], params?: ValidationRule['params']): ValidationRule => ({ key, test, params })
const optional = (key: string, test: ValidationRule['test'], params?: ValidationRule['params']) => check(key, value => empty(value) || test(value), params)

export const rules = {
  required: { ...check('required', value => !empty(value)), required: true } as ValidationRule,
  minLength: (min: number) => optional('minLength', value => text(value).length >= min, { min }),
  maxLength: (max: number) => optional('maxLength', value => text(value).length <= max, { max }),
  pattern: (pattern: RegExp, key: string) => optional(key, value => pattern.test(text(value))),
  integer: (min = 0, max = Number.MAX_SAFE_INTEGER) => optional('integer', value => {
    if (typeof value !== 'string' && typeof value !== 'number') return false
    return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max
  }, { min, max }),
  email: optional('email', value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value))),
  url: optional('url', value => {
    try { const url = new URL(text(value)); return /^https?:$/.test(url.protocol) && !!url.hostname && !/\s/.test(text(value)) } catch { return false }
  }),
  domain: optional('domain', value => {
    const host = text(value)
    return host === 'localhost' || host.length <= 253 && host.includes('.') && host.split('.').every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  }),
  quantity: (positive = false) => optional('quantity', value => {
    const number = parseQuantity(typeof value === 'string' ? value : null)
    return number != null && Number.isFinite(number) && (positive ? number > 0 : number >= 0)
  }),
  image: optional('image', value => {
    const input = text(value)
    if (/\s|:\/\//.test(input)) return false
    const [reference, digest, ...extra] = input.split('@')
    if (extra.length || digest !== undefined && !/^[a-z0-9+._-]+:[a-fA-F0-9]+$/.test(digest)) return false
    const colon = reference.lastIndexOf(':')
    const hasTag = colon > reference.lastIndexOf('/')
    const name = hasTag ? reference.slice(0, colon) : reference
    return /^[a-z0-9][a-z0-9._:/-]*$/.test(name) && (!hasTag || /^[\w][\w.-]{0,127}$/.test(reference.slice(colon + 1)))
  }),
  tag: optional('tag', value => /^[\w][\w.-]{0,127}$/.test(text(value))),
  absolutePath: optional('absolutePath', value => text(value).startsWith('/')),
  date: optional('date', value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(text(value)) && Number.isFinite(Date.parse(text(value)))),
  annotation: optional('annotation', value => /^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(text(value))),
  cron: optional('cron', value => validCron(text(value))),
}

export const dnsRules = (max = 60): ValidationRule[] => [rules.required, rules.maxLength(max),
  rules.pattern(/^[a-z0-9-]+$/, 'dnsCharacters'), rules.pattern(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'dnsEdges')]
export const RESERVED_ENV_NAMES = ['PORT', 'PROC_TYPE', 'GIT_REPOSITORY', 'GIT_BRANCH', 'GIT_REF', 'KUBERO_BUILDPACK_DEFAULT_BUILD_CMD', 'KUBERO_BUILDPACK_DEFAULT_RUN_CMD']
export function envRules(names: string[], current: string, reserved = true): ValidationRule[] {
  return [rules.required, rules.maxLength(60), rules.pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'envName'),
    check('unique', () => names.filter(name => name.trim() === current.trim()).length <= 1),
    ...(reserved ? [check('reservedEnv', value => !RESERVED_ENV_NAMES.includes(text(value)))] : [])]
}

// Kubernetes schedules: five fields, lists, inclusive ranges, positive steps and named months/weekdays.
export function validCron(value: string): boolean {
  if (/^@(yearly|annually|monthly|weekly|daily|midnight|hourly)$/.test(value)) return true
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const names: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  return parts.every((part, index) => {
    const [min, max] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]][index]
    const number = (token: string) => /^\d+$/.test(token) ? Number(token) :
      (index === 3 && /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(token) || index === 4 && /^(sun|mon|tue|wed|thu|fri|sat)$/i.test(token) ? names[token.toLowerCase()] : undefined)
    return part.split(',').every(item => {
      const [range, step, ...extra] = item.split('/')
      if (extra.length || step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) return false
      if (range === '*' || range === '?') return true
      const ends = range.split('-').map(number)
      return ends.length <= 2 && ends.every(n => n != null && n >= min && n <= max) && (ends.length === 1 || ends[0]! <= ends[1]!)
    })
  })
}
