import { check, dnsRules, rules, type ValidationRule } from '../utils/validationRules'
import type { ValidationFieldDefinition } from '../composables/useFormValidation'
import { parseQuantity } from '../utils/podsizeOptions'
export interface AddonField { name: string; label: string; type: string; default: unknown; required?: boolean }
export function buildFields(model: { buildstrategy: string; reference: string }, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'strategy', label: t('validation.buildStrategy'), value: model.buildstrategy, rules: [rules.required, check('selected', value => ['nixpacks', 'dockerfile', 'buildpacks'].includes(String(value)))] },
    { id: 'reference', label: t('validation.buildReference'), value: model.reference, rules: [rules.required] },
  ]
}
export function addonFields(kind: string | undefined, fields: AddonField[], appName: string): ValidationFieldDefinition[] {
  return [
    { id: 'addon', label: 'Add-on', value: kind, rules: [rules.required] },
    ...fields.filter(field => field.type !== 'switch').map(field => {
      const get = (suffix: string) => fields.find(other => other.name.endsWith(suffix))?.default
      const postgresPassword = kind === 'KuberoAddonPostgres' && (
        field.name.endsWith('.auth.postgresPassword') && get('.auth.enablePostgresUser') !== false ||
        field.name.endsWith('.auth.password') && !!get('.auth.username') && !!get('.auth.database'))
      const checks: ValidationRule[] = field.required || postgresPassword ? [rules.required] : []
      if (field.name === 'metadata.name') {
        checks.push(...dnsRules(63).slice(1), check('maxLength', value => {
          const name = String(value ?? '')
          return (name.startsWith(appName) ? name : appName + '-' + name).length <= 63
        }, { max: 63 }))
      }
      if (field.type === 'number') checks.push(rules.integer(0))
      if (field.type === 'select-storageclass') checks.push(check('selected', value => value !== 'default' && value !== undefined && value !== ''))
      if (/\.(cpu|memory|size|storage)$/.test(field.name)) checks.push(rules.quantity(true))
      if (/\.resources\.(requests|limits)\.(cpu|memory)$/.test(field.name)) {
        const request = parseQuantity(String(get('.resources.requests.' + field.name.split('.').pop()) ?? ''))
        const limit = parseQuantity(String(get('.resources.limits.' + field.name.split('.').pop()) ?? ''))
        checks.push(check('requestLimit', () => request == null || limit == null || request <= limit))
      }
      return { id: 'addon-' + field.name, label: field.label, value: field.default, rules: checks }
    }),
  ]
}
