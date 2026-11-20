import { check, rules } from '../utils/validationRules'
import type { ValidationFieldDefinition } from '../composables/useFormValidation'
import { requestAboveLimit, type PodsizeResources } from '../utils/podsizeOptions'
interface Stage { repository?: string; tag?: string; securityContext?: { runAsUser?: unknown; runAsGroup?: unknown; runAsNonRoot?: boolean } }
interface RunpackInput { name?: string; language?: string; fetch?: Stage; build?: Stage; run?: Stage }
export function runpackFields(model: RunpackInput | null, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'name', label: t('runpacks.form.name'), value: model?.name, rules: [rules.required] },
    { id: 'language', label: t('runpacks.form.language'), value: model?.language, rules: [rules.required] },
    ...(['fetch', 'build', 'run'] as const).flatMap(name => {
      const stage = model?.[name]
      const stageLabel = t('runpacks.table.' + name)
      return [
        { id: name + '-repository', label: stageLabel + ': ' + t('runpacks.details.repository'), value: stage?.repository, rules: [rules.required, rules.image] },
        { id: name + '-tag', label: stageLabel + ': ' + t('runpacks.form.tag'), value: stage?.tag, rules: [rules.required, rules.tag] },
        { id: name + '-uid', label: stageLabel + ': ' + t('runpacks.form.runAsUser'), value: stage?.securityContext?.runAsUser, rules: [rules.required, rules.integer(0, 4294967295), check('nonRoot', value => !stage?.securityContext?.runAsNonRoot || Number(value) > 0)] },
        { id: name + '-gid', label: stageLabel + ': ' + t('runpacks.form.runAsGroup'), value: stage?.securityContext?.runAsGroup, rules: [rules.required, rules.integer(0, 4294967295)] },
      ]
    }),
  ]
}
export function podsizeFields(model: { name?: string; description?: string; resources: PodsizeResources } | null, t: (key: string) => string): ValidationFieldDefinition[] {
  const resources = model?.resources
  const above = resources ? requestAboveLimit(resources) : { cpu: false, memory: false }
  return [
    { id: 'name', label: t('podsizes.form.name'), value: model?.name, rules: [rules.required] },
    { id: 'description', label: t('podsizes.form.description'), value: model?.description, rules: [rules.required] },
    ...(['requests', 'limits'] as const).flatMap(kind => (['cpu', 'memory'] as const).map(key => ({
      id: kind + '-' + key, label: t('podsizes.form.' + key + (kind === 'requests' ? 'Request' : 'Limit')),
      value: resources?.[kind]?.[key], rules: [rules.required, rules.quantity(), check('requestLimit', () => !above[key])],
    }))),
  ]
}
