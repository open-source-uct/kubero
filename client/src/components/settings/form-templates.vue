
<template>
    <div>

        <v-switch
            :model-value="settings.kubero.config.templates.enabled" @update:model-value="update('settings', 'kubero.config.templates.enabled', $event)"
            :label="$t('settings.templates.allowTemplates')"
            color="primary"
            required
        ></v-switch>
        <v-expansion-panels
            v-model="panel"
            multiple
        >

            <v-expansion-panel bg-color="rgb(var(--v-theme-cardBackground))" v-for="(catalog, index) in settings.kubero.config.templates.catalogs" :key="index">
            <v-expansion-panel-title class="text-uppercase text-caption-2 font-weight-medium" color="cardBackground">{{ catalog.name }}</v-expansion-panel-title>
            <v-expansion-panel-text>
            <v-row>
                <v-col
                    cols="12"
                    md="3"
                >
                    <ValidationField as="v-text-field" :validation="validation.field('catalog-' + validationRowId(catalog) + '-name')"
                    :model-value="catalog.name" @update:model-value="update('settings', `kubero.config.templates.catalogs.${index}.name`, $event)"
                    label="Name"
                    required
                    density="compact"
                    ></ValidationField>
                </v-col>
                <v-col
                    cols="12"
                    md="7"
                >
                    <ValidationField as="v-text-field" :validation="validation.field('catalog-' + validationRowId(catalog) + '-description')"
                    :model-value="catalog.description" @update:model-value="update('settings', `kubero.config.templates.catalogs.${index}.description`, $event)"
                    label="Description"
                    required
                    density="compact"
                    ></ValidationField>
                </v-col>
            </v-row>
            <v-row>
                <v-col
                    cols="12"
                    md="6"
                >
                    <ValidationField as="v-select" :validation="validation.field('catalog-' + validationRowId(catalog) + '-format')"
                    :model-value="catalog.index.format" @update:model-value="update('settings', `kubero.config.templates.catalogs.${index}.index.format`, $event)"
                    :items="['json']"
                    label="Index Format"
                    required
                    ></ValidationField>
                </v-col>
            </v-row>
            <v-row justify="space-between">
                <v-col
                    cols="12"
                    md="10"
                >
                    <ValidationField as="v-text-field" :validation="validation.field('catalog-' + validationRowId(catalog) + '-url')"
                    :model-value="catalog.index.url" @update:model-value="update('settings', `kubero.config.templates.catalogs.${index}.index.url`, $event)"
                    label="Index URL"
                    required
                    density="compact"
                    ></ValidationField>
                </v-col>
            </v-row>
            <v-row justify="space-between">

                <v-col
                    cols="12"
                    md="10"
                >
                </v-col>
                <v-col
                    cols="12"
                    md="2"
                >
                    <v-btn
                        elevation="2"
                        fab
                        small
                        class="ma-2"
                        color="secondary"
                        :aria-label="$t('settings.templates.deleteCatalog')"
                  @click="deleteBuildpack(catalog)"
                        >
                            <v-icon color="primary">
                                mdi-delete
                            </v-icon>
                    </v-btn>
                </v-col>
            </v-row>
            </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
        <p class="text-justify">
            <v-btn
                elevation="2"
                fab
                small
                class="ma-2"
                color="secondary"
                :aria-label="$t('settings.templates.addCatalog')"
                  @click="addTemplateCatalog"
                >
                    <v-icon color="primary">
                        mdi-plus
                    </v-icon>
            </v-btn>
        </p>
    </div>
</template>


<script lang="ts">
import type { FormValidation } from '../../composables/useFormValidation'
import { validationRowId, updateModelPath } from '../../composables/useFormValidation'
import { defineComponent, PropType } from 'vue'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

// Types
import { Catalog } from './form.vue'

export interface Buildpack {
    name: string
    language: string
    advanced: boolean
}

export default defineComponent({
    name: 'FormTemplates',
    emits: ['update:settings', 'update:secrets'],
    props: {
        validation: { type: Object as PropType<FormValidation>, required: true },
        settings: {
            type: Object as () => any,
            required: true,
        }
    },
    components: {
    },
    data() {
        return {
            show: false,
            panel: [] as number[]
        }
    },
    methods: {
        update(source: 'settings' | 'secrets', path: string, value: unknown) {
            const model = source === 'settings' ? this.settings : ('secrets' in this ? this.secrets : {})
            this.$emit(source === 'settings' ? 'update:settings' : 'update:secrets', updateModelPath(model, path, value))
        },

        validationRowId,
        revealCatalog(index: number) { if (!this.panel.includes(index)) this.panel = [...this.panel, index]; },
        async deleteBuildpack(catalog: Catalog) {
            const confirmed = await confirmDestructiveAction({
                title: this.$t('feedback.confirmRemove.title', { name: catalog.name }),
                text: this.$t('feedback.confirmRemove.message'),
                confirmButtonText: this.$t('global.remove'),
                cancelButtonText: this.$t('global.cancel'),
            })
            if (!confirmed) return

            this.panel = []
            this.update('settings', 'kubero.config.templates.catalogs', this.settings.kubero.config.templates.catalogs.filter((item: Catalog) => item !== catalog))
        },
        addTemplateCatalog() {
            this.update('settings', 'kubero.config.templates.catalogs', [...this.settings.kubero.config.templates.catalogs, {
                name: '',
                description: '',
                index: {
                    url: '',
                    format: 'json'
                }
            }])

            // open panel 
            this.panel = [this.settings.kubero.config.templates.catalogs.length]
        }
    }
})

</script>
