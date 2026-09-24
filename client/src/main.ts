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

const app = createApp(App)
//app.config.performance = true

registerPlugins(app)

app.mount('#app')
