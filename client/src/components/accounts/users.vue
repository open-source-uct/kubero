<template>
  <v-container>
    <v-alert v-if="loadError" type="warning" variant="tonal" class="ma-4">
      <div class="d-flex align-center justify-space-between ga-4">
        <span>{{ $t('accounts.errors.loadUsers') }}</span>
        <v-btn variant="outlined" color="warning" size="small" @click="loadUsers">{{ $t('accounts.retry') }}</v-btn>
      </div>
    </v-alert>
    <v-data-table
      v-if="!loadError"
      ref="userTable"
      v-model:page="page"
      :headers="headers"
      :items="filteredUsers"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="account-data-table account-data-table--wide"
      item-key="id"
      hide-default-footer
    >
      <template #top>
        <div class="account-table-toolbar account-table-toolbar--filters">
          <v-text-field v-model="search" class="account-table-toolbar__search" :label="$t('user.actions.search')" prepend-inner-icon="mdi-magnify" hide-details variant="outlined" clearable density="compact" />
          <v-select v-model="roleFilter" :items="roleFilterOptions" :label="$t('accounts.userFilters.role')" hide-details variant="outlined" density="compact" />
          <v-select v-model="teamFilter" :items="teamFilterOptions" :label="$t('accounts.userFilters.team')" hide-details variant="outlined" density="compact" />
          <v-select v-model="statusFilter" :items="statusFilterOptions" :label="$t('accounts.userFilters.status')" hide-details variant="outlined" density="compact" />
          <v-btn v-if="hasActiveFilters" class="account-table-toolbar__clear" variant="text" color="primary" prepend-icon="mdi-filter-remove-outline" @click="resetFilters">
            {{ $t('accounts.userFilters.clear') }}
          </v-btn>
        </div>
        <div class="account-table-summary" aria-live="polite">
          <span>{{ $t('accounts.userFilters.resultCount', { filtered: filteredUsers.length, total: users.length }) }}</span>
          <v-chip v-if="hasActiveFilters" size="small" variant="tonal" color="primary" label>{{ $t('accounts.table.filtered') }}</v-chip>
        </div>
      </template>
      <template v-slot:[`header.actions`]><span class="sr-only">{{ $t('accounts.table.actions') }}</span></template>
      <template #loading><v-skeleton-loader type="table-row@6" /></template>
      <template #no-data>
        <div class="account-empty-state">
          <v-icon :icon="hasActiveFilters ? 'mdi-filter-off-outline' : 'mdi-account-off-outline'" size="38" color="primary" aria-hidden="true" />
          <h2>{{ hasActiveFilters ? $t('accounts.userFilters.noResults') : $t('accounts.userFilters.noUsers') }}</h2>
          <v-btn v-if="hasActiveFilters" variant="outlined" color="primary" @click="resetFilters">{{ $t('accounts.userFilters.clear') }}</v-btn>
        </div>
      </template>
      <template v-slot:[`item.isActive`]="{ item }">
        <v-chip :color="item.isActive ? 'success' : 'error'" variant="tonal" size="small" label>
          {{ item.isActive ? $t('user.active') : $t('user.disabled') }}
        </v-chip>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <span>{{ item.firstName }} {{ item.lastName }}</span>
      </template>
      <template v-slot:[`item.role`]="{ item }">
        <span v-if="item.role">
          <v-chip
            class="ma-2"
            color="primary"
            label
          >
            <v-icon icon="mdi-account-circle-outline" start></v-icon>
            {{ item.role.name}}
          </v-chip>
        </span>
        <span v-else></span>
      </template>
      <template v-slot:[`item.userGroups`]="{ item }">
        <span v-if="item.userGroups && item.userGroups.length">
          <span v-for="team in item.userGroups" :key="team.id">
            <v-chip
              class="ma-2"
              color="grey"
              size="small"
              prepend-icon="mdi-account-group"
              closable-disabled
              @click:close="deleteGroupFromUser(team, item)"
            >
              {{ team.name }}
            </v-chip>
          </span>
        </span>
        <span v-else></span>
        <v-btn
          class="ma-2"
          color="grey"
          size="small"
          icon="mdi-plus"
          density="compact"
          variant="tonal"
          style="display: none;"
          >
        </v-btn>
      </template>
      <template v-slot:[`item.username`]="{ item }">
        <div class="account-identity">
          <v-avatar size="30" class="mr-2">
            <v-img :src="item.image || '/img/icons/avatar.svg'" alt="User avatar" />
          </v-avatar><strong>{{ item.username }}</strong>
        </div>
      </template>
      <template v-slot:[`item.createdAt`]="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
      <template v-slot:[`item.updatedAt`]="{ item }">
        {{ formatDate(item.updatedAt) }}
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="account-actions">
          <v-tooltip :text="$t('global.delete')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small" :aria-label="`${$t('global.delete')} ${item.username}`" :disabled="item.username === 'admin' || item.username === 'system' || !writeUserPermission" @click="deleteUser(item)" /></template></v-tooltip>
          <v-tooltip :text="$t('user.changePassword')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-lock-reset" variant="text" size="small" :aria-label="$t('user.changePasswordFor', { user: item.username })" :disabled="item.username === 'system' || !writeUserPermission" @click="openChangePasswordDialog(item)" /></template></v-tooltip>
          <v-tooltip :text="$t('global.edit')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="`${$t('global.edit')} ${item.username}`" :disabled="item.username === 'admin' || item.username === 'system' || !writeUserPermission" @click="openEditUserDialog(item)" /></template></v-tooltip>
        </div>
      </template>
      <template #bottom>
        <footer v-if="!loading && filteredUsers.length > 0" class="account-table-footer">
          <div class="account-page-size"><span>{{ $t('accounts.table.rowsPerPage') }}</span><v-select v-model="itemsPerPage" :items="pageSizeOptions" density="compact" variant="outlined" hide-details :aria-label="$t('accounts.table.rowsPerPage')" /></div>
          <v-pagination v-model="page" :length="pageCount" :total-visible="paginationVisible" density="comfortable" :aria-label="$t('accounts.table.paginationLabel')" />
          <span class="account-page-range">{{ pageRange }}</span>
        </footer>
      </template>
    </v-data-table>

    <!-- Button to add a user -->
    <div class="legacy-create-control">
      <v-btn
        fab
        color="primary"
        style="margin-right: 6px;"
        @click="openCreateDialog"
        :disabled="!writeUserPermission"
      >
        <v-icon>mdi-plus</v-icon>
        <span class="sr-only">{{ $t('user.actions.create') }}</span>
      </v-btn>
    </div>

    <!-- Dialog to edit a user -->
    <v-dialog v-model="editDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('user.actions.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="editedUser.username" :label="$t('user.username')"></v-text-field>
          <v-text-field v-model="editedUser.firstName" :label="$t('user.firstName')"></v-text-field>
          <v-text-field v-model="editedUser.lastName" :label="$t('user.lastName')"></v-text-field>
          <v-text-field v-model="editedUser.email" :label="$t('user.email')"></v-text-field>
          <v-switch v-model="editedUser.isActive" :label="$t('user.active')" color="primary"></v-switch>
          <v-select
            v-model="editedUser.role"
            :items="roles"
            item-title="name"
            item-value="id"
            :label="$t('user.role')"
            clearable
          ></v-select>
          <v-select
            v-model="editedUser.userGroups"
            :items="teams"
            item-title="name"
            item-value="id"
            :label="$t('user.teams')"
            multiple
            clearable
          >
            <template v-slot:selection="{ item }">
              <v-chip :text="item.title"></v-chip>
            </template>
          </v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveEdit">{{ $t('global.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog for a new User -->
    <v-dialog v-model="createDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('user.actions.create') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="newUser.username" :label="$t('user.username')"></v-text-field>
          <v-text-field v-model="newUser.firstName" :label="$t('user.firstName')"></v-text-field>
          <v-text-field v-model="newUser.lastName" :label="$t('user.lastName')"></v-text-field>
          <v-text-field v-model="newUser.email" :label="$t('user.email')"></v-text-field>
          <v-text-field
            v-model="newUser.password"
            :label="$t('user.password')"
            :type="showNewUserPassword ? 'text' : 'password'"
            :append-inner-icon="showNewUserPassword ? 'mdi-eye-off' : 'mdi-eye'"
            append-icon="mdi-key-variant"
            @click:append-inner="showNewUserPassword = !showNewUserPassword"
            @click:append="generateNewUserPassword"
          ></v-text-field>
          <v-switch v-model="newUser.isActive" :label="$t('user.active')" color="primary"></v-switch>
          <v-select
            v-model="newUser.role"
            :items="roles"
            item-title="name"
            item-value="id"
            :label="$t('user.role')"
            clearable
          ></v-select>
          <v-select
            v-model="newUser.userGroups"
            :items="teams"
            item-title="name"
            item-value="id"
            :label="$t('user.teams')"
            multiple
            clearable
          >
            <template v-slot:selection="{ item }">
              <v-chip :text="item.title"></v-chip>
            </template>
          </v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="createDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveCreate">{{ $t('global.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog to change password -->
    <v-dialog v-model="changePasswordDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('user.changePasswordFor', {user: editedUser.username}) }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editedUser.password"
            :label="$t('user.newPassword')"
            :type="showChangePassword ? 'text' : 'password'"
            :append-inner-icon="showChangePassword ? 'mdi-eye-off' : 'mdi-eye'"
            append-icon="mdi-key-variant"
            @click:append-inner="showChangePassword = !showChangePassword"
            @click:append="generateEditedUserPassword"
          ></v-text-field>
          <v-text-field
            v-model="editedUser.confirmPassword"
            :label="$t('user.confirmPassword')"
            :type="showConfirmPassword ? 'text' : 'password'"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="changePasswordDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveChangePassword">{{ $t('user.changePassword') }}</v-btn>
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
  name: 'UserList',
  setup() {

    const { t } = useI18n()
    const { smAndDown } = useDisplay()
    interface User {
      id: string | number;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      image?: string;
      role?: {
        id: number;
        name: string;
      };
      userGroups?: {
        id: number;
        name: string;
      }[];
    }
    interface Team {
      id: string | number;
      name: string;
    }
    interface Role {
      id: string | number;
      name: string;
    }
    const users = ref<User[]>([])
    const userTable = ref<{ $el?: HTMLElement } | null>(null)
    const loading = ref(true)
    const loadError = ref(false)
    const search = ref<string | null>('')
    const roleFilter = ref<string | number>('all')
    const teamFilter = ref<string | number>('all')
    const statusFilter = ref('all')
    const page = ref(1)
    const itemsPerPage = ref(10)
    const pageSizeOptions = [10, 25, 50]
    const editDialog = ref(false)
    const createDialog = ref(false)
    const changePasswordDialog = ref(false)
    const editedUser = ref<User | any>({})
    const newUser = ref({
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      isActive: true,
      password: '',
      role: null,
      userGroups: [],
    })

    const showNewUserPassword = ref(false)
    const showChangePassword = ref(false)
    const showConfirmPassword = ref(false)

    const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const generateRandomPassword = (length = 12): string => {
      const limit = 256 - (256 % PASSWORD_CHARS.length)
      let result = ''
      while (result.length < length) {
        const bytes = new Uint8Array(length)
        crypto.getRandomValues(bytes)
        for (const byte of bytes) {
          if (byte < limit && result.length < length) {
            result += PASSWORD_CHARS[byte % PASSWORD_CHARS.length]
          }
        }
      }
      return result
    }
    const generateNewUserPassword = () => {
      newUser.value.password = generateRandomPassword()
      showNewUserPassword.value = true
    }
    const generateEditedUserPassword = () => {
      const password = generateRandomPassword()
      editedUser.value.password = password
      editedUser.value.confirmPassword = password
      showChangePassword.value = true
      showConfirmPassword.value = true
    }

    const teams = ref<Team[]>([])
    const roles = ref<Role[]>([])
    const authStore = useAuthStore();
    const writeUserPermission = authStore.hasPermission('user:write')

    const headers = [
      { title: t('user.username'), value: 'username' },
      { title: t('global.name'), value: 'name' },
      //{ title: 'First Name', value: 'firstName' },
      //{ title: 'Last Name', value: 'lastName' },
      { title: t('user.email'), value: 'email' },
      { title: t('user.role'), value: 'role', sortable: false },
      { title: t('user.teams'), value: 'userGroups', sortable: false },
      /*
      { text: 'Created', value: 'createdAt' },
      { text: 'Updated', value: 'updatedAt' },
      */
      { title: t('user.status'), value: 'isActive' },
      { title: '', value: 'actions', sortable: false, align: 'end' as const },
    ]

    const roleFilterOptions = computed(() => {
      const available = new Map<string, Role>()
      for (const role of roles.value) available.set(String(role.id), role)
      for (const user of users.value) if (user.role) available.set(String(user.role.id), user.role)
      return [
        { title: t('accounts.userFilters.allRoles'), value: 'all' },
        ...[...available.values()].sort((a, b) => a.name.localeCompare(b.name)).map((role) => ({ title: role.name, value: role.id })),
      ]
    })
    const teamFilterOptions = computed(() => {
      const available = new Map<string, Team>()
      for (const team of teams.value) available.set(String(team.id), team)
      for (const user of users.value) for (const team of user.userGroups ?? []) available.set(String(team.id), team)
      return [
        { title: t('accounts.userFilters.allTeams'), value: 'all' },
        ...[...available.values()].sort((a, b) => a.name.localeCompare(b.name)).map((team) => ({ title: team.name, value: team.id })),
      ]
    })
    const statusFilterOptions = computed(() => [
      { title: t('accounts.userFilters.allStatuses'), value: 'all' },
      { title: t('user.active'), value: 'active' },
      { title: t('user.disabled'), value: 'disabled' },
    ])
    const hasActiveFilters = computed(() => Boolean(search.value?.trim()) || roleFilter.value !== 'all' || teamFilter.value !== 'all' || statusFilter.value !== 'all')
    const filteredUsers = computed(() => {
      const query = search.value?.trim().toLocaleLowerCase() ?? ''
      return users.value.filter((user) => {
        const searchable = [user.username, user.firstName, user.lastName, user.email, user.role?.name, ...(user.userGroups?.map((team) => team.name) ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
        const matchesSearch = !query || searchable.includes(query)
        const matchesRole = roleFilter.value === 'all' || user.role?.id === roleFilter.value
        const matchesTeam = teamFilter.value === 'all' || user.userGroups?.some((team) => team.id === teamFilter.value)
        const matchesStatus = statusFilter.value === 'all' || (statusFilter.value === 'active' ? user.isActive : !user.isActive)
        return matchesSearch && matchesRole && matchesTeam && matchesStatus
      })
    })
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / itemsPerPage.value)))
    const paginationVisible = computed(() => smAndDown.value ? 3 : 7)
    const pageRange = computed(() => {
      const start = filteredUsers.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
      const end = Math.min(page.value * itemsPerPage.value, filteredUsers.value.length)
      return t('accounts.table.pageRange', { start, end, total: filteredUsers.value.length })
    })

    watch([search, roleFilter, teamFilter, statusFilter, itemsPerPage], () => { page.value = 1 })
    watch(pageCount, (count) => { if (page.value > count) page.value = count })

    const resetFilters = () => {
      search.value = ''
      roleFilter.value = 'all'
      teamFilter.value = 'all'
      statusFilter.value = 'all'
    }

    const configureScrollableTable = async () => {
      await nextTick()
      const wrapper = userTable.value?.$el?.querySelector<HTMLElement>('.v-table__wrapper')
      if (!wrapper) return
      wrapper.setAttribute('role', 'region')
      wrapper.setAttribute('tabindex', '0')
      wrapper.setAttribute('aria-label', t('accounts.userFilters.tableRegion'))
    }

    const loadUsers = async () => {
      loading.value = true
      loadError.value = false
      try {
        const res = await axios.get('/api/users')
        users.value = res.data
        await configureScrollableTable()
      } catch (e) {
        users.value = []
        loadError.value = true
      }
      loading.value = false
    }

    const loadTeams = async () => {
      try {
        const res = await axios.get('/api/groups')
        teams.value = res.data
      } catch (e) {
        teams.value = []
      }
    }
    const loadRoles = async () => {
      try {
        const res = await axios.get('/api/roles')
        roles.value = res.data
      } catch (e) {
        roles.value = []
      }
    }

    const openEditUserDialog = async (user: User) => {
      editedUser.value = { ...user }
      // los equipos y roles se pueden haber creado o borrado en otra pestaña
      // desde que se cargó esta pantalla: se recargan al abrir el formulario
      await Promise.all([loadTeams(), loadRoles()])
      editDialog.value = true
    }

    const saveEdit = async () => {
      try {
        await axios.put(`/api/users/id/${editedUser.value.id}`, editedUser.value, handledApiErrorConfig)
        await loadUsers()
        editDialog.value = false
      } catch (e) {
        notifyApiError(e, 'saveUser')
      }
    }

    const deleteUser = async (user: User) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: user.username }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/users/id/${user.id}`, handledApiErrorConfig)
        await loadUsers()
      } catch (e) {
        notifyApiError(e, 'deleteUser')
      }
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const openCreateDialog = async () => {
      // Antes la lista de equipos se cargaba solo al abrir la pestaña: si un
      // equipo se borraba y se volvía a crear (id nuevo), el formulario seguía
      // ofreciendo el id viejo y el alta fallaba sin ningún mensaje hasta
      // refrescar la página.
      await Promise.all([loadTeams(), loadRoles()])
      newUser.value = {
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        isActive: true,
        role: null,
        userGroups: [],
      }
      createDialog.value = true
    }

    const saveCreate = async () => {
      try {
        await axios.post('/api/users', newUser.value, handledApiErrorConfig)
        await loadUsers()
        createDialog.value = false
      } catch (e) {
        notifyApiError(e, 'createUser')
      }
    }

    const openChangePasswordDialog = (user: User) => {
      editedUser.value = { ...user }
      changePasswordDialog.value = true
    }

    const saveChangePassword = async () => {
      if (editedUser.value.password !== editedUser.value.confirmPassword) {
        alert('Passwords do not match!')
        return
      }
      try {
        await axios.put(`/api/users/id/${editedUser.value.id}/password`, {
          password: editedUser.value.password,
        }, handledApiErrorConfig)
        changePasswordDialog.value = false
      } catch (e) {
        notifyApiError(e, 'changeUserPassword')
      }
    }

    const deleteGroupFromUser = async (team: any, user: User) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmRemove.title', { name: team.name }),
        text: t('feedback.confirmRemove.message'),
        confirmButtonText: t('global.remove'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/users/${user.id}/groups/${team.id}`, handledApiErrorConfig)
        await loadUsers()
      } catch (e) {
        notifyApiError(e, 'removeUserTeam')
      }
    }

    onMounted(() => {
      loadUsers()
      loadTeams()
      loadRoles()
    })

    return {
      users,
      userTable,
      headers,
      loading,
      loadError,
      loadUsers,
      search,
      roleFilter,
      teamFilter,
      statusFilter,
      roleFilterOptions,
      teamFilterOptions,
      statusFilterOptions,
      filteredUsers,
      page,
      itemsPerPage,
      pageSizeOptions,
      pageCount,
      paginationVisible,
      pageRange,
      hasActiveFilters,
      resetFilters,
      openEditUserDialog,
      deleteUser,
      editDialog,
      editedUser,
      saveEdit,
      formatDate,
      createDialog,
      newUser,
      openCreateDialog,
      changePasswordDialog,
      openChangePasswordDialog,
      saveChangePassword,
      showNewUserPassword,
      showChangePassword,
      showConfirmPassword,
      generateNewUserPassword,
      generateEditedUserPassword,
      deleteGroupFromUser,
      saveCreate,
      roles,
      teams,
      writeUserPermission,
    }
  },
})
</script>
