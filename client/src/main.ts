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

// Composables
import { createApp } from 'vue'

import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
//app.config.performance = true

registerPlugins(app)

// Cuando el JWT caduca (10 h por defecto) todas las llamadas a la API pasan a
// responder 401. Solo se manejaba en la carga inicial de la página; con la
// pantalla ya abierta las pestañas se quedaban en blanco sin ningún aviso hasta
// recargar. Ahora cualquier 401 lleva al login.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? ''
    if (
      error?.response?.status === 401 &&
      !url.includes('/api/auth/login') &&
      router.currentRoute.value.name !== 'Login'
    ) {
      useAuthStore().reset()
      router.push('/login')
    }
    return Promise.reject(error)
  }
)

app.mount('#app')
