import get from 'lodash/get'
import { parse } from 'yaml'
import { check, dnsRules, rules, type ValidationRule } from '../utils/validationRules'
import { validationRowId, type ValidationFieldDefinition } from '../composables/useFormValidation'
interface Catalog { name: string; description: string; index: { format: string; url: string } }
export function settingsFields(model: unknown, t: (key: string) => string, preserved: Record<string, boolean>, reveal: (tab: string, index?: number) => void): ValidationFieldDefinition[] {
  const result: ValidationFieldDefinition[] = []
  const add = (id: string, path: string, label: string, checks: ValidationRule[], active = true, tab = 'general') => {
    result.push({ id, label: t(label), value: get(model, path), rules: checks, active, reveal: () => reveal(tab) })
  }
  const banner = 'settings.kubero.config.kubero.banner'
  for (const [name, label] of [['bgcolor', 'backgroundColor'], ['fontcolor', 'fontColor']] as const) {
    add('banner-' + name, banner + '.' + name, 'settings.general.banner.' + label, [rules.required, rules.maxLength(50), check('color', value => typeof CSS === 'undefined' || CSS.supports('color', String(value)))], !!get(model, banner + '.show'))
  }
  add('banner-message', banner + '.message', 'settings.general.banner.message', [rules.required], !!get(model, banner + '.show'))
  for (const provider of ['github', 'oauth2']) {
    const prefix = 'settings.kubero.auth.' + provider
    const active = !!get(model, prefix + '.enabled')
    for (const key of provider === 'github' ? ['id', 'callbackUrl'] : ['name', 'id', 'authUrl', 'tokenUrl', 'callbackUrl']) {
      add(provider + '-' + key, prefix + '.' + key, 'settings.general.authentication.' + provider + '.' + key, [rules.required, ...(/Url$/.test(key) ? [rules.url] : [])], active)
    }
    const secret = provider === 'github' ? 'GITHUB_CLIENT_SECRET' : 'OAUTH2_CLIENT_SECRET'
    add(secret, 'secrets.' + secret, 'settings.general.authentication.' + provider + '.secret', preserved[secret] ? [] : [rules.required], active)
  }
  const audit = 'settings.kubero.auditLogs'
  add('audit-limit', audit + '.limit', 'settings.general.auditLogs.limit', [rules.required, rules.integer(1)], !!get(model, audit + '.enabled'))
  add('audit-size', audit + '.size', 'settings.general.auditLogs.size', [rules.required, rules.quantity(true)], !!get(model, audit + '.enabled'))
  add('webhook-url', 'settings.kubero.webhook_url', 'settings.deployment.url', [rules.url], true, 'deployment')
  for (const provider of ['GITHUB', 'GITEA', 'GOGS', 'GITLAB']) add(provider + '_BASEURL', 'secrets.' + provider + '_BASEURL', 'settings.deployment.url', [rules.url], true, 'deployment')
  const catalogs = get(model, 'settings.kubero.config.templates.catalogs', []) as Catalog[]
  catalogs.forEach((catalog, index) => {
    for (const key of ['name', 'description', 'format', 'url'] as const) {
      result.push({ id: 'catalog-' + validationRowId(catalog) + '-' + key, label: key === 'name' ? t('global.name') : key === 'description' ? t('global.description') : 'Index ' + key,
        value: key === 'name' || key === 'description' ? catalog[key] : catalog.index?.[key], active: !!get(model, 'settings.kubero.config.templates.enabled'),
        rules: [rules.required, ...(key === 'url' ? [rules.url] : key === 'format' ? [check('selected', value => value === 'json')] : [])], reveal: () => reveal('templates', index) })
    }
  })
  return result
}
export function kubeconfigContexts(value: string): string[] {
  try {
    const parsed = parse(value)
    return Array.isArray(parsed?.contexts) ? parsed.contexts.map((context: { name?: unknown }) => context?.name).filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0) : []
  } catch { return [] }
}
export function setupFields(step: string, kubeconfig: string, context: string, dotenv: Record<string, string>): ValidationFieldDefinition[] {
  if (step === '1') return [
    { id: 'kubeconfig', label: 'Kubeconfig', value: kubeconfig, rules: [rules.required, check('kubeconfig', () => kubeconfigContexts(kubeconfig).length > 0)] },
    { id: 'context', label: 'Context', value: context, rules: [rules.required, check('selected', value => kubeconfigContexts(kubeconfig).includes(String(value)))] },
  ]
  if (step !== '2') return []
  return ['KUBECONFIG_BASE64', 'KUBERO_CONTEXT', 'KUBERO_NAMESPACE', 'KUBERO_SESSION_KEY', 'KUBERO_WEBHOOK_SECRET'].map(key => ({ id: key, label: key, value: dotenv[key], rules: key === 'KUBERO_NAMESPACE' ? dnsRules(63) : [rules.required] }))
}
export function notificationFields(model: { name: string; type: string; config: { url?: string } } | null, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'name', label: t('notifications.form.name'), value: model?.name, rules: [rules.required] },
    { id: 'type', label: t('notifications.form.type'), value: model?.type, rules: [rules.required, check('selected', value => ['slack', 'webhook', 'discord'].includes(String(value)))] },
    { id: 'url', label: t('settings.deployment.url'), value: model?.config.url, rules: [rules.required, rules.url] },
  ]
}
