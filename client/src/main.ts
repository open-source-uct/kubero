/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Styles
import '@/styles/uct-theme.scss'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'
import ValidationField from './components/forms/ValidationField.vue'
import FormValidationSummary from './components/forms/FormValidationSummary.vue'

// Composables
import { createApp } from 'vue'

import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import i18n from '@/plugins/i18n'

const app = createApp(App)
app.component('ValidationField', ValidationField)
app.component('FormValidationSummary', FormValidationSummary)
//app.config.performance = true

registerPlugins(app)

// Cuando el JWT caduca (10 h por defecto) todas las llamadas a la API pasan a
// responder 401. Solo se manejaba en la carga inicial de la página; con la
// pantalla ya abierta las pestañas se quedaban en blanco sin ningún aviso hasta
// recargar. Ahora cualquier 401 lleva al login.
const mutationMethods = new Set(['post', 'put', 'patch', 'delete'])
let sessionRedirectInProgress = false

function isMutation(method?: string) {
  return mutationMethods.has(method?.toLowerCase() ?? '')
}

function isLoginRequest(url = '') {
  return url.includes('/api/auth/login')
}

function successFeedback(method = '') {
  switch (method.toLowerCase()) {
    case 'delete':
      return {
        title: i18n.global.t('feedback.deleted.title'),
        message: i18n.global.t('feedback.deleted.message'),
      }
    case 'put':
    case 'patch':
      return {
        title: i18n.global.t('feedback.updated.title'),
        message: i18n.global.t('feedback.updated.message'),
      }
    default:
      return {
        title: i18n.global.t('feedback.completed.title'),
        message: i18n.global.t('feedback.completed.message'),
      }
  }
}

axios.interceptors.response.use(
  (response) => {
    const method = response.config.method
    const url = response.config.url ?? ''

    if (isLoginRequest(url)) {
      sessionRedirectInProgress = false
    }

    if (isMutation(method) && !isLoginRequest(url) && response.config.feedback?.success !== false) {
      const feedback = successFeedback(method)
      useNotificationStore().success(feedback.title, feedback.message)
    }

    return response
  },
  (error) => {
    const url: string = error?.config?.url ?? ''
    const method: string = error?.config?.method ?? ''
    if (
      error?.response?.status === 401 &&
      !isLoginRequest(url) &&
      !sessionRedirectInProgress &&
      router.currentRoute.value.name !== 'Login'
    ) {
      sessionRedirectInProgress = true
      useAuthStore().reset()
      useNotificationStore().error(
        i18n.global.t('feedback.sessionExpired.title'),
        i18n.global.t('feedback.sessionExpired.message'),
      )
      router.push('/login')
    } else if (
      isMutation(method) &&
      !isLoginRequest(url) &&
      error?.config?.feedback?.error !== false
    ) {
      useNotificationStore().error(
        i18n.global.t('feedback.error.title'),
        i18n.global.t('feedback.error.message'),
      )
    }
    return Promise.reject(error)
  }
)

app.mount('#app')
