<template>
  <v-container class="accounts-page" fluid>


    <header class="accounts-header">
      <div class="accounts-heading">
        <div class="accounts-heading__icon" aria-hidden="true">
          <v-icon :icon="activeSection.icon" size="24" />
        </div>
        <div>
          <h1 class="uct-h1">{{ activeSection.title }}</h1>
          <p>{{ activeSection.description }}</p>
        </div>
      </div>
      <v-btn
        v-if="activeSection.createLabel"
        color="primary"
        prepend-icon="mdi-plus"
        :disabled="!canWrite"
        @click="openCreateDialog"
      >
        {{ activeSection.createLabel }}
      </v-btn>
    </header>



    <main class="accounts-workspace" tabindex="0" :aria-label="activeSection.title">
      <component :is="activeSection.component" :key="activeSection.key" ref="sectionComponent" />
    </main>
  </v-container>
</template>

<script lang="ts" setup>
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Users from './users.vue'
import Teams from './teams.vue'
import Roles from './roles.vue'
import Tokens from './tokens.vue'
import { useAuthStore } from '../../stores/auth'

type AccountSection = 'users' | 'teams' | 'roles' | 'tokens'
type SectionInstance = ComponentPublicInstance & { openCreateDialog?: () => void | Promise<void> }

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const sectionComponent = ref<SectionInstance | null>(null)

const currentSection = computed<AccountSection>(() => {
  const section = route.meta.accountSection
  return section === 'teams' || section === 'roles' || section === 'tokens' ? section : 'users'
})

const activeSection = computed(() => {
  const sections = {
    users: {
      key: 'users',
      title: t('accounts.users'),
      description: t('accounts.descriptions.users'),
      icon: 'mdi-account-multiple-outline',
      component: Users,
      createLabel: t('user.actions.create'),
    },
    teams: {
      key: 'teams',
      title: t('accounts.teams'),
      description: t('accounts.descriptions.teams'),
      icon: 'mdi-account-group-outline',
      component: Teams,
      createLabel: t('teams.actions.create'),
    },
    roles: {
      key: 'roles',
      title: t('accounts.roles'),
      description: t('accounts.descriptions.roles'),
      icon: 'mdi-shield-account-outline',
      component: Roles,
      // los roles son fijos (admin/webmaster/profesor/student): no se crean
      // roles nuevos, así que esta sección no necesita botón de crear
      createLabel: '',
    },
    tokens: {
      key: 'tokens',
      title: t('accounts.tokens'),
      description: t('accounts.descriptions.tokens'),
      icon: 'mdi-key-chain-variant',
      component: Tokens,
      createLabel: '',
    },
  }
  return sections[currentSection.value]
})

const canWrite = computed(() => currentSection.value === 'tokens'
  ? authStore.hasPermission('token:ok') || authStore.hasPermission('token:write')
  : authStore.hasPermission('user:write'))
function openCreateDialog() {
  sectionComponent.value?.openCreateDialog?.()
}
</script>

