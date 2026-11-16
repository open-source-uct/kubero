<template>
    <div>
        <v-row>
            <v-col
                cols="12"
                md="4"
            >
                <ValidationField as="v-text-field" :validation="validation.field(title.toLowerCase() + '-repository')"
                :model-value="buildpackStage.repository" @update:model-value="update('repository', $event)"
                :label="$t('runpacks.details.repository')"
                required
                density="compact"
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="2"
            >
                <ValidationField as="v-text-field" :validation="validation.field(title.toLowerCase() + '-tag')"
                :model-value="buildpackStage.tag" @update:model-value="update('tag', $event)"
                :label="$t('runpacks.form.tag')"
                required
                density="compact"
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="advanced"
            >
                <ValidationField as="v-text-field" :validation="validation.field(title.toLowerCase() + '-uid')"
                    :model-value="buildpackStage.securityContext.runAsUser" @update:model-value="update('securityContext.runAsUser', $event)"
                    density="compact"
                    :label="$t('runpacks.form.runAsUser')"
                ></ValidationField>
            </v-col>
            <v-col
                cols="12"
                md="3"
                v-if="advanced"
            >
                <ValidationField as="v-text-field" :validation="validation.field(title.toLowerCase() + '-gid')"
                    :model-value="buildpackStage.securityContext.runAsGroup" @update:model-value="update('securityContext.runAsGroup', $event)"
                    density="compact"
                    :label="$t('runpacks.form.runAsGroup')"
                ></ValidationField>
            </v-col>
        </v-row>

        <v-row v-if="advanced">
            <v-col
                cols="12"
                md="3"
            >
                <v-switch
                    :model-value="buildpackStage.readOnlyAppStorage" @update:model-value="update('readOnlyAppStorage', $event)"
                    :label="$t('runpacks.form.readOnlyAppVolume')"
                    density="compact"
                    color="primary"
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-switch
                    :model-value="buildpackStage.securityContext.readOnlyRootFilesystem" @update:model-value="update('securityContext.readOnlyRootFilesystem', $event)"
                    :label="$t('runpacks.form.readOnlyRootFilesystem')"
                    density="compact"
                    color="primary"
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-switch
                    :model-value="buildpackStage.securityContext.allowPrivilegeEscalation" @update:model-value="update('securityContext.allowPrivilegeEscalation', $event)"
                    :label="$t('runpacks.form.allowPrivilegeEscalation')"
                    density="compact"
                    color="primary"
                ></v-switch>
            </v-col>
            <v-col
                cols="12"
                md="3"
            >
                <v-switch
                    :model-value="buildpackStage.securityContext.runAsNonRoot" @update:model-value="update('securityContext.runAsNonRoot', $event)"
                    :label="$t('runpacks.form.runAsNonRoot')"
                    density="compact"
                    color="primary"
                ></v-switch>
            </v-col>
        </v-row>

        <v-row v-if="advanced">
            <v-col
                cols="12"
                md="6"
            >
                <v-select
                    :model-value="buildpackStage.securityContext.capabilities.add" @update:model-value="update('securityContext.capabilities.add', $event)"
                    :items="capabilities"
                    :menu-props="{ maxHeight: '400' }"
                    :label="$t('runpacks.form.capabilitiesAdd')"
                    multiple
                    :hint="$t('runpacks.form.selectOneOrMore')"
                    persistent-hint
                    chips
                    class="capability"
                ></v-select>
            </v-col>
            <v-col
                cols="12"
                md="6"
            >
                <v-select
                    :model-value="buildpackStage.securityContext.capabilities.drop" @update:model-value="update('securityContext.capabilities.drop', $event)"
                    :items="capabilities"
                    :menu-props="{ maxHeight: '400' }"
                    :label="$t('runpacks.form.capabilitiesDrop')"
                    multiple
                    :hint="$t('runpacks.form.selectOneOrMore')"
                    persistent-hint
                    chips
                    class="capability"
                ></v-select>
            </v-col>
        </v-row>
    </div>
</template>


<script lang="ts">
import type { FormValidation } from '../../composables/useFormValidation'
import set from 'lodash/set'
import { defineComponent, PropType } from 'vue'

export default defineComponent({
    name: 'RunpacksItem',
    emits: ['update:buildpackStage'],
    props: {
        validation: { type: Object as PropType<FormValidation>, required: true },
        title: {
            type: String,
            required: true
        },
        buildpackStage: {
            type: Object as () => any,
            required: true
        },
        advanced: {
            type: Boolean,
            default: false
        }
    },
    setup(props, { emit }) {
        const update = (path: string, value: unknown) => {
            const next = { ...props.buildpackStage, securityContext: { ...props.buildpackStage.securityContext, capabilities: { ...props.buildpackStage.securityContext?.capabilities } } }
            set(next, path, value)
            emit('update:buildpackStage', next)
        }
        return { update }
    },
    data () {
        return {
            capabilities: [
                'AUDIT_CONTROL',
                'AUDIT_READ',
                'AUDIT_WRITE',
                'BLOCK_SUSPEND',
                'CHOWN',
                'DAC_OVERRIDE',
                'DAC_READ_SEARCH',
                'FOWNER',
                'FSETID',
                'IPC_LOCK',
                'IPC_OWNER',
                'KILL',
                'LEASE',
                'LINUX_IMMUTABLE',
                'MAC_ADMIN',
                'MAC_OVERRIDE',
                'MKNOD',
                'NET_ADMIN',
                'NET_BIND_SERVICE',
                'NET_BROADCAST',
                'NET_RAW',
                'SETFCAP',
                'SETGID',
                'SETPCAP',
                'SETUID',
                'SYS_ADMIN',
                'SYS_BOOT',
                'SYS_CHROOT',
                'SYS_MODULE',
                'SYS_NICE',
                'SYS_PACCT',
                'SYS_PTRACE',
                'SYS_RAWIO',
                'SYS_RESOURCE',
                'SYS_TIME',
                'SYS_TTY_CONFIG',
                'SYSLOG',
                'WAKE_ALARM',
            ]
        }
    }
})
</script>