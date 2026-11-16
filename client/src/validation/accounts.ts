import { check, rules } from '../utils/validationRules'
import type { ValidationFieldDefinition } from '../composables/useFormValidation'
interface UserInput { username?: string; email?: string; password?: string; userGroups?: unknown[] }
export function userFields(user: UserInput, creating: boolean, scoped: boolean, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'username', label: t('user.username'), value: user.username, rules: [rules.required] },
    { id: 'email', label: t('user.email'), value: user.email, rules: [rules.required, rules.email] },
    { id: 'password', label: t('user.password'), value: user.password, rules: [rules.required, rules.minLength(8)], active: creating },
    { id: 'teams', label: t('user.teams'), value: user.userGroups, rules: [rules.required], active: scoped },
  ]
}
export function passwordFields(password: unknown, confirmation: unknown, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'password', label: t('user.newPassword'), value: password, rules: [rules.required, rules.minLength(8)] },
    { id: 'confirmation', label: t('user.confirmPassword'), value: confirmation, rules: [rules.required, check('match', value => value === password)] },
  ]
}
export function namedFields(value: { name?: string; description?: string }, descriptionRequired: boolean, t: (key: string) => string): ValidationFieldDefinition[] {
  return [
    { id: 'name', label: t('global.name'), value: value.name, rules: [rules.required] },
    { id: 'description', label: t('global.description'), value: value.description, rules: [rules.required], active: descriptionRequired },
  ]
}
