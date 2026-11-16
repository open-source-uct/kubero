import { check, dnsRules, empty, rules, type ValidationRule } from '../utils/validationRules'
import { validationRowId, type ValidationFieldDefinition } from '../composables/useFormValidation'
interface Annotation { annotation: string; value: string }
interface Volume { name: string; size: string; mountPath: string; accessModes: string[] }
interface Cron { name: string; schedule: string; image: string; command: string }
export interface AdvancedAppModel {
  basicAuth: { enabled: boolean; realm: string; accounts: { user: string; pass: string }[] }
  security: { runAsUser: unknown; runAsGroup: unknown; runAsNonRoot: boolean }
  autoscale: boolean; webreplicas: unknown; workerreplicas: unknown; webreplicasrange: number[]; workerreplicasrange: number[]
  healthcheck: { enabled: boolean; path: string; startupSeconds: unknown; timeoutSeconds: unknown; periodSeconds: unknown }
  extraVolumes: Volume[]; cronjobs: Cron[]; customIngressAnnotations: Annotation[]; sAAnnotations: Annotation[]
  annotations?: Record<string, unknown>
}
export function advancedAppFields(model: AdvancedAppModel, t: (key: string) => string, reveal: (panel: number) => void): ValidationFieldDefinition[] {
  const fields: ValidationFieldDefinition[] = []
  const add = (id: string, label: string, value: unknown, checks: ValidationRule[], panel: number, active = true) => {
    fields.push({ id, label: t(label), value, rules: checks, active, reveal: () => reveal(panel) })
  }
  add('auth-realm', 'app.form.basicAuthRealm', model.basicAuth.realm, [rules.required], 1, model.basicAuth.enabled)
  model.basicAuth.accounts.forEach(account => {
    const id = validationRowId(account)
    add('auth-user-' + id, 'app.form.basicAuthUser', account.user, [rules.required, check('unique', () => model.basicAuth.accounts.filter(other => other.user === account.user).length <= 1)], 1, model.basicAuth.enabled)
    add('auth-pass-' + id, 'app.form.basicAuthPass', account.pass, [rules.required], 1, model.basicAuth.enabled)
  })
  // Without an account, point to the realm so the summary opens the basic-auth section.
  if (model.basicAuth.enabled && !model.basicAuth.accounts.length) add('auth-realm', 'app.form.basicAuthUser', '', [rules.required], 1)
  add('uid', 'app.form.runAsUser', model.security.runAsUser, [rules.required, rules.integer(0, 4294967295), check('nonRoot', value => !model.security.runAsNonRoot || Number(value) > 0)], 2)
  add('gid', 'app.form.runAsGroup', model.security.runAsGroup, [rules.required, rules.integer(0, 4294967295)], 2)
  for (const key of ['web', 'worker'] as const) {
    const label = key === 'web' ? 'app.webReplicas' : 'app.workerReplicas'
    const range = model[key === 'web' ? 'webreplicasrange' : 'workerreplicasrange']
    add(key + '-replicas', label, model[key === 'web' ? 'webreplicas' : 'workerreplicas'], [rules.required, rules.integer(0)], 7, !model.autoscale)
    add(key + '-range', label, range, [rules.required, check('replicas', () => range.length === 2 && range.every(value => rules.integer(0).test(value)) && range[0] <= range[1])], 7, model.autoscale)
  }
  for (const key of ['path', 'startupSeconds', 'timeoutSeconds', 'periodSeconds'] as const) {
    const label = { path: 'app.form.healthCheckPath', startupSeconds: 'app.form.healthCheckStartupSeconds', timeoutSeconds: 'app.form.healthcheckTimeoutSeconds', periodSeconds: 'app.form.healthCheckIntervalSeconds' }[key]
    add('health-' + key, label, model.healthcheck[key], [rules.required, key === 'path' ? rules.absolutePath : rules.integer(1)], 10, model.healthcheck.enabled)
  }
  model.extraVolumes.forEach(volume => {
    const id = validationRowId(volume)
    add('volume-name-' + id, 'global.name', volume.name, [...dnsRules(63), check('unique', () => model.extraVolumes.filter(other => other.name === volume.name).length <= 1)], 8)
    add('volume-size-' + id, 'global.size', volume.size, [rules.required, rules.quantity(true)], 8)
    add('volume-path-' + id, 'app.form.mountPath', volume.mountPath, [rules.required, rules.absolutePath], 8)
    add('volume-mode-' + id, 'app.form.accessMode', volume.accessModes?.[0], [rules.required, check('selected', value => ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'].includes(String(value)))], 8)
  })
  model.cronjobs.forEach(cron => {
    const id = validationRowId(cron)
    add('cron-name-' + id, 'global.name', cron.name, [...dnsRules(52), check('unique', () => model.cronjobs.filter(other => other.name === cron.name).length <= 1)], 9)
    add('cron-schedule-' + id, 'app.cronjobs.schedule', cron.schedule, [rules.required, rules.cron], 9)
    add('cron-image-' + id, 'app.cronjobs.image', cron.image, [rules.required, rules.image], 9)
    // An empty command uses the image entrypoint.
  })
  for (const [rows, prefix, panel] of [[model.customIngressAnnotations, 'ingress', 3], [model.sAAnnotations, 'sa', 5]] as const) {
    rows.forEach(annotation => {
      const active = !empty(annotation.annotation) || !empty(annotation.value)
      add(prefix + '-' + validationRowId(annotation), 'global.annotation', annotation.annotation, [rules.required, rules.annotation,
        check('unique', value => rows.filter(other => other.annotation === value).length <= 1),
        ...(prefix === 'ingress' ? [check('snippet', value => !String(value).toLowerCase().includes('snippet'))] : [])], panel, active)
    })
  }
  const annotations = model.annotations || {}
  const annotation = (key: string) => annotations['nginx.ingress.kubernetes.io/' + key]
  add('proxy-buffer-size', 'app.form.proxyBufferSize', annotation('proxy-buffer-size'), [rules.pattern(/^[1-9]\d*[kKmM]?$/, 'buffer')], 3)
  for (const key of ['whitelist-source-range', 'denylist-source-range']) {
    add(key, key === 'whitelist-source-range' ? 'app.form.whitelistSourceRange' : 'app.form.denylistSourceRange', annotation(key), [check('ipRanges', value => empty(value) || String(value).split(',').every(validIpRange))], 3)
  }
  const cors = annotation('enable-cors') === true || annotation('enable-cors') === 'true'
  add('cors-max-age', 'app.form.corsMaxAge', annotation('cors-max-age'), [rules.integer(0)], 4, cors)
  add('cors-allow-origin', 'app.form.corsAllowOrigin', annotation('cors-allow-origin'), [check('origins', value => empty(value) || String(value).split(',').every(origin => origin.trim() === '*' || rules.url.test(origin.trim())))], 4, cors)
  for (const [key, label] of [['cors-allow-headers', 'app.form.corsAllowHeaders'], ['cors-expose-headers', 'app.form.corsExposeHeaders'], ['cors-allow-methods', 'app.form.corsAllowMethods']]) {
    add(key, label, annotation(key), [rules.pattern(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+(?:\s*,\s*[A-Za-z0-9!#$%&'*+.^_`|~-]+)*$/, 'tokens')], 4, cors)
  }
  return fields
}

function validIpRange(value: string): boolean {
  const [address, mask, ...extra] = value.trim().split('/')
  if (extra.length || !address || mask !== undefined && !/^\d+$/.test(mask)) return false
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(address) && address.split('.').every(part => Number(part) <= 255)
  if (ipv4) return mask === undefined || Number(mask) <= 32
  try { new URL('http://[' + address + ']'); return mask === undefined || Number(mask) <= 128 } catch { return false }
}
