import axios, { type AxiosRequestConfig } from 'axios'
import i18n from '@/plugins/i18n'
import { useNotificationStore } from '@/stores/notifications'

export type ApiFeedbackAction =
  | 'updateApp'
  | 'createApp'
  | 'savePodsize'
  | 'deletePodsize'
  | 'createPodsize'
  | 'saveUser'
  | 'deleteUser'
  | 'createUser'
  | 'changeUserPassword'
  | 'removeUserTeam'
  | 'saveRole'
  | 'deleteRole'
  | 'createRole'
  | 'saveTeam'
  | 'deleteTeam'
  | 'createTeam'
  | 'deleteToken'
  | 'createToken'
  | 'saveSettings'
  | 'loadSettings'
  | 'loadNotifications'
  | 'toggleNotification'
  | 'saveNotification'
  | 'deleteNotification'
  | 'createNotification'
  | 'loadNotificationPipelines'
  | 'loadBuildReferences'
  | 'submitBuild'
  | 'createPipeline'
  | 'updatePipeline'
  | 'deletePipeline'

export interface ApiErrorFeedback {
  title: string
  message: string
}

export const handledApiErrorConfig: AxiosRequestConfig = {
  feedback: { error: false },
}

function reasonKey(error: unknown) {
  if (!axios.isAxiosError(error)) return 'unknown'
  if (!error.response) return 'network'

  switch (error.response.status) {
    case 400:
    case 422:
      return 'validation'
    case 403:
      return 'forbidden'
    case 404:
      return 'notFound'
    case 409:
      return 'conflict'
    case 429:
      return 'rateLimited'
    default:
      return error.response.status >= 500 ? 'server' : 'unknown'
  }
}

// Mensajes de validación que devuelve el server en un 400 (formato de
// BadRequestException de Nest: `message` es un string o una lista).
function validationDetails(error: unknown): string {
  if (!axios.isAxiosError(error) || reasonKey(error) !== 'validation') return ''
  const message = (error.response?.data as { message?: unknown } | undefined)?.message
  const list = Array.isArray(message) ? message : [message]
  return list.filter((m): m is string => typeof m === 'string' && m.length > 0).join('. ')
}

export function notifyApiError(
  error: unknown,
  action: ApiFeedbackAction,
  options: { showValidationDetails?: boolean } = {},
): ApiErrorFeedback | null {
  if (axios.isAxiosError(error) && error.response?.status === 401) return null

  const title = String(i18n.global.t(`feedback.actionErrors.${action}.title`))
  const actionMessage = String(i18n.global.t(`feedback.actionErrors.${action}.message`))
  const reason = String(i18n.global.t(`feedback.apiReasons.${reasonKey(error)}`))
  // sin el detalle, un rechazo por p. ej. una variable PORT repetida solo
  // decía "revisa los datos", sin indicar cuál
  const details = options.showValidationDetails ? validationDetails(error) : ''
  const feedback = { title, message: [actionMessage, reason, details].filter(Boolean).join(' ') }

  useNotificationStore().error(feedback.title, feedback.message)
  return feedback
}
