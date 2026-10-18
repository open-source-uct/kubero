<template>
  <v-list-group v-if="item.children || item.lazy" :value="item.id">
    <template #activator="{ props: activatorProps }">
      <v-list-item
        v-bind="activatorProps"
        :prepend-icon="item.icon"
        :title="item.title"
        rounded="md"
        class="secondary-nav-item"
      ></v-list-item>
    </template>

    <v-list-item
      v-if="item.loading"
      class="secondary-nav-item secondary-nav-item--loading"
      density="compact"
    >
      <template #prepend>
        <v-progress-circular indeterminate size="16" width="2"></v-progress-circular>
      </template>
      <v-list-item-title class="text-caption">{{ $t('navigation.loading') }}</v-list-item-title>
    </v-list-item>

    <v-list-item
      v-else-if="item.children && item.children.length === 0"
      class="secondary-nav-item secondary-nav-item--empty"
      density="compact"
    >
      <v-list-item-title class="text-caption">{{ $t('navigation.noItems') }}</v-list-item-title>
    </v-list-item>

    <secondary-nav-tree-node
      v-for="child in item.children"
      :key="child.id"
      :item="child"
      :depth="depth + 1"
      @select="$emit('select')"
    ></secondary-nav-tree-node>
  </v-list-group>

  <v-list-item
    v-else
    :to="item.to"
    :href="item.href"
    :target="item.href ? '_blank' : undefined"
    :rel="item.href ? 'noopener noreferrer' : undefined"
    :prepend-icon="item.icon"
    :title="item.title"
    :active="item.to ? route.path === item.to : false"
    rounded="md"
    class="secondary-nav-item"
    :class="`secondary-nav-item--depth-${depth}`"
    @click="$emit('select')"
  >
    <template v-if="item.href" #append>
      <v-icon icon="mdi-open-in-new" size="small" aria-hidden="true"></v-icon>
    </template>
  </v-list-item>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router'
import type { SecondaryNavItem } from './SecondaryNavDrawer.vue'

withDefaults(
  defineProps<{
    item: SecondaryNavItem
    depth?: number
  }>(),
  { depth: 0 },
)

defineEmits<{
  select: []
}>()

const route = useRoute()
</script>

<style scoped>
.secondary-nav-item--depth-1 {
  padding-inline-start: 32px !important;
}
.secondary-nav-item--depth-2 {
  padding-inline-start: 48px !important;
}
.secondary-nav-item--loading,
.secondary-nav-item--empty {
  opacity: 0.65;
  pointer-events: none;
}
</style>
