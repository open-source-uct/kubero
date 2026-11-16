import { check, dnsRules, envRules, rules } from '../utils/validationRules'
import { validationRowId, type ValidationFieldDefinition } from '../composables/useFormValidation'
type Translate = (key: string) => string
export interface BasicAppModel {
  name: string; creating: boolean; containerPort: unknown
  docker: { image: string; tag: string }; hosts: { host: string }[]
  envVars: { name: string; value: string }[]; takenDomains: string[]
}
export function appFields(model: BasicAppModel, t: Translate, reveal: (panel: number) => void): ValidationFieldDefinition[] {
  return [
    { id: 'name', label: t('app.form.appName'), value: model.name, rules: [...dnsRules(), check('reservedName', value => value !== 'new')], active: model.creating },
    { id: 'port', label: t('app.form.containerPort'), value: model.containerPort, rules: [rules.required, rules.integer(1, 65535)] },
    { id: 'image', label: t('app.form.containerImage'), value: model.docker.image, rules: [rules.required, rules.image], reveal: () => reveal(0) },
    { id: 'tag', label: t('app.form.tag'), value: model.docker.tag, rules: [rules.required, rules.tag], reveal: () => reveal(0) },
    ...model.hosts.map(host => ({ id: 'host-' + validationRowId(host), label: t('app.form.domain'), value: host.host,
      rules: [rules.required, rules.domain, check('domainTaken', value => !model.takenDomains.includes(String(value))),
        check('unique', value => model.hosts.filter(other => other.host === value).length <= 1)] })),
    ...model.envVars.map(env => ({ id: 'env-' + validationRowId(env), label: t('app.form.variableName'), value: env.name,
      rules: envRules(model.envVars.map(other => other.name), env.name), reveal: () => reveal(6) })),
  ]
}
