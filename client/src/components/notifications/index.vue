<template>
  <v-container class="uct-management-page">
    <header class="uct-page-header">
      <div class="uct-page-header__identity">
        <div class="uct-page-header__icon" aria-hidden="true">
          <v-icon size="28" color="primary">mdi-bell-outline</v-icon>
        </div>
        <h1 class="uct-h1">{{ $t('notifications.name') }}</h1>
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="openCreateDialog"
      >
        {{ $t('notifications.actions.create') }}
      </v-btn>
    </header>
    <v-row>
      <v-col cols="12">
        <v-expansion-panels multiple elevation="0" class="uct-help-panels">
          <v-expansion-panel>
          <v-expansion-panel-title class="text-h6 font-weight-bold">
            {{ $t('notifications.helpTitle') }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div v-html="$t('notifications.helpText')"></div>
          </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
    <section class="uct-table-panel">
    <v-data-table
      :headers="headers"
      :items="notifications"
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
            :label="$t('notifications.form.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
          ></v-text-field>
        </div>
        <div class="uct-table-summary" aria-live="polite">
          <span>{{ notifications.length }} · {{ $t('notifications.name') }}</span>
        </div>
      </template>
      <template v-slot:[`item.name`]="{ item }">
        <div class="uct-table-identity">
          <v-icon :icon="getTypeIcon(item.type)" color="primary" size="21" aria-hidden="true"></v-icon>
          <strong>{{ item.name }}</strong>
        </div>
      </template>
      <template v-slot:[`item.type`]="{ item }">
        <v-chip :color="getTypeColor(item.type)" size="small" variant="tonal">
          <v-icon start :icon="getTypeIcon(item.type)"></v-icon>
          {{ item.type }}
        </v-chip>
      </template>
      <template v-slot:[`item.enabled`]="{ item }">
        <v-switch
          v-model="item.enabled"
          @change="toggleEnabled(item)"
          color="primary"
          hide-details
        ></v-switch>
      </template>
      <template v-slot:[`item.pipelines`]="{ item }">
        <v-chip-group>
          <v-chip
            v-for="pipeline in item.pipelines"
            :key="pipeline"
            size="x-small"
          >
            {{ pipeline }}
          </v-chip>
        </v-chip-group>
      </template>
      <template v-slot:[`item.events`]="{ item }">
        <v-chip-group>
          <v-chip
            v-for="event in item.events"
            :key="event"
            size="x-small"
          >
            {{ event }}
          </v-chip>
        </v-chip-group>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="uct-table-actions">
          <v-tooltip :text="$t('global.edit')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="$t('notifications.actions.edit')" @click="openEditDialog(item)"></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip :text="$t('global.delete')" location="top">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" size="small" color="error" :aria-label="$t('notifications.actions.delete')" @click="deleteNotification(item)"></v-btn>
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
                      <v-list-item-title class="font-weight-bold">{{$t('notifications.form.config')}}</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="item.config.url">
                      <v-list-item-subtitle>{{$t('notifications.form.url')}}</v-list-item-subtitle>
                      <v-list-item-title class="text-truncate uct-detail-url">{{ item.config.url }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="item.config.channel">
                      <v-list-item-subtitle>{{$t('notifications.form.channel')}}</v-list-item-subtitle>
                      <v-list-item-title>{{ item.config.channel }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="item.config.secret">
                      <v-list-item-subtitle>{{$t('notifications.form.secret')}}</v-list-item-subtitle>
                      <v-list-item-title>***hidden***</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-col>
                <v-col cols="12" md="6">
                  <v-list density="compact" class="uct-detail-list">
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold">{{$t('notifications.form.pipelines')}}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-chip-group>
                        <v-chip
                          v-for="pipeline in item.pipelines"
                          :key="pipeline"
                          size="small"
                        >
                          {{ pipeline }}
                        </v-chip>
                      </v-chip-group>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold">{{$t('notifications.form.events')}}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                      <v-chip-group>
                        <v-chip
                          v-for="event in item.events"
                          :key="event"
                          size="small"
                        >
                          {{ event }}
                        </v-chip>
                      </v-chip-group>
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
    <!-- Edit Dialog -->
    <v-dialog v-model="editDialog" max-width="800px"><v-form @submit.prevent="saveEdit">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{$t('notifications.actions.edit')}}</v-card-title>
        <v-card-text v-if="editedNotification">

            <v-row>
              <v-col cols="12" md="6">
                <ValidationField as="v-text-field" :validation="editValidation.field('name')"
                  v-model="editedNotification.name"
                  :label="$t('notifications.form.name')"
                  required
                ></ValidationField>
              </v-col>
              <v-col cols="12" md="6">
                <ValidationField as="v-select" :validation="editValidation.field('type')"
                  v-model="editedNotification.type"
                  :items="notificationTypes"
                  :label="$t('notifications.form.type')"
                  required
                ></ValidationField>
              </v-col>
              <v-col cols="12">
                <v-switch
                  v-model="editedNotification.enabled"
                  :label="$t('notifications.form.enabled')"
                  color="primary"
                ></v-switch>
              </v-col>

              <!-- Type-specific configuration -->
              <v-col cols="12" v-if="editedNotification.type === 'slack'">
                <ValidationField as="v-text-field" :validation="editValidation.field('url')"
                  v-model="editedNotification.config.url"
                  :label="$t('notifications.form.slackWebhookUrl')"
                  required
                ></ValidationField>
                <v-text-field
                  v-model="editedNotification.config.channel"
                  :label="$t('notifications.form.channel')"
                ></v-text-field>
              </v-col>

              <v-col cols="12" v-if="editedNotification.type === 'discord'">
                <ValidationField as="v-text-field" :validation="editValidation.field('url')"
                  v-model="editedNotification.config.url"
                  :label="$t('notifications.form.discordWebhookUrl')"
                  required
                ></ValidationField>
              </v-col>

              <v-col cols="12" v-if="editedNotification.type === 'webhook'">
                <ValidationField as="v-text-field" :validation="editValidation.field('url')"
                  v-model="editedNotification.config.url"
                  :label="$t('notifications.form.webhookUrl')"
                  required
                ></ValidationField>
                <v-text-field
                  v-model="editedNotification.config.secret"
                  :label="$t('notifications.form.secret')"
                  type="password"
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-combobox
                  v-model="editedNotification.pipelines"
                  :label="$t('notifications.form.pipelines')"
                  multiple
                  chips
                  clearable
                  :hint="$t('notifications.form.pipelinesHint')"
                ></v-combobox>
              </v-col>

              <v-col cols="12" md="6">
                <v-combobox
                  v-model="editedNotification.events"
                  :label="$t('notifications.form.events')"
                  multiple
                  chips
                  clearable
                  :hint="$t('notifications.form.eventsHint')"
                ></v-combobox>
              </v-col>
            </v-row>

        </v-card-text>
        <v-card-text v-else>
          <v-alert type="error" dismissible>
            {{$t('notifications.errors.edit')}}
          </v-alert>
        </v-card-text>
        <FormValidationSummary :validation="editValidation" class="px-6" />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="editDialog = false">{{$t('global.cancel')}}</v-btn>
          <v-btn color="primary" type="submit" :disabled="!editValidation.valid || validationSaving" :loading="validationSaving">{{$t('global.save')}}</v-btn>
        </v-card-actions>
      </v-card>
    </v-form></v-dialog>

    <!-- Create Dialog -->
    <v-dialog v-model="createDialog" max-width="800px"><v-form @submit.prevent="saveCreate">
      <v-card color="cardBackground" class="uct-card uct-dialog-card">
        <v-card-title class="text-h6 font-weight-bold">{{$t('notifications.actions.create')}}</v-card-title>
        <v-card-text>

            <v-row>
              <v-col cols="12" md="6">
                <ValidationField as="v-text-field" :validation="createValidation.field('name')"
                  v-model="newNotification.name"
                  :label="$t('notifications.form.name')"
                  required
                ></ValidationField>
              </v-col>
              <v-col cols="12" md="6">
                <ValidationField as="v-select" :validation="createValidation.field('type')"
                  v-model="newNotification.type"
                  :items="notificationTypes"
                  :label="$t('notifications.form.type')"
                  required
                ></ValidationField>
              </v-col>
              <v-col cols="12">
                <v-switch
                  v-model="newNotification.enabled"
                  :label="$t('notifications.form.enabled')"
                  color="primary"
                ></v-switch>
              </v-col>

              <!-- Type-specific configuration -->
              <v-col cols="12" v-if="newNotification.type === 'slack'">
                <ValidationField as="v-text-field" :validation="createValidation.field('url')"
                  v-model="newNotification.config.url"
                  :label="$t('notifications.form.slackWebhookUrl')"
                  required
                ></ValidationField>
                <v-text-field
                  v-model="newNotification.config.channel"
                  :label="$t('notifications.form.channel')"
                ></v-text-field>
              </v-col>

              <v-col cols="12" v-if="newNotification.type === 'discord'">
                <ValidationField as="v-text-field" :validation="createValidation.field('url')"
                  v-model="newNotification.config.url"
                  :label="$t('notifications.form.discordWebhookUrl')"
                  required
                ></ValidationField>
              </v-col>

              <v-col cols="12" v-if="newNotification.type === 'webhook'">
                <ValidationField as="v-text-field" :validation="createValidation.field('url')"
                  v-model="newNotification.config.url"
                  :label="$t('notifications.form.webhookUrl')"
                  required
                ></ValidationField>
                <v-text-field
                  v-model="newNotification.config.secret"
                  :label="$t('notifications.form.secret')"
                  type="password"
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-combobox
                  v-model="newNotification.pipelines"
                  :items="availablePipelines"
                  :label="$t('notifications.form.pipelines')"
                  multiple
                  chips
                  clearable
                  :hint="$t('notifications.form.pipelinesHint')"
                ></v-combobox>
              </v-col>

              <v-col cols="12" md="6">
                <v-combobox
                  v-model="newNotification.events"
                  :items="availableEvents"
                  :label="$t('notifications.form.events')"
                  multiple
                  chips
                  clearable
                  :hint="$t('notifications.form.eventsHint')"
                ></v-combobox>
              </v-col>
            </v-row>

        </v-card-text>
        <FormValidationSummary :validation="createValidation" class="px-6" />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="createDialog = false">{{$t('global.cancel')}}</v-btn>
          <v-btn color="primary" type="submit" :disabled="!createValidation.valid || validationSaving" :loading="validationSaving">{{$t('global.create')}}</v-btn>
        </v-card-actions>
      </v-card>
    </v-form></v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch } from 'vue'
import { notificationFields } from '../../validation/settings'
import { createFormValidation } from '../../composables/useFormValidation'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

export default defineComponent({
  name: 'NotificationsList',
  setup() {
    const { t } = useI18n() 
    type NotificationConfig = {
      url?: string
      secret?: string
      channel?: string
    }

    type Notification = {
      id?: string
      name: string
      enabled: boolean
      type: 'slack' | 'webhook' | 'discord'
      pipelines: string[]
      events: string[]
      config: NotificationConfig
    }

    const notifications = ref<Notification[]>([])
    const loading = ref(false)
    const search = ref('')
    const editDialog = ref(false)
    const createDialog = ref(false)
    const editedNotification = ref<Notification | null>(null)
    const newNotification = ref<Notification>({
      name: '',
      enabled: true,
      type: 'slack',
      pipelines: [],
      events: [],
      config: {},
    })

    const availablePipelines = ['all'] as string[]
    const availableEvents = [
                'updatePipeline',
                'deletePipeline',
                'newPipeline',
                'newApp',
                'updateApp',
                'deleteApp',
                'restartApp',
                'rebuildApp',
                'deployApp',
                'updateSettings',
                'handleWebhookPush',
            ]

    const notificationTypes = [
      { title: 'Slack', value: 'slack' },
      { title: 'Discord', value: 'discord' },
      { title: 'Webhook', value: 'webhook' },
    ]

    const headers = [
      { title: t('notifications.form.name'), value: 'name' },
      { title: t('notifications.form.type'), value: 'type' },
      { title: t('notifications.form.enabled'), value: 'enabled' },
      { title: t('notifications.form.pipelines'), value: 'pipelines' },
      { title: t('notifications.form.events'), value: 'events' },
      { title: '', value: 'actions', sortable: false, align: 'end' as const },
    ]

    const getTypeColor = (type: string) => {
      switch (type) {
        case 'slack': return 'primary'
        case 'discord': return 'info'
        case 'webhook': return 'secondary'
        default: return 'grey'
      }
    }

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'slack': return 'mdi-slack'
        case 'discord': return 'mdi-discord'
        case 'webhook': return 'mdi-webhook'
        default: return 'mdi-bell'
      }
    }

    const loadNotifications = async () => {
      loading.value = true
      try {
        const res = await axios.get('/api/notifications')
        notifications.value = res.data.data || res.data || []
      } catch (e) {
        notifyApiError(e, 'loadNotifications')
        notifications.value = []
      }
      loading.value = false
    }

    const toggleEnabled = async (notification: Notification) => {
      try {
        await axios.put(`/api/notifications/${notification.id}`, {
          enabled: notification.enabled,
        }, handledApiErrorConfig)
        await loadNotifications()
      } catch (e) {
        notifyApiError(e, 'toggleNotification')
        // Revert the change on error
        notification.enabled = !notification.enabled
      }
    }

    const openEditDialog = (notification: Notification) => {
      editedNotification.value = JSON.parse(JSON.stringify(notification))
      editDialog.value = true
    }

    const saveEdit = async () => {
      if (validationSaving.value || !editValidation.validate()) return
      validationSaving.value = true
      try {
        await axios.put(`/api/notifications/${editedNotification.value?.id}`, editedNotification.value, handledApiErrorConfig)
        await loadNotifications()
        editDialog.value = false
      } catch (e) {
        notifyApiError(e, 'saveNotification')
      } finally { validationSaving.value = false }
    }

    const deleteNotification = async (notification: Notification) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: notification.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/notifications/${notification.id}`, handledApiErrorConfig)
        await loadNotifications()
      } catch (e) {
        notifyApiError(e, 'deleteNotification')
      }
    }

    const openCreateDialog = () => {
      newNotification.value = {
        name: '',
        enabled: true,
        type: 'slack',
        pipelines: [],
        events: [],
        config: {},
      }
      createDialog.value = true
    }

    const saveCreate = async () => {
      if (validationSaving.value || !createValidation.validate()) return
      validationSaving.value = true
      try {
        const payload = JSON.parse(JSON.stringify(newNotification.value))
        delete payload.id
        await axios.post('/api/notifications', payload, handledApiErrorConfig)
        await loadNotifications()
        createDialog.value = false
      } catch (e) {
        notifyApiError(e, 'createNotification')
      } finally { validationSaving.value = false }
    }

    const loadPipelinesList = async () => {
        const response = await axios.get(`/api/pipelines`)
        .catch(error => {
            notifyApiError(error, 'loadNotificationPipelines');
        });
        if (!response) return;
        response.data.items.forEach((item: any) => {
            availablePipelines.push(item.name);
        });
    }

    onMounted(() => {
      loadNotifications()
      loadPipelinesList()
    })

    const validationSaving = ref(false)
    const editValidation = createFormValidation(() => notificationFields(editedNotification.value, t))
    const createValidation = createFormValidation(() => notificationFields(newNotification.value, t))
    watch(editDialog, value => { if (value) editValidation.reset() })
    watch(createDialog, value => { if (value) createValidation.reset() })

    return {
      validationSaving, editValidation, createValidation,
      notifications,
      headers,
      loading,
      search,
      notificationTypes,
      getTypeColor,
      getTypeIcon,
      toggleEnabled,
      openEditDialog,
      deleteNotification,
      editDialog,
      editedNotification,
      saveEdit,
      createDialog,
      newNotification,
      openCreateDialog,
      saveCreate,
      availablePipelines,
      availableEvents,
    }
  },
})
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
