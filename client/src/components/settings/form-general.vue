
<template>
    <div style="margin-left: 10px">
        <v-row>
            <v-col cols="12" sm="12" md="12" lg="12" xl="12">
                <h2>
                    {{ $t('settings.general.title') }}
                </h2>
                <p class="text-justify">
                    {{ $t('settings.general.description') }}
                </p>
            </v-col>
        </v-row>

        <v-divider class="ma-5"></v-divider>
        <v-row>
            <v-col
            cols="12"
            md="6"
            >
            <v-text-field
                :model-value="settings.kubero.namespace" @update:model-value="update('settings', 'kubero.namespace', $event)"
                :label="$t('settings.general.namespace')"
                required
                disabled
            ></v-text-field>
            </v-col>
        </v-row>

        <v-row>
            <v-col
            cols="12"
            md="6"
            >
            <v-switch
                :model-value="settings.kubero.config.kubero.readonly" @update:model-value="update('settings', 'kubero.config.kubero.readonly', $event)"
                :label="$t('settings.general.readonlyMode')"
                required
                color="primary"
            ></v-switch>
            </v-col>
            <v-col
            cols="12"
            md="6"
            >
            <v-switch
                :model-value="settings.kubero.config.kubero.admin.disabled" @update:model-value="update('settings', 'kubero.config.kubero.admin.disabled', $event)"
                :label="$t('settings.general.adminDisabled')"
                required
                color="primary"
            ></v-switch>
            </v-col>
        </v-row>

        <v-row>
            <v-col
            cols="12"
            md="6"
            >
            <v-switch
                :model-value="settings.kubero.config.kubero.console.enabled" @update:model-value="update('settings', 'kubero.config.kubero.console.enabled', $event)"
                :label="$t('settings.general.ttyConsoleEnabled')"
                required
                color="primary"
            ></v-switch>
            </v-col>
        </v-row>

        <v-divider class="ma-5"></v-divider>
        <h4 class="text-uppercase">{{ $t('settings.general.banner.title') }}</h4>

        <v-row>
            <v-col
                cols="12"
                md="2"
            >
                <v-switch
                :model-value="settings.kubero.config.kubero.banner.show" @update:model-value="update('settings', 'kubero.config.kubero.banner.show', $event)"
                :label="$t('settings.general.banner.enabled')"
                color="primary"
                required
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.config.kubero.banner.show"
            >
                <ValidationField as="v-text-field" :validation="validation.field('banner-bgcolor')"
                :model-value="settings.kubero.config.kubero.banner.bgcolor" @update:model-value="update('settings', 'kubero.config.kubero.banner.bgcolor', $event)"
                :label="$t('settings.general.banner.backgroundColor')"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.config.kubero.banner.show"
            >
                <ValidationField as="v-text-field" :validation="validation.field('banner-fontcolor')"
                :model-value="settings.kubero.config.kubero.banner.fontcolor" @update:model-value="update('settings', 'kubero.config.kubero.banner.fontcolor', $event)"
                :label="$t('settings.general.banner.fontColor')"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.config.kubero.banner.show">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('banner-message')"
                :model-value="settings.kubero.config.kubero.banner.message" @update:model-value="update('settings', 'kubero.config.kubero.banner.message', $event)"
                :label="$t('settings.general.banner.message')"
                required
                ></ValidationField>
            </v-col>
        </v-row>

        <v-divider class="ma-5"></v-divider>
        <h4 class="text-uppercase">{{ $t('settings.general.authentication.title') }}</h4>

        <v-row>
            <v-col
                cols="12"
                md="2"
            >
                <v-switch
                :model-value="settings.kubero.auth.github.enabled" @update:model-value="update('settings', 'kubero.auth.github.enabled', $event)"
                :label="$t('settings.general.authentication.github.enabled')"
                color="primary"
                density="compact"
                required
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.auth.github.enabled"
            >
                <ValidationField as="v-text-field" :validation="validation.field('github-id')"
                :model-value="settings.kubero.auth.github.id" @update:model-value="update('settings', 'kubero.auth.github.id', $event)"
                :label="$t('settings.general.authentication.github.id')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.auth.github.enabled"
            >
                <v-text-field
                :model-value="settings.kubero.auth.github.org" @update:model-value="update('settings', 'kubero.auth.github.org', $event)"
                :label="$t('settings.general.authentication.github.organization')"
                density="compact"
                required
                ></v-text-field>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.github.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('github-callbackUrl')"
                :model-value="settings.kubero.auth.github.callbackUrl" @update:model-value="update('settings', 'kubero.auth.github.callbackUrl', $event)"
                :label="$t('settings.general.authentication.github.callbackUrl')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.github.enabled">
            <v-col
                cols="12"
                md="8"
                v-if="settings.kubero.auth.github.enabled"
            >
                <ValidationField as="v-text-field" :validation="validation.field('GITHUB_CLIENT_SECRET')"
                :model-value="secrets.GITHUB_CLIENT_SECRET" @update:model-value="update('secrets', 'GITHUB_CLIENT_SECRET', $event)"
                :label="$t('settings.general.authentication.github.secret')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>

        <v-row>
            <v-col
                cols="12"
                md="2"
            >
                <v-switch
                :model-value="settings.kubero.auth.oauth2.enabled" @update:model-value="update('settings', 'kubero.auth.oauth2.enabled', $event)"
                :label="$t('settings.general.authentication.oauth2.enabled')"
                color="primary"
                density="compact"
                required
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.auth.oauth2.enabled"
            >
                <ValidationField as="v-text-field" :validation="validation.field('oauth2-name')"
                :model-value="settings.kubero.auth.oauth2.name" @update:model-value="update('settings', 'kubero.auth.oauth2.name', $event)"
                :label="$t('settings.general.authentication.oauth2.name')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="settings.kubero.auth.oauth2.enabled"
            >
                <ValidationField as="v-text-field" :validation="validation.field('oauth2-id')"
                :model-value="settings.kubero.auth.oauth2.id" @update:model-value="update('settings', 'kubero.auth.oauth2.id', $event)"
                :label="$t('settings.general.authentication.oauth2.id')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.oauth2.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('oauth2-authUrl')"
                :model-value="settings.kubero.auth.oauth2.authUrl" @update:model-value="update('settings', 'kubero.auth.oauth2.authUrl', $event)"
                :label="$t('settings.general.authentication.oauth2.authUrl')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.oauth2.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('oauth2-tokenUrl')"
                :model-value="settings.kubero.auth.oauth2.tokenUrl" @update:model-value="update('settings', 'kubero.auth.oauth2.tokenUrl', $event)"
                :label="$t('settings.general.authentication.oauth2.tokenUrl')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.oauth2.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('oauth2-callbackUrl')"
                :model-value="settings.kubero.auth.oauth2.callbackUrl" @update:model-value="update('settings', 'kubero.auth.oauth2.callbackUrl', $event)"
                :label="$t('settings.general.authentication.oauth2.callbackUrl')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.oauth2.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <v-text-field
                :model-value="settings.kubero.auth.oauth2.scopes" @update:model-value="update('settings', 'kubero.auth.oauth2.scopes', $event)"
                :label="$t('settings.general.authentication.oauth2.scopes')"
                density="compact"
                required
                ></v-text-field>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auth.oauth2.enabled">
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('OAUTH2_CLIENT_SECRET')"
                :model-value="secrets.OAUTH2_CLIENT_SECRET" @update:model-value="update('secrets', 'OAUTH2_CLIENT_SECRET', $event)"
                :label="$t('settings.general.authentication.oauth2.secret')"
                density="compact"
                required
                ></ValidationField>
            </v-col>
        </v-row>


        <v-divider class="ma-5"></v-divider>
        <h4 class="text-uppercase">{{ $t('settings.general.auditLogs.title') }}</h4>

        <v-row>
            <v-col
                cols="12"
                md="2"
            >
                <v-switch
                :model-value="settings.kubero.auditLogs.enabled" @update:model-value="update('settings', 'kubero.auditLogs.enabled', $event)"
                :label="$t('settings.general.auditLogs.enabled')"
                color="primary"
                required
                ></v-switch>
            </v-col>
        </v-row>
        <v-row v-if="settings.kubero.auditLogs.enabled">
            <v-col
                cols="12"
                md="4"
                v-if="settings.kubero.auditLogs.enabled"
            >
                <v-select
                  :model-value="settings.kubero.auditLogs.storageClassName" @update:model-value="update('settings', 'kubero.auditLogs.storageClassName', $event)"
                  :items="storageclasses"
                  :label="$t('settings.general.auditLogs.storageClass')"
                ></v-select>
            </v-col>
            <v-col
                cols="12"
                md="4"
            >
                <ValidationField as="v-text-field" :validation="validation.field('audit-limit')"
                :model-value="settings.kubero.auditLogs.limit" @update:model-value="update('settings', 'kubero.auditLogs.limit', $event)"
                :label="$t('settings.general.auditLogs.limit')"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="4"
            >
                <ValidationField as="v-text-field" :validation="validation.field('audit-size')"
                :model-value="settings.kubero.auditLogs.size" @update:model-value="update('settings', 'kubero.auditLogs.size', $event)"
                :label="$t('settings.general.auditLogs.size')"
                required
                ></ValidationField>
            </v-col>
        </v-row>

    </div>
