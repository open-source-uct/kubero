// Idioma con el que parte la interfaz. Se guarda por navegador (no por usuario)
// cuando alguien lo cambia en su perfil. Sin una elección guardada se usa
// español, el idioma de la instancia UCT: antes quedaba en inglés, porque
// KUBERO_DEFAULT_LOCALE nunca llega al cliente compilado (Vite reemplaza
// process.env por un objeto vacío).
export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = 'es'
export const LOCALE_STORAGE_KEY = 'kubero.locale'

export function initialLocale(saved: string | null | undefined): AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(saved ?? '') ? (saved as AppLocale) : DEFAULT_LOCALE
}

export function savedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    // sin acceso al almacenamiento (modo privado estricto): idioma por defecto
    return null
  }
}
