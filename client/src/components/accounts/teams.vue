<template>
  <v-container>
    <v-alert v-if="loadError" type="warning" variant="tonal" class="ma-4">
      <div class="account-alert-content">
        <span>{{ $t('accounts.errors.loadTeams') }}</span>
        <v-btn variant="outlined" color="warning" size="small" @click="loadTeams">{{ $t('accounts.retry') }}</v-btn>
      </div>
    </v-alert>
    <v-data-table
      v-if="!loadError"
      ref="teamTable"
      v-model:page="page"
      :headers="headers"
      :items="filteredTeams"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="account-data-table"
      item-key="id"
      hide-default-footer
    >
      <template #top>
        <div class="account-table-toolbar account-table-toolbar--search">
          <v-text-field v-model="search" :label="$t('teams.search')" prepend-inner-icon="mdi-magnify" hide-details variant="outlined" clearable density="compact" />
          <v-btn v-if="hasActiveFilters" variant="text" color="primary" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">{{ $t('accounts.table.clearFilters') }}</v-btn>
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
          <v-icon :icon="hasActiveFilters ? 'mdi-filter-off-outline' : 'mdi-account-group-outline'" size="38" color="primary" aria-hidden="true" />
          <h2>{{ hasActiveFilters ? $t('accounts.table.noResults') : $t('accounts.table.noItems') }}</h2>
          <v-btn v-if="hasActiveFilters" color="primary" variant="outlined" @click="resetFilters">{{ $t('accounts.table.clearFilters') }}</v-btn>
        </div>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="account-identity">
          <v-icon :icon="item.ownerId ? 'mdi-account-lock-outline' : 'mdi-account-group-outline'" color="primary" size="20" aria-hidden="true" />
          <strong>{{ item.name }}</strong>
          <v-tooltip v-if="item.ownerId" :text="$t('teams.personalHint')" location="top">
            <template #activator="{ props }">
              <v-chip v-bind="props" size="x-small" color="primary" variant="tonal" label tabindex="0" :aria-label="$t('teams.personalHint')">{{ $t('teams.personal') }}</v-chip>
            </template>
          </v-tooltip>
        </div>
      </template>
      <template v-slot:[`item.description`]="{ item }">
        <span v-if="item.description">{{ item.description }}</span>
        <span v-else class="account-muted-value">—</span>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="account-actions">
          <v-tooltip :text="$t('global.edit')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="`${$t('global.edit')} ${item.name}`" :disabled="!writeUserPermission" @click="openEditTeamDialog(item)" /></template></v-tooltip>
          <v-tooltip :text="$t('global.delete')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small" :aria-label="`${$t('global.delete')} ${item.name}`" :disabled="!writeUserPermission || !!item.ownerId" @click="deleteTeam(item)" /></template></v-tooltip>
        </div>
      </template>
      <template #bottom>
        <footer v-if="!loading && filteredTeams.length > 0" class="account-table-footer">
          <div class="account-page-size"><span>{{ $t('accounts.table.rowsPerPage') }}</span><v-select v-model="itemsPerPage" :items="pageSizeOptions" density="compact" variant="outlined" hide-details :aria-label="$t('accounts.table.rowsPerPage')" /></div>
          <v-pagination v-model="page" :length="pageCount" :total-visible="paginationVisible" density="comfortable" :aria-label="$t('accounts.table.paginationLabel')" />
          <span class="account-page-range">{{ pageRange }}</span>
        </footer>
      </template>
    </v-data-table>

    <!-- Button to add a group -->
    <div class="legacy-create-control">
      <v-btn
        fab
        color="primary"
        style="margin-right: 6px;"
        @click="openCreateDialog"
        :disabled="!canCreateTeam"
      >
        <v-icon>mdi-plus</v-icon>
        <span class="sr-only">{{ $t('teams.actions.create') }}</span>
      </v-btn>
    </div>

    <!-- Dialog to edit a group -->
    <v-dialog v-model="editDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('teams.actions.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editedTeam.name"
            :label="$t('teams.form.name')"
            :readonly="!!editedTeam.ownerId"
            :hint="editedTeam.ownerId ? $t('teams.personalHint') : undefined"
            :persistent-hint="!!editedTeam.ownerId"
          ></v-text-field>
          <v-text-field
            v-model="editedTeam.description"
            :label="$t('teams.form.description')"
            type="text"
            multiline
            rows="2"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveEdit">{{ $t('global.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog for a new Team -->
    <v-dialog v-model="createDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('teams.actions.create') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="newTeam.name" :label="$t('teams.form.name')"></v-text-field>
          <v-text-field
            v-model="newTeam.description"
            :label="$t('teams.form.description')"
            type="text"
            multiline
            rows="2"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="createDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveCreate">{{ $t('global.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

export default defineComponent({
  name: 'TeamsTable',
  setup() {
    const { t } = useI18n()
    const { smAndDown } = useDisplay()
    interface Team {
      id?: string;
      name: string;
      description?: string;
      // solo en el equipo personal del usuario actual
      ownerId?: string | null;
    }
    const teams = ref<Team[]>([])
    const teamTable = ref<{ $el?: HTMLElement } | null>(null)
    const loading = ref(true)
    const loadError = ref(false)
    const search = ref<string | null>('')
    const page = ref(1)
    const itemsPerPage = ref(10)
    const pageSizeOptions = [10, 25, 50]
    const editDialog = ref(false)
    const createDialog = ref(false)
    const editedTeam = ref<Team | any>({})
    const newTeam = ref<Team>({ name: '', description: '' })

    const authStore = useAuthStore();
    const writeUserPermission = authStore.hasPermission('user:write')
    // un ayudante gestiona los equipos de su profesor, pero no crea otros
    const canCreateTeam = writeUserPermission && !authStore.isSupervised

    const headers = [
      { title: t('teams.name'), value: 'name' },
      { title: t('teams.form.description'), value: 'description' },
      { title: '', value: 'actions', sortable: false, align: 'end' as const },
    ]
    const hasActiveFilters = computed(() => Boolean(search.value?.trim()))
    const filteredTeams = computed(() => {
      const query = search.value?.trim().toLocaleLowerCase() ?? ''
      return teams.value.filter((team) => [team.name, team.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    })
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredTeams.value.length / itemsPerPage.value)))
    const paginationVisible = computed(() => smAndDown.value ? 3 : 7)
    const resultSummary = computed(() => t('accounts.table.resultCount', { filtered: filteredTeams.value.length, total: teams.value.length }))
    const pageRange = computed(() => {
      const start = filteredTeams.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
      const end = Math.min(page.value * itemsPerPage.value, filteredTeams.value.length)
      return t('accounts.table.pageRange', { start, end, total: filteredTeams.value.length })
    })

    watch([search, itemsPerPage], () => { page.value = 1 })
    watch(pageCount, (count) => { if (page.value > count) page.value = count })
    const resetFilters = () => { search.value = '' }
    const configureScrollableTable = async () => {
      await nextTick()
      const wrapper = teamTable.value?.$el?.querySelector<HTMLElement>('.v-table__wrapper')
      if (!wrapper) return
      wrapper.setAttribute('role', 'region')
      wrapper.setAttribute('tabindex', '0')
      wrapper.setAttribute('aria-label', t('accounts.table.tableRegion', { section: t('accounts.teams') }))
    }

    const loadTeams = async () => {
      loading.value = true
      loadError.value = false
      try {
        const res = await axios.get('/api/groups')
        teams.value = res.data
        await configureScrollableTable()
      } catch (e) {
        teams.value = []
        loadError.value = true
      }
      loading.value = false
    }

    const openEditTeamDialog = (group: Team) => {
      editedTeam.value = { ...group }
      editDialog.value = true
    }

    const saveEdit = async () => {
      try {
        await axios.put(`/api/groups/${editedTeam.value.id}`, editedTeam.value, handledApiErrorConfig)
        await loadTeams()
        editDialog.value = false
      } catch (e) {
        notifyApiError(e, 'saveTeam')
      }
    }

    const deleteTeam = async (group: Team) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: group.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/groups/${group.id}`, handledApiErrorConfig)
        await loadTeams()
      } catch (e) {
        notifyApiError(e, 'deleteTeam')
      }
    }

    const openCreateDialog = () => {
      newTeam.value = { name: '' }
      createDialog.value = true
    }

    const saveCreate = async () => {
      try {
        await axios.post('/api/groups', newTeam.value, handledApiErrorConfig)
        await loadTeams()
        createDialog.value = false
      } catch (e) {
        notifyApiError(e, 'createTeam')
      }
    }

    onMounted(() => {
      loadTeams()
    })

    return {
      teams,
      teamTable,
      headers,
      loading,
      loadError,
      loadTeams,
      search,
      filteredTeams,
      hasActiveFilters,
      resetFilters,
      resultSummary,
      page,
      itemsPerPage,
      pageSizeOptions,
      pageCount,
      paginationVisible,
      pageRange,
      editDialog,
      createDialog,
      editedTeam,
      newTeam,
      openEditTeamDialog,
      saveEdit,
      deleteTeam,
      openCreateDialog,
      saveCreate,
      writeUserPermission,
      canCreateTeam,
    }
  },
})
</script>
