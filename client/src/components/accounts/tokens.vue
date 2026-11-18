<template>
  <v-container>
    <v-alert v-if="loadError" type="warning" variant="tonal" class="ma-4">
      <div class="account-alert-content">
        <span>{{ $t('accounts.errors.loadTokens') }}</span>
        <v-btn variant="outlined" color="warning" size="small" @click="loadTokens">{{ $t('accounts.retry') }}</v-btn>
      </div>
    </v-alert>

    <v-data-table
      v-if="!loadError"
      ref="tokenTable"
      v-model:page="page"
      :headers="headers"
      :items="filteredTokens"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="account-data-table"
      item-key="id"
      hide-default-footer
    >
      <template #top>
        <div class="account-table-toolbar account-table-toolbar--search">
          <v-text-field v-model="search" :label="$t('tokens.search')" prepend-inner-icon="mdi-magnify" hide-details variant="outlined" clearable density="compact" />
          <v-btn v-if="hasActiveFilters" variant="text" color="primary" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">
            {{ $t('accounts.table.clearFilters') }}
          </v-btn>
        </div>
        <div class="account-table-summary" aria-live="polite">
          <span>{{ resultSummary }}</span>
          <v-chip v-if="hasActiveFilters" size="small" variant="tonal" color="primary" label>{{ $t('accounts.table.filtered') }}</v-chip>
        </div>
      </template>
      <template v-slot:[`header.actions`]><span class="sr-only">{{ $t('accounts.table.actions') }}</span></template>

      <template #loading><v-skeleton-loader type="table-row@6" /></template>
      <template #no-data>
        <div class="account-empty-state">
          <v-icon :icon="hasActiveFilters ? 'mdi-filter-off-outline' : 'mdi-key-chain-variant'" size="38" color="primary" aria-hidden="true" />
          <h2>{{ hasActiveFilters ? $t('accounts.table.noResults') : $t('accounts.table.noItems') }}</h2>
          <v-btn v-if="hasActiveFilters" color="primary" variant="outlined" @click="resetFilters">{{ $t('accounts.table.clearFilters') }}</v-btn>
        </div>
      </template>
      <template v-slot:[`item.token`]="{ item }"><span class="account-mono-value">{{ item.id }}</span></template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="account-identity"><v-icon icon="mdi-key-outline" color="primary" size="20" aria-hidden="true" /><strong>{{ item.name }}</strong></div>
      </template>
      <template v-slot:[`item.user.username`]="{ item }"><span>{{ item.user?.username || '—' }}</span></template>
      <template v-slot:[`item.expiresAt`]="{ item }">
        <span v-if="item.expiresAt">{{ new Date(item.expiresAt).toLocaleString() }}</span>
        <span v-else class="account-muted-value">—</span>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="account-actions">
          <v-tooltip v-if="writeUserPermission" :text="$t('global.delete')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small" :aria-label="`${$t('global.delete')} ${item.name}`" @click="deleteToken(item)" />
            </template>
          </v-tooltip>
        </div>
      </template>
      <template #bottom>
        <footer v-if="!loading && filteredTokens.length > 0" class="account-table-footer">
          <div class="account-page-size">
            <span>{{ $t('accounts.table.rowsPerPage') }}</span>
            <v-select v-model="itemsPerPage" :items="pageSizeOptions" density="compact" variant="outlined" hide-details :aria-label="$t('accounts.table.rowsPerPage')" />
          </div>
          <v-pagination v-model="page" :length="pageCount" :total-visible="paginationVisible" density="comfortable" :aria-label="$t('accounts.table.paginationLabel')" />
          <span class="account-page-range">{{ pageRange }}</span>
        </footer>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

export default defineComponent({
  name: 'TokensTable',
  setup() {
    const { t } = useI18n()
    const { smAndDown } = useDisplay()
    interface Token {
      id?: string;
      token?: string;
      name: string;
      expiresAt?: string;
      userId?: string;
      user?: { id: string; username: string };
    }
    const tokens = ref<Token[]>([])
    const tokenTable = ref<{ $el?: HTMLElement } | null>(null)
    const loading = ref(true)
    const loadError = ref(false)
    const search = ref<string | null>('')
    const page = ref(1)
    const itemsPerPage = ref(10)
    const pageSizeOptions = [10, 25, 50]
    const authStore = useAuthStore()
    const writeUserPermission = computed(() => authStore.hasPermission('token:ok') || authStore.hasPermission('token:write'))

    const baseHeaders = [
      { title: t('tokens.form.id'), value: 'token' },
      { title: t('tokens.form.name'), value: 'name' },
      { title: t('tokens.form.owner'), value: 'user.username' },
      { title: t('tokens.form.expiresAt'), value: 'expiresAt' },
    ]
    // sin permiso sobre tokens no hay ninguna acción posible por fila, así que la columna no se muestra
    const headers = computed(() => writeUserPermission.value
      ? [...baseHeaders, { title: '', value: 'actions', sortable: false, align: 'end' as const }]
      : baseHeaders)
    const hasActiveFilters = computed(() => Boolean(search.value?.trim()))
    const filteredTokens = computed(() => {
      const query = search.value?.trim().toLocaleLowerCase() ?? ''
      return tokens.value.filter((token) => [token.id, token.name, token.user?.username, token.expiresAt]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    })
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredTokens.value.length / itemsPerPage.value)))
    const paginationVisible = computed(() => smAndDown.value ? 3 : 7)
    const resultSummary = computed(() => t('accounts.table.resultCount', { filtered: filteredTokens.value.length, total: tokens.value.length }))
    const pageRange = computed(() => {
      const start = filteredTokens.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
      const end = Math.min(page.value * itemsPerPage.value, filteredTokens.value.length)
      return t('accounts.table.pageRange', { start, end, total: filteredTokens.value.length })
    })

    watch([search, itemsPerPage], () => { page.value = 1 })
    watch(pageCount, (count) => { if (page.value > count) page.value = count })
    const resetFilters = () => { search.value = '' }
    const configureScrollableTable = async () => {
      await nextTick()
      const wrapper = tokenTable.value?.$el?.querySelector<HTMLElement>('.v-table__wrapper')
      if (!wrapper) return
      wrapper.setAttribute('role', 'region')
      wrapper.setAttribute('tabindex', '0')
      wrapper.setAttribute('aria-label', t('accounts.table.tableRegion', { section: t('accounts.tokens') }))
    }
    const loadTokens = async () => {
      loading.value = true
      loadError.value = false
      try {
        const res = await axios.get('/api/tokens')
        tokens.value = res.data
        await configureScrollableTable()
      } catch {
        tokens.value = []
        loadError.value = true
      } finally {
        loading.value = false
      }
    }
    const deleteToken = async (token: Token) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: token.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/tokens/${token.id}`, handledApiErrorConfig)
        await loadTokens()
      } catch (error) {
        notifyApiError(error, 'deleteToken')
      }
    }

    onMounted(loadTokens)

    return {
      tokenTable, headers, loading, loadError, loadTokens, search, filteredTokens,
      hasActiveFilters, resetFilters, resultSummary, page, itemsPerPage, pageSizeOptions, pageCount,
      paginationVisible, pageRange, deleteToken, writeUserPermission,
    }
  },
})
</script>