<style scoped>
.accounts-page { max-width: 1440px; padding: 28px 28px 48px; }
.accounts-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin: 10px 0 22px; }
.accounts-heading { display: flex; gap: 14px; align-items: flex-start; }
.accounts-heading__icon { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; border-radius: 8px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); }
.accounts-heading h1 { margin: 0; }
.accounts-heading p { max-width: 72ch; margin: 6px 0 0; color: rgb(var(--v-theme-on-background)); font-size: .875rem; line-height: 1.55; opacity: .72; }
.accounts-workspace { overflow: hidden; border: 1px solid var(--uct-corp-gray-border); border-radius: 8px; background: rgb(var(--v-theme-cardBackground)); }
.accounts-workspace :deep(.v-container) { max-width: none; padding: 0; }
.accounts-workspace :deep(.account-data-table) { background: transparent; }
.accounts-workspace :deep(.account-alert-content) { display: flex; justify-content: space-between; gap: 24px; align-items: center; }
.accounts-workspace :deep(.account-table-toolbar) { display: grid; gap: 12px; align-items: center; padding: 20px; border-bottom: 1px solid var(--uct-corp-gray-border); }
.accounts-workspace :deep(.account-table-toolbar--search) { grid-template-columns: minmax(260px, 520px) auto; justify-content: space-between; }
.accounts-workspace :deep(.account-table-toolbar--filters) { grid-template-columns: minmax(260px, 1.4fr) repeat(3, minmax(150px, .7fr)); }
.accounts-workspace :deep(.account-table-toolbar__clear) { grid-column: 1 / -1; justify-self: start; }
.accounts-workspace :deep(.account-table-toolbar .v-field) { background: rgb(var(--v-theme-cardBackground)); }
.accounts-workspace :deep(.account-table-summary) { display: flex; min-height: 46px; justify-content: space-between; gap: 16px; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--uct-corp-gray-border); color: rgb(var(--v-theme-on-cardBackground)); font-size: .8125rem; font-variant-numeric: tabular-nums; }
.accounts-workspace :deep(.v-data-table-header__content) { color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; opacity: .68; }
.accounts-workspace :deep(.v-data-table thead th) { height: 44px !important; }
.accounts-workspace :deep(.v-data-table tbody td) { height: 68px !important; color: rgb(var(--v-theme-on-cardBackground)); font-size: .8125rem; }
.accounts-workspace :deep(tbody tr) { transition: background-color 140ms ease-out; }
.accounts-workspace :deep(tbody tr:hover) { background: rgba(var(--v-theme-primary), .045); }
.accounts-workspace :deep(.account-identity) { display: flex; min-width: 150px; gap: 10px; align-items: center; color: rgb(var(--v-theme-on-cardBackground)); }
.accounts-workspace :deep(.account-identity strong) { font-size: .875rem; font-weight: 600; }
.accounts-workspace :deep(.account-mono-value) { font-family: var(--uct-font-mono); font-size: .75rem; }
.accounts-workspace :deep(.account-muted-value) { color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; opacity: .6; }
.accounts-workspace :deep(.account-actions) { display: flex; justify-content: flex-end; gap: 2px; white-space: nowrap; }
.accounts-workspace :deep(.account-empty-state) { display: flex; min-height: 300px; max-width: 520px; margin: 0 auto; padding: 48px 24px; flex-direction: column; gap: 16px; align-items: center; justify-content: center; text-align: center; }
.accounts-workspace :deep(.account-empty-state h2) { margin: 0; color: rgb(var(--v-theme-on-cardBackground)); font-size: 1.125rem; font-weight: 600; line-height: 1.5; }
.accounts-workspace :deep(.account-table-footer) { display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; align-items: center; padding: 14px 20px; border-top: 1px solid var(--uct-corp-gray-border); }
.accounts-workspace :deep(.account-page-size) { display: flex; gap: 10px; align-items: center; color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; }
.accounts-workspace :deep(.account-page-size .v-select) { max-width: 86px; }
.accounts-workspace :deep(.account-page-range) { justify-self: end; color: rgb(var(--v-theme-on-cardBackground)); font-size: .75rem; font-variant-numeric: tabular-nums; opacity: .65; }
.accounts-workspace :deep(.v-table__wrapper:focus-visible) { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.accounts-workspace :deep(.account-data-table--wide table) { min-width: 1120px; }
.accounts-workspace :deep(.legacy-create-control) { display: none !important; }
.accounts-workspace :deep(.sr-only) { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1050px) {
  .accounts-workspace :deep(.account-table-toolbar--filters) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .accounts-workspace :deep(.account-table-toolbar__search) { grid-column: 1 / -1; }
  .accounts-workspace :deep(.account-table-footer) { grid-template-columns: 1fr auto; }
  .accounts-workspace :deep(.account-page-range) { display: none; }
}

@media (max-width: 700px) {
  .accounts-page { padding: 20px 14px 36px; }
  .accounts-header { align-items: stretch; flex-direction: column; }
  .accounts-header > .v-btn { align-self: flex-start; }
  .accounts-heading__icon { width: 38px; height: 38px; flex-basis: 38px; }
  .accounts-workspace :deep(.account-alert-content) { align-items: flex-start; flex-direction: column; }
  .accounts-workspace :deep(.account-table-toolbar),
  .accounts-workspace :deep(.account-table-toolbar--search),
  .accounts-workspace :deep(.account-table-toolbar--filters) { grid-template-columns: 1fr; padding: 16px; }
  .accounts-workspace :deep(.account-table-toolbar__search) { grid-column: auto; }
  .accounts-workspace :deep(.account-table-toolbar .v-btn) { justify-self: start; }
  .accounts-workspace { overflow: hidden; }
  .accounts-workspace :deep(.v-table__wrapper) { overflow-x: auto; }
  .accounts-workspace :deep(.v-table__wrapper table) { min-width: 780px; }
  .accounts-workspace :deep(.account-table-footer) { display: flex; flex-direction: column; }
  .accounts-workspace :deep(.account-page-size) { align-self: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .accounts-workspace :deep(tbody tr) { transition: none; }
}
</style>
