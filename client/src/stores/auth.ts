// stores/authStore.ts
import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'

interface JwtPayload {
  userId: string
  username: string
  role: string
  permissions: string[]
  scopeToOwnTeam?: boolean
  priority?: number
  exp: number
  [key: string]: any
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    permissions: [] as string[],
    userId: '' as string,
    username: '' as string,
    role: '' as string,
    userGroups: [] as string[],
    scopeToOwnTeam: false as boolean,
    priority: 0 as number,
  }),

  actions: {
    loadToken(token: string) {
      this.token = token
      try {
        const decoded = jwtDecode<JwtPayload>(token)
        this.permissions = decoded.permissions || []
        this.userId = decoded.userId
        this.username = decoded.username || ''
        this.role = decoded.role || ''
        this.userGroups = decoded.userGroups || []
        this.scopeToOwnTeam = decoded.scopeToOwnTeam || false
        this.priority = decoded.priority || 0
      } catch (e) {
        console.error('Failed to decode JWT Token', e)
        this.reset()
      }
    },

    reset() {
      this.token = ''
      this.permissions = []
      this.userId = ''
      this.username = ''
      this.role = ''
      this.userGroups = []
      this.scopeToOwnTeam = false
      this.priority = 0
    },
  },
  getters: {
    hasPermission: (state) => (perm: string) => state.permissions.includes(perm),
  },

})
