// Decide si una respuesta 401 significa que la sesión expiró. Solo puede
// expirar una sesión que existía: en la primera visita, o después de cerrar
// sesión, /api/auth/session responde 401 porque no hay sesión, y el router ya
// lleva al login sin necesidad de avisar nada.
export interface UnauthorizedContext {
  status?: number
  url?: string
  hadSession: boolean
  routeName?: string | symbol | null
  redirectInProgress: boolean
}

export function isLoginRequest(url = '') {
  return url.includes('/api/auth/login')
}

export function isSessionExpiry(context: UnauthorizedContext) {
  return (
    context.status === 401 &&
    context.hadSession &&
    !isLoginRequest(context.url) &&
    !context.redirectInProgress &&
    context.routeName !== 'Login'
  )
}
