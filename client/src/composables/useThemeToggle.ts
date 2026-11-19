import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { saveTheme } from '@/utils/themePreference'

// Cambio entre modo claro y oscuro: lo usan el menú lateral y el login.
export function useThemeToggle() {
  const theme = useTheme()
  const isDark = computed(() => theme.global.current.value.dark)

  function toggleTheme() {
    const next = isDark.value ? 'light' : 'dark'
    theme.global.name.value = next
    saveTheme(next)
  }

  return { isDark, toggleTheme }
}
