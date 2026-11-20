import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '../locale/en'
import es from '../locale/es'
import { initialLocale, savedLocale } from '../utils/locale'

// el idioma guardado en este navegador o, si no hay, español
const i18n = createI18n({
  legacy: false,
  // como string: el adaptador de Vuetify espera un i18n con idiomas genéricos
  locale: initialLocale(savedLocale()) as string,
  fallbackLocale: 'en',
  messages: {
    en: en,
    es: es,
  },
})

// el atributo lang de la página sigue al idioma de la interfaz, para que los
// lectores de pantalla pronuncien bien el texto
const syncDocumentLang = (locale: string) => {
  document.documentElement.lang = locale
}
syncDocumentLang(i18n.global.locale.value)
watch(i18n.global.locale, syncDocumentLang)

export default i18n
