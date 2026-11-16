import { check, rules } from '../utils/validationRules'
export function tokenFields(token: { name: unknown; expiresAt: unknown }, t: (key: string) => string) {
  return [
    { id: 'name', label: t('global.name'), value: token.name, rules: [rules.required] },
    { id: 'expiresAt', label: t('profile.token.expiresAt'), value: token.expiresAt, rules: [rules.required, rules.date] },
  ]
}
export function avatarFields(file: File | null, t: (key: string) => string) {
  return [{ id: 'avatar', label: t('profile.avatar.uploadAvatar'), value: file, rules: [rules.required,
    check('fileSize', value => value instanceof File && value.size <= 102400),
    check('fileType', value => value instanceof File && value.type.startsWith('image/'))] }]
}
