<template>

  <v-container class="uct-management-page">
    <header class="uct-page-header">
      <div class="uct-page-header__identity">
        <div class="uct-page-header__icon" aria-hidden="true">
          <v-icon size="28" color="primary">mdi-layers-triple-outline</v-icon>
        </div>
        <h1 class="uct-h1">{{ $t('runpacks.name') }}</h1>
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        {{ $t('runpacks.actions.create') }}
      </v-btn>
    </header>
    <v-row>
      <v-col cols="12">
        <v-expansion-panels multiple elevation="0" class="uct-help-panels">
          <v-expansion-panel>
            <v-expansion-panel-title class="text-h6 font-weight-bold">{{ $t('runpacks.helpTitle') }}</v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-html="$t('runpacks.helpText')"></div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
    
    <section class="uct-table-panel">
    <v-data-table
      :headers="headers"
      :items="runpacks"
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
            :label="$t('runpacks.form.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
          ></v-text-field>
        </div>
        <div class="uct-table-summary" aria-live="polite">
          <span>{{ runpacks.length }} · {{ $t('runpacks.name') }}</span>
        </div>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="uct-table-identity">
          <v-icon icon="mdi-layers-triple-outline" color="primary" size="21" aria-hidden="true"></v-icon>
          <strong>{{ item.name }}</strong>
        </div>
      </template>
      <template v-slot:[`item.language`]="{ item }">
        <v-chip size="small" variant="tonal" color="primary" label>{{ item.language }}</v-chip>
      </template>
      <template v-slot:[`item.fetch`]="{ item }">
        <span class="uct-table-code">{{ item.fetch?.repository }}:{{ item.fetch?.tag }}</span>
      </template>
      <template v-slot:[`item.build`]="{ item }">
        <span class="uct-table-code">{{ item.build?.repository }}:{{ item.build?.tag }}</span>
      </template>
      <template v-slot:[`item.run`]="{ item }">
        <span class="uct-table-code">{{ item.run?.repository }}:{{ item.run?.tag }}</span>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="uct-table-actions">
          <v-tooltip :text="$t('global.edit')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="$t('runpacks.actions.edit')" @click="openEditDialog(item)"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip :text="$t('global.delete')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" size="small" color="error" :aria-label="$t('runpacks.actions.delete')" @click="deleteRunpack(item)"></v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>
      <template v-slot:expanded-row="{ columns, item }">
        <tr>
          <td :colspan="columns.length" class="uct-expanded-cell">
            <table class="uct-detail-table">
              <tbody>
                <tr class="uct-detail-section">
                  <th colspan="2"><strong>{{ $t('runpacks.stages.fetch') }}</strong></th>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.repository') }}:</strong></td>
                  <td class="uct-detail-value">{{ item.fetch?.repository }}<span v-if="item.fetch?.tag">:{{ item.fetch?.tag }}</span></td>
                </tr>
                <tr v-if="item.fetch?.command">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.command') }}:</strong></td>
                  <td class="uct-detail-value uct-code">{{ item.fetch.command }}</td>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.readOnlyAppStorage') }}:</strong></td>
                  <td class="uct-detail-value"><span :class="{ 'uct-detail-status--enabled': item.fetch?.readOnlyAppStorage }">{{ item.fetch?.readOnlyAppStorage ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</span></td>
                </tr>
                <tr v-if="item.fetch?.securityContext">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.securityContext') }}:</strong></td>
                  <td class="uct-detail-value">
                    <details class="uct-security-details">
                      <summary>{{ $t('runpacks.details.showDetails') }}</summary>
                      <div class="uct-security-grid">
                        <div>{{ $t('runpacks.details.runAsUser') }}: {{ item.fetch.securityContext.runAsUser }}</div>
                        <div>{{ $t('runpacks.details.runAsGroup') }}: {{ item.fetch.securityContext.runAsGroup }}</div>
                        <div>{{ $t('runpacks.details.allowPrivilegeEscalation') }}: {{ item.fetch.securityContext.allowPrivilegeEscalation ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.readOnlyRootFilesystem') }}: {{ item.fetch.securityContext.readOnlyRootFilesystem ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.runAsNonRoot') }}: {{ item.fetch.securityContext.runAsNonRoot ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.capabilities') }}:
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.add') }}: <span v-if="item.fetch.securityContext.capabilities.add.length">{{ item.fetch.securityContext.capabilities.add.join(', ') }}</span><span v-else>-</span></div>
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.drop') }}: <span v-if="item.fetch.securityContext.capabilities.drop.length">{{ item.fetch.securityContext.capabilities.drop.join(', ') }}</span><span v-else>-</span></div>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
                <tr class="uct-detail-section">
                  <th colspan="2"><strong>{{ $t('runpacks.stages.build') }}</strong></th>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.repository') }}:</strong></td>
                  <td class="uct-detail-value">{{ item.build?.repository }}<span v-if="item.build?.tag">:{{ item.build?.tag }}</span></td>
                </tr>
                <tr v-if="item.build?.command">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.command') }}:</strong></td>
                  <td class="uct-detail-value uct-code">{{ item.build.command }}</td>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.readOnlyAppStorage') }}:</strong></td>
                  <td class="uct-detail-value"><span :class="{ 'uct-detail-status--enabled': item.build?.readOnlyAppStorage }">{{ item.build?.readOnlyAppStorage ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</span></td>
                </tr>
                <tr v-if="item.build?.securityContext">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.securityContext') }}:</strong></td>
                  <td class="uct-detail-value">
                    <details class="uct-security-details">
                      <summary>{{ $t('runpacks.details.showDetails') }}</summary>
                      <div class="uct-security-grid">
                        <div>{{ $t('runpacks.details.runAsUser') }}: {{ item.build.securityContext.runAsUser }}</div>
                        <div>{{ $t('runpacks.details.runAsGroup') }}: {{ item.build.securityContext.runAsGroup }}</div>
                        <div>{{ $t('runpacks.details.allowPrivilegeEscalation') }}: {{ item.build.securityContext.allowPrivilegeEscalation ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.readOnlyRootFilesystem') }}: {{ item.build.securityContext.readOnlyRootFilesystem ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.runAsNonRoot') }}: {{ item.build.securityContext.runAsNonRoot ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.capabilities') }}:
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.add') }}: <span v-if="item.build.securityContext.capabilities.add.length">{{ item.build.securityContext.capabilities.add.join(', ') }}</span><span v-else>-</span></div>
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.drop') }}: <span v-if="item.build.securityContext.capabilities.drop.length">{{ item.build.securityContext.capabilities.drop.join(', ') }}</span><span v-else>-</span></div>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
                <tr class="uct-detail-section">
                  <th colspan="2"><strong>{{ $t('runpacks.stages.run') }}</strong></th>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.repository') }}:</strong></td>
                  <td class="uct-detail-value">{{ item.run?.repository }}<span v-if="item.run?.tag">:{{ item.run?.tag }}</span></td>
                </tr>
                <tr v-if="item.run?.command">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.command') }}:</strong></td>
                  <td class="uct-detail-value uct-code">{{ item.run.command }}</td>
                </tr>
                <tr>
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.readOnlyAppStorage') }}:</strong></td>
                  <td class="uct-detail-value"><span :class="{ 'uct-detail-status--enabled': item.run?.readOnlyAppStorage }">{{ item.run?.readOnlyAppStorage ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</span></td>
                </tr>
                <tr v-if="item.run?.securityContext">
                  <td class="uct-detail-label"><strong>{{ $t('runpacks.details.securityContext') }}:</strong></td>
                  <td class="uct-detail-value">
                    <details class="uct-security-details">
                      <summary>{{ $t('runpacks.details.showDetails') }}</summary>
                      <div class="uct-security-grid">
                        <div>{{ $t('runpacks.details.runAsUser') }}: {{ item.run.securityContext.runAsUser }}</div>
                        <div>{{ $t('runpacks.details.runAsGroup') }}: {{ item.run.securityContext.runAsGroup }}</div>
                        <div>{{ $t('runpacks.details.allowPrivilegeEscalation') }}: {{ item.run.securityContext.allowPrivilegeEscalation ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.readOnlyRootFilesystem') }}: {{ item.run.securityContext.readOnlyRootFilesystem ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.runAsNonRoot') }}: {{ item.run.securityContext.runAsNonRoot ? $t('runpacks.details.yes') : $t('runpacks.details.no') }}</div>
                        <div>{{ $t('runpacks.details.capabilities') }}:
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.add') }}: <span v-if="item.run.securityContext.capabilities.add.length">{{ item.run.securityContext.capabilities.add.join(', ') }}</span><span v-else>-</span></div>
                          <div class="uct-security-capabilities">{{ $t('runpacks.details.drop') }}: <span v-if="item.run.securityContext.capabilities.drop.length">{{ item.run.securityContext.capabilities.drop.join(', ') }}</span><span v-else>-</span></div>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </template>
    </v-data-table>
    </section>

    <v-dialog v-model="editDialog" max-width="1000px"><v-form @submit.prevent="saveEdit">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('runpacks.actions.edit') }}</v-card-title>
        <v-card-text v-if="editedRunpack">
          <ValidationField as="v-text-field" :validation="editValidation.field('name')" v-model="editedRunpack.name" :label="$t('runpacks.form.name')"></ValidationField>
          <ValidationField as="v-text-field" :validation="editValidation.field('language')" v-model="editedRunpack.language" :label="$t('runpacks.form.language')"></ValidationField>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.fetch') }}</v-header>
          <RunpacksItem :validation="editValidation" v-model:buildpackStage="editedRunpack.fetch" title="Fetch" :advanced="true"></RunpacksItem>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.build') }}</v-header>
          <RunpacksItem :validation="editValidation" v-model:buildpackStage="editedRunpack.build" title="Build" :advanced="true"></RunpacksItem>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.run') }}</v-header>
          <RunpacksItem :validation="editValidation" v-model:buildpackStage="editedRunpack.run" title="Run" :advanced="true"></RunpacksItem>
        </v-card-text>
        <v-card-text v-else>
          <v-alert type="error" dismissible>
            {{ $t('runpacks.errors.load') }}
          </v-alert>
        </v-card-text>
        <FormValidationSummary :validation="editValidation" class="px-6" />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{ $t('runpacks.actions.abort') }}</v-btn>
          <v-btn color="primary" type="submit" :disabled="!editValidation.valid || validationSaving" :loading="validationSaving">{{ $t('runpacks.actions.save') }}</v-btn>
        </v-card-actions>
      </v-card>      
    </v-form></v-dialog>

    <v-dialog v-model="createDialog" max-width="1000px"><v-form @submit.prevent="saveCreate">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{ $t('runpacks.actions.create') }}</v-card-title>
        <v-card-text>
          <ValidationField as="v-text-field" :validation="createValidation.field('name')" v-model="newRunpack.name" :label="$t('runpacks.form.name')"></ValidationField>
          <ValidationField as="v-text-field" :validation="createValidation.field('language')" v-model="newRunpack.language" :label="$t('runpacks.form.language')"></ValidationField>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.fetch') }}</v-header>
          <RunpacksItem :validation="createValidation" v-model:buildpackStage="newRunpack.fetch" title="Fetch" :advanced="true"></RunpacksItem>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.build') }}</v-header>
          <RunpacksItem :validation="createValidation" v-model:buildpackStage="newRunpack.build" title="Build" :advanced="true"></RunpacksItem>
          <v-divider class="my-4"></v-divider>
          <v-header class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ $t('runpacks.stages.run') }}</v-header>
          <RunpacksItem :validation="createValidation" v-model:buildpackStage="newRunpack.run" title="Run" :advanced="true"></RunpacksItem>
        </v-card-text>
        <FormValidationSummary :validation="createValidation" class="px-6" />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="createDialog = false">{{ $t('runpacks.actions.abort') }}</v-btn>
          <v-btn color="primary" type="submit" :disabled="!createValidation.valid || validationSaving" :loading="validationSaving">{{ $t('runpacks.actions.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-form></v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { runpackFields } from '../../validation/resources'
import { createFormValidation } from '../../composables/useFormValidation'
import axios from 'axios'
import RunpacksItem from './runpacks-item.vue'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

export default defineComponent({
  name: 'RunpackList',
  setup() {
    const { t } = useI18n()

    // Types for Runpack
    type RunpackCapability = {
      add: string[];
      drop: string[];
    };

    type RunpackSecurityContext = {
      runAsUser: number;
      runAsGroup: number;
      allowPrivilegeEscalation: boolean;
      readOnlyRootFilesystem: boolean;
      runAsNonRoot: boolean;
      capabilities: RunpackCapability;
    };

    type RunpackStage = {
      id?: string;
      repository: string;
      tag: string;
      command: string;
      readOnlyAppStorage: boolean;
      securityContextId: string;
      createdAt: string;
      updatedAt: string;
      securityContext: RunpackSecurityContext;
    };

    type Runpack = {
      id?: string;
      name: string;
      language: string;
      fetch: RunpackStage;
      build: RunpackStage;
      run: RunpackStage;
    };

    const runpacks = ref<Runpack[]>([])
    const loading = ref(false)
    const search = ref('')
    const editDialog = ref(false)
    const createDialog = ref(false)
    const editedRunpack = ref<Runpack | null>(null)
    const newRunpack = ref<Runpack>({
      id: '',
      name: '',
      language: '',
      fetch: {
        id: '',
        repository: '',
        tag: '',
        command: '',
        readOnlyAppStorage: false,
        securityContextId: '',
        createdAt: '',
        updatedAt: '',
        securityContext: {
          runAsUser: 0,
          runAsGroup: 0,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: false,
          runAsNonRoot: false,
          capabilities: { add: [], drop: [] },
        },
      },
      build: {
        id: '',
        repository: '',
        tag: '',
        command: '',
        readOnlyAppStorage: false,
        securityContextId: '',
        createdAt: '',
        updatedAt: '',
        securityContext: {
          runAsUser: 0,
          runAsGroup: 0,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: false,
          runAsNonRoot: false,
          capabilities: { add: [], drop: [] },
        },
      },
      run: {
        id: '',
        repository: '',
        tag: '',
        command: '',
        readOnlyAppStorage: false,
        securityContextId: '',
        createdAt: '',
        updatedAt: '',
        securityContext: {
          runAsUser: 0,
          runAsGroup: 0,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: false,
          runAsNonRoot: false,
          capabilities: { add: [], drop: [] },
        },
      },
    })

    const initialRunpack = JSON.parse(JSON.stringify(newRunpack.value))
    const headers = computed(() => [
      { title: t('runpacks.table.name'), value: 'name' },
      { title: t('runpacks.table.language'), value: 'language' },
      /*
      { title: t('runpacks.table.fetch'), value: 'fetch' },
      { title: t('runpacks.table.build'), value: 'build' },
      { title: t('runpacks.table.run'), value: 'run' },
      */
      { title: t('runpacks.table.actions'), value: 'actions', sortable: false, align: 'end' as const },
    ])

    const loadRunpacks = async () => {
      loading.value = true
      try {
        const res = await axios.get('/api/config/runpacks')
        runpacks.value = res.data
      } catch (e) {
        runpacks.value = []
      }
      loading.value = false
    }

    const openEditDialog = (runpack: any) => {
      editedRunpack.value = JSON.parse(JSON.stringify(runpack))
      editDialog.value = true
    }

    const saveEdit = async () => {
      if (validationSaving.value || !editValidation.validate()) return
      validationSaving.value = true
      try {
        await axios.put(`/api/config/runpacks/${editedRunpack?.value?.id }`, editedRunpack.value)
        await loadRunpacks()
        editDialog.value = false
      } catch (e) {
        console.error('Error saving runpack:', e)
      } finally { validationSaving.value = false }
    }

    const deleteRunpack = async (runpack: any) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: runpack.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/config/runpacks/${runpack.id}`)
        await loadRunpacks()
      } catch (e) {
        console.error('Error deleting runpack:', e)
      }
    }

    const openCreateDialog = () => {
      newRunpack.value = JSON.parse(JSON.stringify(initialRunpack))
        
      createDialog.value = true
    }

    const saveCreate = async () => {
      if (validationSaving.value || !createValidation.validate()) return
      validationSaving.value = true
      try {
        // Remove empty id and timestamps before sending to backend
        const payload = JSON.parse(JSON.stringify(newRunpack.value))
        delete payload.id
        for (const stage of ['fetch', 'build', 'run']) {
          if (payload[stage]) {
            delete payload[stage].id
            delete payload[stage].createdAt
            delete payload[stage].updatedAt
            delete payload[stage].securityContextId
          }
        }
        await axios.post('/api/config/runpacks', payload)
        await loadRunpacks()
        createDialog.value = false
      } catch (e) {
        console.error('Error creating runpack:', e)
      } finally { validationSaving.value = false }
    }

    onMounted(() => {
      loadRunpacks()
    })

    const validationSaving = ref(false)
    const editValidation = createFormValidation(() => runpackFields(editedRunpack.value, t))
    const createValidation = createFormValidation(() => runpackFields(newRunpack.value, t))
    watch(editDialog, value => { if (value) editValidation.reset() })
    watch(createDialog, value => { if (value) createValidation.reset() })

    return {
      validationSaving, editValidation, createValidation,
      runpacks,
      headers,
      loading,
      search,
      openEditDialog,
      deleteRunpack,
      editDialog,
      editedRunpack,
      saveEdit,
      createDialog,
      newRunpack,
      openCreateDialog,
      saveCreate,
    }
  },
  components: {
      RunpacksItem
  },
  data() {
      return {
          show: false,
          panel: -1
      }
  },
})
</script>
