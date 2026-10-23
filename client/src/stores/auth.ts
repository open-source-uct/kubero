import { defineStore } from 'pinia'
import axios from 'axios'
import { disconnectSocketIO } from '../socket.io'
import { useKuberoStore } from './kubero'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    sessionLoaded: false,
    permissions: [] as string[],
    userId: '',
    username: '',
    role: '',
    userGroups: [] as string[],
    scopeToOwnTeam: false,
    priority: 0,
  }),
  actions: {
    loadSession(user: any) {
      this.userId = user.userId
      this.username = user.username
      this.role = user.role
      this.permissions = user.permissions ?? []
      this.userGroups = user.userGroups ?? []
      this.scopeToOwnTeam = user.scopeToOwnTeam ?? false
      this.priority = user.priority ?? 0
      this.sessionLoaded = true
    },
    async initialize() {
      if (this.sessionLoaded) return
      try {
        const { data } = await axios.get('/api/auth/session')
        this.loadSession(data.user)
      } catch {
        this.reset()
      }
    },
    reset() {
      delete axios.defaults.headers.common['Authorization']
      localStorage.removeItem('kubero.JWT_TOKEN')
      disconnectSocketIO()
      const kubero = useKuberoStore().kubero
      kubero.socket = null
      kubero.isAuthenticated = false
      kubero.nextGenSession = { username: '', token: '' }
      this.$reset()
      this.sessionLoaded = true
    },
  },
  getters: {
    hasPermission: (state) => (perm: string) => state.permissions.includes(perm),
  },
})
