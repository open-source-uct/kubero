<template>
  <v-main>
    <!-- mismo cambio de tema que el menú lateral, para las pantallas sin sesión
         (login, recuperar y restablecer la contraseña) -->
    <v-tooltip :text="$t('navigation.theme')" location="bottom">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          class="login-theme-toggle"
          icon="mdi-theme-light-dark"
          variant="text"
          :aria-label="$t('navigation.theme')"
          :aria-pressed="isDark"
          @click="toggleTheme"
        />
      </template>
    </v-tooltip>
    <router-view />
  </v-main>
</template>

<script lang="ts" setup>
import { useThemeToggle } from '@/composables/useThemeToggle'

const { isDark, toggleTheme } = useThemeToggle()
</script>

<style scoped>
.v-main {
  background: rgb(var(--v-theme-focusbg));
}

.login-theme-toggle {
  position: fixed;
  z-index: 10;
  top: max(16px, env(safe-area-inset-top));
  right: 16px;
  color: rgb(var(--v-theme-on-background));
}
</style>
