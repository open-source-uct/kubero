// Tema elegido por el usuario (claro u oscuro), guardado en el navegador.
// Se lee al crear Vuetify para que todas las pantallas, incluido el login,
// partan con el tema elegido y no solo las que muestran el menú lateral.
export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'theme'

export function savedTheme(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    // sin acceso al almacenamiento (modo privado estricto): tema claro
    return 'light'
  }
}

export function saveTheme(name: ThemeName) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // sin almacenamiento el cambio dura hasta recargar la página
  }
}
