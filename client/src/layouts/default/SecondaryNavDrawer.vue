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

    <div v-if="searchable" class="secondary-nav-search">
      <v-text-field
        v-model="search"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        :placeholder="searchPlaceholder"
      ></v-text-field>
    </div>

    <nav :aria-label="title" class="secondary-nav-content">
      <v-list
        v-model:opened="opened"
        nav
        active-color="primary"
        bg-color="transparent"
      >
        <secondary-nav-tree-node
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @select="$emit('select')"
          @retry="emit('expand', $event)"
        />
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
  // hijos ya resueltos (p. ej. fases de una pipeline, siempre vienen junto
  // con sus apps); si es undefined y lazy=true, aún no se cargaron
  children?: SecondaryNavItem[]
  // true si los children se cargan recién al expandir el grupo
  lazy?: boolean
  loading?: boolean
  // true si la última carga de children falló (ver SecondaryNavTreeNode)
  error?: boolean
}
</script>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import SecondaryNavTreeNode from './SecondaryNavTreeNode.vue'

const props = defineProps<{
  id: string
  title: string
  closeLabel: string
  items: SecondaryNavItem[]
  // muestra un buscador que filtra los items de primer nivel por título
  // (se activa recién cuando hay varios, no tiene sentido con pocos)
  searchable?: boolean
  searchPlaceholder?: string
}>()

const emit = defineEmits<{
  close: []
  select: []
  expand: [id: string]
}>()

const search = ref('')

const filteredItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return props.items
  return props.items.filter((item) => item.title.toLocaleLowerCase().includes(query))
})

// ids de los v-list-group actualmente abiertos (API nativa de Vuetify).
// Es un v-model para que quien nos use pueda abrir de entrada la pipeline
// activa (ver NavDrawer.vue).
const opened = defineModel<string[]>('openedGroups', { default: () => [] })

function findItem(items: SecondaryNavItem[], id: string): SecondaryNavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findItem(item.children, id)
      if (found) return found
    }
  }
  return undefined
}

// al abrir un grupo "lazy" (children aún no cargados) se avisa al padre,
// que es quien sabe cómo pedir los datos (ver NavDrawer.vue)
// reacciona tanto a que se abra un grupo como a que lleguen nuevos items
// (p. ej. las pipelines terminan de cargar después de que ya se marcó
// cuál debía abrirse de entrada)
watch(
  [opened, () => props.items],
  ([ids]) => {
    for (const id of ids) {
      const item = findItem(props.items, id)
      if (item?.lazy && !item.children && !item.loading) {
        emit('expand', id)
      }
    }
  },
  { immediate: true },
)
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

.secondary-nav-search {
  padding: 8px 8px 0;
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
