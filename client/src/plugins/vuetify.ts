/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import colors from 'vuetify/util/colors'
import i18n from './i18n'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { useI18n } from 'vue-i18n'

// Composables
import { createVuetify } from 'vuetify'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  theme: {
    themes: {
      dark: {
        colors: {
          "on-background": "#E2E8F0",
          primary: '#0090DC',
          "primary-darken1": '#0075B4',
          secondary: '#1B2430',
          cardBackground: '#16202D',
          "on-cardBackground": '#E2E8F0',
          navBG: '#0B1119',
          kubero: '#0090DC',
          "on-surface-variant": "#16202D",
          
          accent: '#EDC500',
          error: '#EF4444',
          info: '#0090DC',
          success: '#10B981',
          warning: '#EDC500',

          focusbg: '#2A374A',
        },
      },
      light: {
        colors: {
          "on-background": "#1A1A1A",
          primary: '#0075B4',
          "primary-darken1": '#005888',
          secondary: '#EAEFF5',
          cardBackground: '#FFFFFF',
          "on-cardBackground": '#1A1A1A',
          navBG: '#F7F9FC',
          kubero: '#0075B4',

          accent: '#EDC500',
          error: '#EF4444',
          info: '#0075B4',
          success: '#10B981',
          warning: '#EDC500',

          focusbg: '#E2E8F0',
        },
      },
    },
  },
})