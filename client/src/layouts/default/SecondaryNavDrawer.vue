<template>
  <aside
    :id="id"
    class="secondary-nav-drawer"
    data-testid="secondary-navigation"
    :aria-label="title"
  >
    <header class="secondary-nav-header">
      <h2 class="secondary-nav-title">{{ title }}</h2>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        :aria-label="closeLabel"
        data-testid="secondary-navigation-close"
        @click="$emit('close')"
      ></v-btn>
    </header>

    <v-divider></v-divider>

    <nav :aria-label="title" class="secondary-nav-content">
      <v-list nav active-color="primary" bg-color="transparent">
        <v-list-item
          v-for="item in items"
          :key="item.id"
          :to="item.to"
          :href="item.href"
          :target="item.href ? '_blank' : undefined"
          :rel="item.href ? 'noopener noreferrer' : undefined"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="item.to ? route.path === item.to : false"
          rounded="md"
          class="secondary-nav-item"
          @click="$emit('select')"
        >
          <template v-if="item.href" #append>
            <v-icon
              icon="mdi-open-in-new"
              size="small"
              aria-hidden="true"
            ></v-icon>
          </template>
        </v-list-item>
      </v-list>
    </nav>
  </aside>
</template>

<script lang="ts">
export interface SecondaryNavItem {
  id: string
  title: string
  icon: string
  to?: string
  href?: string
}
</script>

<script lang="ts" setup>
import { useRoute } from 'vue-router'

defineProps<{
  id: string
  title: string
  closeLabel: string
  items: SecondaryNavItem[]
}>()

defineEmits<{
  close: []
  select: []
}>()

const route = useRoute()
</script>

<style scoped>
.secondary-nav-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: var(--secondary-nav-left, 56px);
  z-index: 1007;
  width: var(--secondary-nav-width, 256px);
  max-width: 100vw;
  overflow-y: auto;
  color: rgb(var(--v-theme-on-background));
  background: rgb(var(--v-theme-navBG));
  border-inline: 1px solid var(--uct-corp-gray-border);
  box-shadow: 8px 0 24px rgba(14, 22, 32, 0.18);
}

.secondary-nav-header {
  display: flex;
  box-sizing: border-box;
  height: var(--secondary-nav-header-height, 72px);
  min-height: var(--secondary-nav-header-height, 72px);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  background: rgb(var(--v-theme-cardBackground));
}

.secondary-nav-title {
  margin: 2px 0 0;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
}

.secondary-nav-content {
  padding: 8px;
}

.secondary-nav-item {
  min-height: 48px;
  margin-bottom: 4px;
}

.secondary-nav-item:focus-visible,
.secondary-nav-header :deep(.v-btn:focus-visible) {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
