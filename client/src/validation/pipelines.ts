import { check, dnsRules, envRules, rules } from '../utils/validationRules'
import { validationRowId, type ValidationFieldDefinition } from '../composables/useFormValidation'
interface Phase { name: string; enabled: boolean; context: string; domain: string; defaultEnvvars: { name: string; value: string }[] }
export interface PipelineModel { name: string; creating: boolean; domain: string; teams: string[]; admin: boolean; supervised: boolean; phases: Phase[]; contexts: string[] }
export function pipelineFields(model: PipelineModel, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'name', label: t('pipeline.form.label.name'), value: model.name, active: model.creating, rules: [...dnsRules(), check('reservedName', value => value !== 'new'), check('namespaceLength', () => model.phases.filter(phase => phase.enabled).every(phase => (model.name + '-' + phase.name).length <= 63))] },
    { id: 'teams', label: t('pipeline.form.label.teamAccess'), value: model.teams, rules: [{ ...check('team', value => model.admin || Array.isArray(value) && value.length > 0), required: !model.admin }, check('courseTeam', value => !model.supervised || Array.isArray(value) && value.some(team => typeof team === 'string' && !team.startsWith('personal-')))] },
    { id: 'domain', label: t('pipeline.form.label.fqdnDomain'), value: model.domain, rules: [rules.domain] },
    ...model.phases.filter(phase => phase.enabled).flatMap(phase => {
      // la fase con su nombre traducido ("Producción"), no el interno ("production")
      const phaseLabel = t('pipeline.phases.' + phase.name)
      return [
        { id: 'context-' + phase.name, label: phaseLabel + ': ' + t('pipeline.form.label.cluster'), value: phase.context, rules: [rules.required, check('selected', value => model.contexts.includes(String(value)))] },
        { id: 'domain-' + phase.name, label: phaseLabel + ': ' + t('pipeline.form.label.baseDomain'), value: phase.domain, rules: [rules.domain] },
        ...phase.defaultEnvvars.map(env => ({ id: 'env-' + validationRowId(env), label: phaseLabel + ': ' + t('global.name'), value: env.name, rules: envRules(phase.defaultEnvvars.map(other => other.name), env.name) })),
      ]
    }),
  ]
}
