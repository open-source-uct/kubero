<template>
  <v-container class="uct-management-page">
    <header class="uct-page-header">
      <div class="uct-page-header__identity">
        <div class="uct-page-header__icon" aria-hidden="true">
          <v-icon size="28" color="primary">mdi-memory</v-icon>
        </div>
        <h1 class="uct-h1">{{ $t('podsizes.name') }}</h1>
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        {{ $t('podsizes.actions.create') }}
      </v-btn>
    </header>
    <v-row>
      <v-col cols="12">
        <v-expansion-panels multiple elevation="0" class="uct-help-panels">
          <v-expansion-panel>
            <v-expansion-panel-title class="text-h6 font-weight-bold">{{ $t('podsizes.helpTitle') }}</v-expansion-panel-title>
            <v-expansion-panel-text><div v-html="$t('podsizes.helpText')"></div></v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
    <section class="uct-table-panel">
    <v-data-table
      :headers="headers"
      :items="podsizes"
      :loading="loading"
      class="uct-pipeline-table"
      item-key="id"
      item-value="name"
      :search="search"
      show-expand
    >
      <template #top>
        <div class="uct-table-toolbar">
          <v-text-field
            v-model="search"
            class="uct-table-search"
            :label="$t('podsizes.form.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
          ></v-text-field>
        </div>
        <div class="uct-table-summary" aria-live="polite">
          <span>{{ podsizes.length }} · {{ $t('podsizes.name') }}</span>
        </div>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="uct-table-identity">
          <v-icon icon="mdi-memory" color="primary" size="21" aria-hidden="true"></v-icon>
          <strong>{{ item.name }}</strong>
        </div>
      </template>
      <template v-slot:[`item.description`]="{ item }">
        <span>{{ item.description }}</span>
      </template>
      <template v-slot:[`item.resources`]="{ item }">
        <span>
          Requests: CPU {{ item.resources.requests.cpu }}, Mem {{ item.resources.requests.memory }}<br>
          Limits: CPU {{ item.resources.limits.cpu }}, Mem {{ item.resources.limits.memory }}
        </span>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="uct-table-actions">
          <v-tooltip :text="$t('global.edit')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="$t('podsizes.actions.edit')" @click="openEditDialog(item)"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip :text="$t('global.delete')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" size="small" color="error" :aria-label="$t('global.delete')" @click="deletePodsize(item)"></v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>
      <template v-slot:expanded-row="{ columns, item }">
        <tr>
          <td :colspan="columns.length" class="uct-expanded-cell">
            <v-card class="ma-2 pa-2 uct-card uct-expanded-card" color="cardBackground" elevation="0">
              <v-row>
                <v-col cols="12" md="6">
                  <v-list density="compact" class="uct-detail-list">
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold">Requests</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-subtitle>{{ $t('podsizes.form.cpu') }}</v-list-item-subtitle>
                      <v-list-item-title>{{ item.resources.requests.cpu }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-subtitle>{{ $t('podsizes.form.memory') }}</v-list-item-subtitle>
                      <v-list-item-title>{{ item.resources.requests.memory }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-col>
                <v-col cols="12" md="6">
                  <v-list density="compact" class="uct-detail-list">
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold">Limits</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-subtitle>{{ $t('podsizes.form.cpu') }}</v-list-item-subtitle>
                      <v-list-item-title>{{ item.resources.limits.cpu }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-subtitle>{{ $t('podsizes.form.memory') }}</v-list-item-subtitle>
                      <v-list-item-title>{{ item.resources.limits.memory }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
              <v-divider class="my-2"></v-divider>
              <v-row>
                <v-col cols="12">
                  <v-list density="compact" class="uct-detail-list">
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold">{{ $t('podsizes.form.description') }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>{{ item.description }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
            </v-card>
          </td>
        </tr>
      </template>
    </v-data-table>
    </section>
    <v-dialog v-model="editDialog" max-width="600px">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('podsizes.actions.edit') }}</v-card-title>
        <v-card-text v-if="editedPodsize">
          <v-text-field v-model="editedPodsize.name" :label="$t('podsizes.form.name')"></v-text-field>
          <v-text-field v-model="editedPodsize.description" :label="$t('podsizes.form.description')"></v-text-field>
          <PodsizeResourceFields v-model="editedPodsize.resources" />
        </v-card-text>
        <v-card-text v-else>
          <v-alert type="error" dismissible>
            {{ $t('podsizes.errors.loadingPodsize') }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" :disabled="!editedPodsize || !canSave(editedPodsize)" @click="saveEdit">{{ $t('global.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="createDialog" max-width="600px">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('podsizes.actions.create') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="newPodsize.name" :label="$t('podsizes.form.name')"></v-text-field>
          <v-text-field v-model="newPodsize.description" :label="$t('podsizes.form.description')"></v-text-field>
          <PodsizeResourceFields v-model="newPodsize.resources" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="createDialog = false">{{ $t('global.abort') }}</v-btn>
          <v-btn color="primary" :disabled="!canSave(newPodsize)" @click="saveCreate">{{ $t('global.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'
import {
  canonicalResources,
  PodsizeResources,
  requestAboveLimit,
  resourcesComplete,
} from '../../utils/podsizeOptions'
import PodsizeResourceFields from './ResourceFields.vue'


export default defineComponent({
  name: 'PodsizeList',
  components: { PodsizeResourceFields },
  setup() {
    const { t } = useI18n()
    type Podsize = {
      id?: string
      name: string
      description: string
      resources: PodsizeResources
    }
    const podsizes = ref<Podsize[]>([])
    const loading = ref(false)
    const search = ref('')
    const editDialog = ref(false)
    const createDialog = ref(false)
    const editedPodsize = ref<Podsize | null>(null)
    const newPodsize = ref<Podsize>({
      name: '',
      description: '',
      resources: {
        requests: { cpu: '', memory: '' },
        limits: { cpu: '', memory: '' },
      },
    })
    const headers = [
      { title: t('podsizes.name'), value: 'name' },
      { title: t('podsizes.form.description'), value: 'description' },
      //{ title: 'Resources', value: 'resources' },
      { title: '', value: 'actions', sortable: false, align: 'end' as const },
    ]
    const loadPodsizes = async () => {
      loading.value = true
      try {
        const res = await axios.get('/api/config/podsizes')
        podsizes.value = res.data
      } catch (e) {
        podsizes.value = []
      }
      loading.value = false
    }
    const openEditDialog = (podsize: any) => {
      const copy: Podsize = JSON.parse(JSON.stringify(podsize))
      // "0.5Gi" se muestra como la opción "512Mi", que es lo mismo
      copy.resources = canonicalResources(copy.resources)
      editedPodsize.value = copy
      editDialog.value = true
    }
    const canSave = (podsize: Podsize) => {
      const above = requestAboveLimit(podsize.resources)
      return !!podsize.name.trim() && resourcesComplete(podsize.resources) && !above.cpu && !above.memory
    }
    const saveEdit = async () => {
      try {
        await axios.put(`/api/config/podsizes/${editedPodsize?.value?.id }`, editedPodsize.value, handledApiErrorConfig)
        await loadPodsizes()
        editDialog.value = false
      } catch (e) {
        notifyApiError(e, 'savePodsize')
      }
    }
    const deletePodsize = async (podsize: any) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: podsize.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/config/podsizes/${podsize.id}`, handledApiErrorConfig)
        await loadPodsizes()
      } catch (e) {
        notifyApiError(e, 'deletePodsize')
      }
    }
    const openCreateDialog = () => {
      newPodsize.value = {
        name: '',
        description: '',
        resources: {
          requests: { cpu: '', memory: '' },
          limits: { cpu: '', memory: '' },
        },
      }
      createDialog.value = true
    }
    const saveCreate = async () => {
      try {
        const payload = JSON.parse(JSON.stringify(newPodsize.value))
        delete payload.id
        await axios.post('/api/config/podsizes', payload, handledApiErrorConfig)
        await loadPodsizes()
        createDialog.value = false
      } catch (e) {
        notifyApiError(e, 'createPodsize')
      }
    }
    onMounted(() => {
      loadPodsizes()
    })
    return {
      podsizes,
      headers,
      loading,
      search,
      openEditDialog,
      canSave,
      deletePodsize,
      editDialog,
      editedPodsize,
      saveEdit,
      createDialog,
      newPodsize,
      openCreateDialog,
      saveCreate,
    }
  },
})
</script>

<style scoped>
</style>
