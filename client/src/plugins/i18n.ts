import { createI18n } from 'vue-i18n'
import en from '../locale/en'
import es from '../locale/es'

// Get saved locale from localStorage or default to 'de'
const savedLocale = localStorage.getItem('kubero.locale') || process.env.KUBERO_DEFAULT_LOCALE || 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en: en,
    es: es,
  },
})

export default i18n