</template>


<script lang="ts">
import axios from 'axios'
import { updateModelPath } from '../../composables/useFormValidation'
import type { FormValidation } from '../../composables/useFormValidation'
import { defineComponent, PropType } from 'vue'
import { Secrets } from './form.vue'

export default defineComponent({
    name: 'FormGeneral',
    emits: ['update:settings', 'update:secrets'],
    props: {
        validation: { type: Object as PropType<FormValidation>, required: true },
        settings: {
            type: Object as () => any,
            required: true
        },
        secrets: {
            type: Object as () => Secrets,
            required: true
        }
    },
    mounted() {
        this.loadStorageClasses();
    },
    components: {
    },
    data() {
        return {
            show: false,
            storageclasses : [
                /*
                'standard',
                'standard-fast',
                */
            ] as string[],
        }
    },
    methods: {
        update(source: 'settings' | 'secrets', path: string, value: unknown) {
            const model = source === 'settings' ? this.settings : ('secrets' in this ? this.secrets : {})
            this.$emit(source === 'settings' ? 'update:settings' : 'update:secrets', updateModelPath(model, path, value))
        },

      loadStorageClasses() {
        axios.get('/api/kubernetes/storageclasses').then(response => {
          for (let i = 0; i < response.data.length; i++) {
            this.storageclasses.push(response.data[i].name);
          }
        });
      },
    }
})

</script>