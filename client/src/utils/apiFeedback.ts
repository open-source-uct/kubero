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

export function notifyApiError(error: unknown, action: ApiFeedbackAction): ApiErrorFeedback | null {
  if (axios.isAxiosError(error) && error.response?.status === 401) return null

  const title = String(i18n.global.t(`feedback.actionErrors.${action}.title`))
  const actionMessage = String(i18n.global.t(`feedback.actionErrors.${action}.message`))
  const reason = String(i18n.global.t(`feedback.apiReasons.${reasonKey(error)}`))
  const feedback = { title, message: `${actionMessage} ${reason}` }

  useNotificationStore().error(feedback.title, feedback.message)
  return feedback
}
