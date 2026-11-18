
<template>
    <div>
        <v-row>
            <v-col cols="12" sm="12" md="12" lg="12" xl="12">
                <h2>
                    {{ $t('settings.deployment.title') }}
                </h2>
                <!--
                <p class="text-justify">
                    Define the available pod sizes for the applications.
                </p>
                -->

                <v-alert 
                    type="info"
                    variant="tonal"
                    style="margin-bottom: 20px; margin-top: 20px;"
                    :text="$t('settings.deployment.configAlert')">
                </v-alert>
            </v-col>
        </v-row>

        <v-divider class="ma-5"></v-divider>
        <h4 class="text-uppercase">{{ $t('settings.deployment.webhookEndpoint') }}</h4>
        <v-row>
            <v-col
                cols="12"
                md="8"
            >
                <ValidationField as="v-text-field" :validation="validation.field('webhook-url')"
                :model-value="settings.settings.kubero.webhook_url" @update:model-value="update('settings', 'settings.kubero.webhook_url', $event)"
                :label="$t('settings.deployment.url')"
                required
                ></ValidationField>
            </v-col>
        </v-row>
        <v-row>
            <v-col
                cols="12"
                md="8"
            >
                <v-text-field
                :model-value="settings.secrets.KUBERO_WEBHOOK_SECRET" @update:model-value="update('settings', 'secrets.KUBERO_WEBHOOK_SECRET', $event)"
                :label="$t('settings.deployment.secret')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
        </v-row>
        <v-divider class="ma-5"></v-divider>

        <h4 class="text-uppercase">{{ $t('settings.deployment.github.title') }}</h4>
        <v-row>
            <v-col 
                cols="12"
                md="3"
            >
                <ValidationField as="v-text-field" :validation="validation.field('GITHUB_BASEURL')"
                :model-value="settings.secrets.GITHUB_BASEURL" @update:model-value="update('settings', 'secrets.GITHUB_BASEURL', $event)"
                :label="$t('settings.deployment.github.baseUrl')" 
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.GITHUB_PERSONAL_ACCESS_TOKEN" @update:model-value="update('settings', 'secrets.GITHUB_PERSONAL_ACCESS_TOKEN', $event)"
                :label="$t('settings.deployment.github.personalAccessToken')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
            <v-col
                cols="12"
                md="6"
            >{{ $t('settings.deployment.github.instructions') }} <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token" target="_blank">Github</a>
            </v-col>
        </v-row>

        <h4 class="text-uppercase">{{ $t('settings.deployment.gitea.title') }}</h4>
        <v-row>
            <v-col
                cols="12"
                md="3"
            >
                <ValidationField as="v-text-field" :validation="validation.field('GITEA_BASEURL')"
                :model-value="settings.secrets.GITEA_BASEURL" @update:model-value="update('settings', 'secrets.GITEA_BASEURL', $event)"
                :label="$t('settings.deployment.gitea.baseUrl')"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.GITEA_PERSONAL_ACCESS_TOKEN" @update:model-value="update('settings', 'secrets.GITEA_PERSONAL_ACCESS_TOKEN', $event)"
                :label="$t('settings.deployment.gitea.personalAccessToken')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
            <v-col
                cols="12"
                md="6"
            >{{ $t('settings.deployment.gitea.instructions') }} <a href="https://www.jetbrains.com/help/youtrack/cloud/integration-with-gitea.html#enable-youtrack-integration-gitea" target="_blank">Gitea</a>
            </v-col>
        </v-row>

        <h4 class="text-uppercase">{{ $t('settings.deployment.gogs.title') }}</h4>
        <v-row>
            <v-col
                cols="12"
                md="3"
            >
                <ValidationField as="v-text-field" :validation="validation.field('GOGS_BASEURL')"
                :model-value="settings.secrets.GOGS_BASEURL" @update:model-value="update('settings', 'secrets.GOGS_BASEURL', $event)"
                :label="$t('settings.deployment.gogs.baseUrl')"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.GOGS_PERSONAL_ACCESS_TOKEN" @update:model-value="update('settings', 'secrets.GOGS_PERSONAL_ACCESS_TOKEN', $event)"
                :label="$t('settings.deployment.gogs.personalAccessToken')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
        </v-row>

        <h4 class="text-uppercase">{{ $t('settings.deployment.gitlab.title') }}</h4>
        <v-row>
            <v-col
                cols="12"
                md="3"
            >
                <ValidationField as="v-text-field" :validation="validation.field('GITLAB_BASEURL')"
                :model-value="settings.secrets.GITLAB_BASEURL" @update:model-value="update('settings', 'secrets.GITLAB_BASEURL', $event)"
                :label="$t('settings.deployment.gitlab.baseUrl')"
                required
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.GITLAB_PERSONAL_ACCESS_TOKEN" @update:model-value="update('settings', 'secrets.GITLAB_PERSONAL_ACCESS_TOKEN', $event)"
                :label="$t('settings.deployment.gitlab.personalAccessToken')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
        </v-row>

        <h4 class="text-uppercase">{{ $t('settings.deployment.bitbucket.title') }}</h4>
        <v-row>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.BITBUCKET_USERNAME" @update:model-value="update('settings', 'secrets.BITBUCKET_USERNAME', $event)"
                :label="$t('settings.deployment.bitbucket.username')"
                required
                ></v-text-field>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-text-field
                :model-value="settings.secrets.BITBUCKET_APP_PASSWORD" @update:model-value="update('settings', 'secrets.BITBUCKET_APP_PASSWORD', $event)"
                :label="$t('settings.deployment.bitbucket.appPassword')"
                required
                :append-icon="show ? 'mdi-eye' : 'mdi-eye-off'"
                :type="show ? 'text' : 'password'"
                @click:append="show = !show"
                ></v-text-field>
            </v-col>
        </v-row>
    </div>
</template>


<script lang="ts">
import { updateModelPath } from '../../composables/useFormValidation'
import type { FormValidation } from '../../composables/useFormValidation'
import { defineComponent, PropType } from 'vue'
import { Secrets } from './form.vue'

interface Settings {
    settings: any,
    secrets: Secrets
}

export default defineComponent({
    name: 'FormDeployment',
    emits: ['update:settings', 'update:secrets'],
    props: {
        validation: { type: Object as PropType<FormValidation>, required: true },
        settings: {
            type: Object as () => Settings,
            required: true
        },
    },
    components: {
    },
    data() {
        return {
            show: false,
        }
    },
    methods: {
        update(source: 'settings' | 'secrets', path: string, value: unknown) {
            const model = source === 'settings' ? this.settings : ('secrets' in this ? this.secrets : {})
            this.$emit(source === 'settings' ? 'update:settings' : 'update:secrets', updateModelPath(model, path, value))
        },

    }
})

</script>
