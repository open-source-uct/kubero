<template>
  <v-container>
    <v-alert v-if="loadError" type="warning" variant="tonal" class="ma-4">
      <div class="account-alert-content">
        <span>{{ $t('accounts.errors.loadRoles') }}</span>
        <v-btn variant="outlined" color="warning" size="small" @click="loadRoles">{{ $t('accounts.retry') }}</v-btn>
      </div>
    </v-alert>
    <v-data-table
      v-if="!loadError"
      ref="roleTable"
      v-model:page="page"
      :headers="headers"
      :items="filteredRoles"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="account-data-table account-data-table--wide"
      item-key="id"
      hide-default-footer
    >
      <template #top>
        <div class="account-table-toolbar account-table-toolbar--search">
          <v-text-field v-model="search" :label="$t('roles.search')" prepend-inner-icon="mdi-magnify" hide-details variant="outlined" clearable density="compact" />
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
          <v-icon :icon="hasActiveFilters ? 'mdi-filter-off-outline' : 'mdi-shield-account-outline'" size="38" color="primary" aria-hidden="true" />
          <h2>{{ hasActiveFilters ? $t('accounts.table.noResults') : $t('accounts.table.noItems') }}</h2>
          <v-btn v-if="hasActiveFilters" color="primary" variant="outlined" @click="resetFilters">{{ $t('accounts.table.clearFilters') }}</v-btn>
        </div>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="account-identity"><v-icon icon="mdi-shield-account-outline" color="primary" size="20" aria-hidden="true" /><strong>{{ item.name }}</strong></div>
      </template>
      <template v-slot:[`item.permissions`]="{ item }">
        <span v-for="permission in item.permissions" :key="permission.id">
          {{ permission.resource }}: {{ permission.action }}
        </span>
      </template>
      <template v-slot:[`item.permissionsApp`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'app')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'app') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsPipeline`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'pipeline')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'pipeline') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsAccount`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'user')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'user') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsConfig`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'config')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'config') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsAudit`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'audit')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'audit') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsToken`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'token')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'token') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsConsole`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'console')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'console') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsLogs`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'logs')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'logs') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.permissionsReboot`]="{ item }">
        <span role="img" :aria-label="getResourcePermissionLabel(item.permissions, 'reboot')">
          <v-icon
            color="primary"
            aria-hidden="true"
          >
            {{getResourcePermissions(item.permissions, 'reboot') }}
          </v-icon>
        </span>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="account-actions">
          <v-tooltip :text="$t('global.edit')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="`${$t('global.edit')} ${item.name}`" :disabled="item.name === 'admin' || !canManageRoles" @click="openEditRoleDialog(item)" /></template></v-tooltip>
          <v-tooltip :text="$t('global.delete')" location="top"><template #activator="{ props }"><v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small" :aria-label="`${$t('global.delete')} ${item.name}`" :disabled="isFixedRole(item.name) || !canManageRoles" @click="deleteRole(item)" /></template></v-tooltip>
        </div>
      </template>
      <template #bottom>
        <footer v-if="!loading && filteredRoles.length > 0" class="account-table-footer">
          <div class="account-page-size"><span>{{ $t('accounts.table.rowsPerPage') }}</span><v-select v-model="itemsPerPage" :items="pageSizeOptions" density="compact" variant="outlined" hide-details :aria-label="$t('accounts.table.rowsPerPage')" /></div>
          <v-pagination v-model="page" :length="pageCount" :total-visible="paginationVisible" density="comfortable" :aria-label="$t('accounts.table.paginationLabel')" />
          <span class="account-page-range">{{ pageRange }}</span>
        </footer>
      </template>
    </v-data-table>

    <!-- Dialog to edit a role -->
    <v-dialog v-model="editDialog" max-width="500px">
      <v-card color="cardBackground" class="uct-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('roles.actions.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="editedRole.name" :disabled="isFixedRole(editedRole.name)" :label="$t('roles.form.name')"></v-text-field>
          <v-text-field v-model="editedRole.description" :label="$t('roles.form.description')"></v-text-field>
          <v-table density="compact" class="mb-4">
            <tbody>
              <tr>
                <td>{{ $t('roles.form.permissions.apps') }} {{ $t('roles.permission') }}</td>
                <td>
                  <v-radio-group v-model="editedRole.permissions[0].action" inline>
                    <v-radio label="none" value="none"></v-radio>
                    <v-radio label="read" value="read"></v-radio>
                    <v-radio label="write" value="write"></v-radio>
                  </v-radio-group>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.pipelines') }} {{ $t('roles.permission') }}</td>
                <td>
                  <v-radio-group v-model="editedRole.permissions[1].action" inline>
                    <v-radio label="none" value="none"></v-radio>
                    <v-radio label="read" value="read"></v-radio>
                    <v-radio label="write" value="write"></v-radio>
                  </v-radio-group>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.accounts') }} {{ $t('roles.permission') }}</td>
                <td>
                  <v-radio-group v-model="editedRole.permissions[2].action" inline>
                    <v-radio label="none" value="none"></v-radio>
                    <v-radio label="read" value="read"></v-radio>
                    <v-radio label="write" value="write"></v-radio>
                  </v-radio-group>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.settings') }} {{ $t('roles.permission') }}</td>
                <td>
                  <v-radio-group v-model="editedRole.permissions[3].action" inline>
                    <v-radio label="none" value="none"></v-radio>
                    <v-radio label="read" value="read"></v-radio>
                    <v-radio label="write" value="write"></v-radio>
                  </v-radio-group>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.tokens') }} {{ $t('roles.permission') }}</td>
                <td>
                  <v-radio-group v-model="editedRole.permissions[4].action" inline>
                    <v-radio label="none" value="none"></v-radio>
                    <v-radio label="own" value="ok"></v-radio>
                    <v-radio label="all" value="write"></v-radio>
                  </v-radio-group>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.audit') }}</td>
                <td>
                  <v-switch color="primary" value="ok" false-value="none" v-model="editedRole.permissions[5].action" label=""></v-switch>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.console') }}</td>
                <td>
                  <v-switch color="primary" value="ok" false-value="none" v-model="editedRole.permissions[6].action" label=""></v-switch>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.logs') }}</td>
                <td>
                  <v-switch color="primary" value="ok" false-value="none" v-model="editedRole.permissions[7].action" label=""></v-switch>
                </td>
              </tr>
              <tr>
                <td>{{ $t('roles.form.permissions.reboot') }}</td>
                <td>
                  <v-switch color="primary" value="ok" false-value="none" v-model="editedRole.permissions[8].action" label=""></v-switch>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" @click="saveEdit">{{ $t('global.save') }}</v-btn>
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
  name: 'RolesTable',
  setup() {
    const { t } = useI18n()
    const { smAndDown } = useDisplay()
    interface Role {
      id: string | number;
      name: string;
      description?: string;
      scopeToOwnTeam?: boolean;
      priority?: number;
      permissions?: Permission[];
    }
    interface Permission {
      id: string | number;
      resource: string;
      action: string;
    }
    // Mismo listado que RolesService.FIXED_ROLES en el servidor: ninguno de
    // estos se puede crear, borrar ni renombrar — solo editar sus permisos.
    const FIXED_ROLES = ['admin', 'webmaster', 'profesor', 'estudiante']
    const isFixedRole = (name: string) => FIXED_ROLES.includes(name)
    const roles = ref<Role[]>([])
    const roleTable = ref<{ $el?: HTMLElement } | null>(null)
    const loading = ref(true)
    const loadError = ref(false)
    const search = ref<string | null>('')
    const page = ref(1)
    const itemsPerPage = ref(10)
    const pageSizeOptions = [10, 25, 50]
    const editDialog = ref(false)
    const editedRole = ref<Role | any>({})
    // Orden de las filas de los diálogos: los v-model usan estas posiciones
    const RESOURCES = ['app', 'pipeline', 'user', 'config', 'token', 'audit', 'console', 'logs', 'reboot']
    // Los permisos llegan de la BD en el orden en que se crearon, que no es el
    // de los diálogos (en los roles de la semilla la fila "Console" editaba
    // audit, y así). Se arman por recurso para que cada fila edite el suyo.
    const permissionsByResource = (permissions: Permission[] = []) =>
      RESOURCES.map((resource) => ({
        resource,
        action: permissions.find((p) => p.resource === resource)?.action ?? 'none',
      }))
    const authStore = useAuthStore();
    const writeUserPermission = authStore.hasPermission('user:write')
    // los roles son definiciones globales del sistema: un usuario acotado a
    // su propio equipo puede verlos (para saber cuál asignar), pero nunca
    // crear, editar ni borrar ninguno
    const canManageRoles = writeUserPermission && !authStore.scopeToOwnTeam

    const headers = [
      { title: t('roles.name'), value: 'name' },
      //{ title: 'Permissions', value: 'permissions' },
      { title: t('roles.form.permissions.apps'), value: 'permissionsApp', align: 'center' as const },
      { title: t('roles.form.permissions.pipelines'), value: 'permissionsPipeline', align: 'center' as const },
      { title: t('roles.form.permissions.accounts'), value: 'permissionsAccount', align: 'center' as const},
      { title: t('roles.form.permissions.settings'), value: 'permissionsConfig', align: 'center' as const},
      { title: t('roles.form.permissions.tokens'), value: 'permissionsToken', align: 'center' as const},
      { title: t('roles.form.permissions.audit'), value: 'permissionsAudit', align: 'center' as const},
      { title: t('roles.form.permissions.console'), value: 'permissionsConsole', align: 'center' as const},
      { title: t('roles.form.permissions.logs'), value: 'permissionsLogs', align: 'center' as const},
      { title: t('roles.form.permissions.reboot'), value: 'permissionsReboot', align: 'center' as const},

      { title: '', value: 'actions', sortable: false, align: 'end' as const },
    ]
    const hasActiveFilters = computed(() => Boolean(search.value?.trim()))
    const filteredRoles = computed(() => {
      const query = search.value?.trim().toLocaleLowerCase() ?? ''
      return roles.value.filter((role) => [role.name, role.description, ...(role.permissions ?? []).flatMap((permission) => [permission.resource, permission.action])]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    })
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredRoles.value.length / itemsPerPage.value)))
    const paginationVisible = computed(() => smAndDown.value ? 3 : 7)
    const resultSummary = computed(() => t('accounts.table.resultCount', { filtered: filteredRoles.value.length, total: roles.value.length }))
    const pageRange = computed(() => {
      const start = filteredRoles.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1
      const end = Math.min(page.value * itemsPerPage.value, filteredRoles.value.length)
      return t('accounts.table.pageRange', { start, end, total: filteredRoles.value.length })
    })

    watch([search, itemsPerPage], () => { page.value = 1 })
    watch(pageCount, (count) => { if (page.value > count) page.value = count })
    const resetFilters = () => { search.value = '' }
    const configureScrollableTable = async () => {
      await nextTick()
      const wrapper = roleTable.value?.$el?.querySelector<HTMLElement>('.v-table__wrapper')
      if (!wrapper) return
      wrapper.setAttribute('role', 'region')
      wrapper.setAttribute('tabindex', '0')
      wrapper.setAttribute('aria-label', t('accounts.table.tableRegion', { section: t('accounts.roles') }))
    }

    const loadRoles = async () => {
      loading.value = true
      loadError.value = false
      try {
        const res = await axios.get('/api/roles')
        roles.value = res.data
        await configureScrollableTable()
      } catch (e) {
        roles.value = []
        loadError.value = true
      }
      loading.value = false
    }

    const openEditRoleDialog = (role: Role) => {
      editedRole.value = { ...role, permissions: permissionsByResource(role.permissions) }
      editDialog.value = true
    }

    const saveEdit = async () => {
      try {
        await axios.put(`/api/roles/${editedRole.value.id}`, editedRole.value, handledApiErrorConfig)
        await loadRoles()
        editDialog.value = false
      } catch (e) {
        notifyApiError(e, 'saveRole')
      }
    }

    const deleteRole = async (role: Role) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: role.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/roles/${role.id}`, handledApiErrorConfig)
        await loadRoles()
      } catch (e) {
        notifyApiError(e, 'deleteRole')
      }
    }

/*
    const getResources = async () => {
      try {
        const res = await axios.get('/api/roles/resources')
        return res.data
      } catch (e) {
        console.error('Error fetching resources:', e)
        return []
      }
    }
*/
    const getResourcePermissions = (permissions: any, resource: string) => {
      for (const permission of permissions) {
        if (permission.resource === resource) {
          switch (permission.action) {
            case 'write':
              return 'mdi-pencil';
            case 'read':
              return 'mdi-eye';
            case 'ok':
              return 'mdi-check';
            default:
              return 'mdi-minus';
          }
        }
      }
      return 'mdi-cancel'
    }
    const resourceLabelKeys: Record<string, string> = {
      app: 'roles.form.permissions.apps',
      pipeline: 'roles.form.permissions.pipelines',
      user: 'roles.form.permissions.accounts',
      config: 'roles.form.permissions.settings',
      token: 'roles.form.permissions.tokens',
      audit: 'roles.form.permissions.audit',
      console: 'roles.form.permissions.console',
      logs: 'roles.form.permissions.logs',
      reboot: 'roles.form.permissions.reboot',
    }
    const getResourcePermissionLabel = (permissions: Permission[] = [], resource: string) => {
      const level = permissions.find((permission) => permission.resource === resource)?.action ?? 'none'
      return t('roles.permissionLabel', {
        resource: t(resourceLabelKeys[resource]),
        level: t(`roles.levels.${level}`),
      })
    }
    onMounted(() => {
      loadRoles()
    })

    return {
      roles,
      roleTable,
      headers,
      loading,
      loadError,
      loadRoles,
      search,
      filteredRoles,
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
      editedRole,
      openEditRoleDialog,
      saveEdit,
      deleteRole,
      getResourcePermissions,
      getResourcePermissionLabel,
      writeUserPermission,
      canManageRoles,
      isFixedRole,
    }
  },
})
</script>
