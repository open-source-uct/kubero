import axios from 'axios'
import { onBeforeUnmount, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

export function useAuditSuggestions(kind: 'pipeline' | 'username', search: () => string, pipeline: () => string = () => '') {
  const auth = useAuthStore()
  const { t } = useI18n()
  const state = reactive({ items: [] as string[], loading: false, error: '' })
  let timer: ReturnType<typeof setTimeout> | undefined
  let request: AbortController | undefined

  function cancel() {
    clearTimeout(timer)
    request?.abort()
  }

  watch(() => [search(), pipeline(), auth.token, auth.userGroups.join(','), auth.permissions.join(',')], (values, previous) => {
    cancel()
    // Vuetify reopens a focused combobox when items go from empty to populated.
    // Keep options while searching, but never retain names from a previous access scope.
    if (!previous || values.slice(1).some((value, index) => value !== previous[index + 1])) {
      state.items = []
    }
    state.error = ''
    state.loading = false
    if (!auth.hasPermission('audit:read') && !auth.hasPermission('audit:write')) {
      state.items = []
      state.error = t('activity.forbidden')
      return
    }
    const current = new AbortController()
    request = current
    state.loading = true
    timer = setTimeout(async () => {
      try {
        const response = await axios.get<string[]>('/api/audit/suggestions', {
          signal: current.signal,
          params: { kind, q: search()?.trim() || undefined, pipeline: pipeline()?.trim() || undefined },
        })
        if (!current.signal.aborted) state.items = response.data
      } catch (error) {
        if (current.signal.aborted) return
        state.items = []
        state.error = axios.isAxiosError(error) && error.response?.status === 403 ? t('activity.forbidden') : t('activity.suggestionsError')
      } finally {
        if (!current.signal.aborted) state.loading = false
      }
    }, 250)
  }, { immediate: true })

  onBeforeUnmount(cancel)
  return state
}
