<template>
  <v-form v-model="valid">

  <v-alert
    v-if="showButtons && hasLockedAddons"
    type="info"
    variant="tonal"
    class="mt-4"
  >
    {{ $t('app.form.addonsLocked') }}
  </v-alert>

  <v-row class="pt-5">
    <v-col v-for="addon in addons" v-bind:key="addonName(addon) || addon.kind"
      cols="12"
      md="3"
    >

      <v-card color="cardBackground">
        <v-list-item class="justify-center">
          <div class="mx-auto text-center">
            <v-avatar
              size="57"
              rounded
              style="margin-top: 20px;"
              :image="addon.icon"
              :alt="addon.displayName"
            >
            </v-avatar>
            <h3>{{ addon.displayName }}</h3>
            <p class="text-caption mt-1">
              {{ addon.id }}
            </p>
            <div v-if="showButtons">
              <v-divider class="my-3"></v-divider>
              <v-btn
                v-if="canEdit(addon)"
                variant="text"
                color="primary"
                @click="editAddon(addon)"
              >
                {{ $t('global.edit') }}
              </v-btn>
              <v-btn
                variant="text"
                color="error"
                @click="deleteAddon(addon)"
              >
                {{ $t('global.delete') }}
              </v-btn>
            </div>
          </div>
        </v-list-item>
      </v-card>


    </v-col>

    <v-col
      cols="12"
      md="3">
    <v-dialog
      v-model="dialog"
      persistent
      max-width="600px"
    >
      <template v-slot:activator="{ props }" v-if="showButtons">
        <v-card
          color="cardBackground"
          variant="flat"
          class="d-flex flex-column align-center justify-center add-addon-card"
          style="height: 198.08px; cursor: pointer; border: 2px dashed rgb(var(--v-theme-primary), 0.25); transition: border-color 0.2s;"
          v-bind="props"
          @click="openNewDialog()"
          
        >
          <v-avatar size="57" rounded class="bg-primary-lighten-2 mb-2" style="background-color: rgb(var(--v-theme-secondary));" >
            <v-icon size="36">mdi-plus</v-icon>
          </v-avatar>
          <span class="text-subtitle-1 font-weight-medium mt-2 text-primary">Add Addon</span>
        </v-card>
      </template>
      <v-card color="cardBackground" class="uct-card">
        <v-card-title v-if="mode==='create'">
          <span class="text-h6 font-weight-bold">Addon</span>
        </v-card-title>
        <v-card-title v-if="mode==='edit'">
          <v-container class="pb-0">
            <v-avatar
              size="50"
              rounded
              :image="selectedAddon.icon"
              :alt="selectedAddon.displayName"
            ></v-avatar>
            <span class="text-h5 ml-4">{{ selectedAddon.displayName }}</span>
          </v-container>
        </v-card-title>
        <v-card-text>
          <v-container class="pt-0">
            <v-row>
              <v-col cols="12">
                <v-select
                  :items="availableAddons"
                  label="Addon"
                  outlined
                  item-title="text"
                  item-value="value"
                  v-if="mode==='create'"
                  v-model="selectedAddon"
                >
                  <template #item="{ item, props }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-avatar
                          v-if="item.value && item.value.icon"
                          size="24"
                          class="mr-2"
                          :image="item.value.icon"
                          :alt="item.value.displayName"
                        ></v-avatar>
                      </template>
                    </v-list-item>
                  </template>
                  <template #selection="{ item }">
                    <v-avatar
                      v-if="item.value && item.value.icon"
                      size="24"
                      class="mr-2"
                      :image="item.value.icon"
                      :alt="item.value.displayName"
                    ></v-avatar>
                    <span>{{ item.value.displayName }}</span>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" v-for="field in selectedAddon.formfields" v-bind:key="field.name">
                <v-select
                    v-if="field.type === 'select-storageclass'"
                    :items="availableStorageClasses"
                    :label="field.label"
                    :rules="baseSelectRule"
                    item-title="text"
                    item-value="value"
                    dense
                    v-model="field.default"
                ></v-select>
                <v-select
                    v-if="field.type === 'select' && typeof field.default === 'object'"
                    :items="field.options"
                    :label="field.label"
                    item-title="text"
                    item-value="value"
                    dense
                    v-model="field.default"
                ></v-select>
                <v-combobox
                    v-if="field.type === 'combobox' && typeof field.default === 'string'"
                    :items="field.options"
                    :label="field.label"
                    item-title="text"
                    item-value="value"
                    dense
                    v-model="field.default"
                ></v-combobox>
                <v-text-field
                    v-if="field.type === 'text'"
                    v-model="field.default"
                    :label="field.label"
                    :rules="field.required ? baseRule : []"
                    :required="field.required"
                    dense
                ></v-text-field>
                <v-text-field
                    v-if="field.type === 'number'"
                    v-model="field.default"
                    :label="field.label"
                    :rules="field.required ? baseRule : []"
                    :required="field.required"
                    dense
                    type="number"
                ></v-text-field>
                <v-switch
                    v-model="field.default"
                    :rules="field.required ? baseRule : []"
                    v-if="field.type === 'switch'"
                    :label="field.label"
                    :required="field.required"
                    color="primary"
                    dense
                ></v-switch>
              </v-col>

            </v-row>
          </v-container>
          <small>*indicates required field</small>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="dialog = false; selectedAddon = {} as Addon"
          >
            {{ $t('global.close') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!valid"
            @click="submitForm"
          >
            {{ $t('global.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-col>
  </v-row>
  </v-form>
</template>


<script lang="ts">
import axios from "axios";
import set from 'lodash/set';
import get from 'lodash/get';
import { defineComponent } from 'vue'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'

type Addon = {
    id: string,
    kind: string,
    version: string,
    env: string[],
    icon: string,
    displayName: string,
    resourceDefinitions: any,
    formfields: FormField[],
}

type FormField = {
    name: string,
    label: string,
    type: string,
    default: string | number | boolean,
    required: boolean,
    options: string[],
}

type AddonOption = {
    text: string,
    value: Addon,
}

type StorageClass = {
    text: string,
    value: string,
}


type AddonFormOption = {
    text: string,
    value: Addon,
}

type Event = {
    id: string,
    kind: string,
    version: string,
    env: string[],
    icon: string,
    displayName: string,
    resourceDefinitions: any,
}

export default defineComponent({
    props: {
        addons: {
            type: Array<Addon>,
            default: () => [] as Addon[],
        },
        appname: {
            type: String,
            default: ''
        },
        showButtons: {
            type: Boolean,
            default: true
        },
        // true si se está editando una app que ya existe en el clúster: sus
        // addons ya fueron creados y sus datos no se pueden modificar
        persisted: {
            type: Boolean,
            default: false
        },
    },
    computed: {
        hasLockedAddons(): boolean {
            return this.addons.some((addon) => !this.canEdit(addon));
        },
    },
    data: () => ({
        valid: false,
        dialog: false,
        mode: 'create',
        availableStorageClasses: [] as StorageClass[],
        availableAddons: [
            {
                text: '',
                value: {} as Addon,
            },
        ] as AddonOption[],
        selectedAddon: {} as Addon,
        // addons agregados en esta sesión y todavía no guardados: esos sí se
        // pueden seguir editando, porque aún no existen en el clúster
        newInSession: [] as string[],
        editingIndex: -1,
        baseRule: [
          (v: any) => !!v || 'Field is required',
        ],
        baseSelectRule: [
          (v: any) => v!=='default' || 'Select a value',
        ],
    }),
    mounted() {
        this.loadStorageClasses();
        this.loadAddons();
    },
    methods: {
        addonName(addon: Addon): string {
            const definition = Object.values(addon?.resourceDefinitions ?? {})[0] as any;
            return definition?.metadata?.name ?? '';
        },
        // Un addon ya creado no se edita: la base ignora usuario, contraseñas y
        // nombre nuevos, y en Postgres el operador quedaba actualizándolo en
        // bucle. Para usar otros datos se elimina y se vuelve a crear.
        canEdit(addon: Addon): boolean {
            return !this.persisted || this.newInSession.includes(this.addonName(addon));
        },
        openNewDialog() {
            this.mode = 'create';
            this.dialog = true;
        },
        loadStorageClasses() {
            axios.get(`/api/kubernetes/storageclasses`)
            .then(response => {
                for (let storageClass of response.data) {
                    this.availableStorageClasses.push({
                        text: storageClass.name,
                        value: storageClass.name
                    });
                }
                //console.log(this.availableStorageClasses);
            })
            .catch(error => {
                console.log(error);
            });
        },
        async deleteAddon(addon: Addon) {
            const confirmed = await confirmDestructiveAction({
                title: this.$t('feedback.confirmRemove.title', { name: addon.displayName || addon.kind }),
                // un addon ya creado se lleva su base al guardar (el server
                // borra su volumen): eso no se puede deshacer
                text: this.canEdit(addon)
                    ? this.$t('feedback.confirmRemove.message')
                    : this.$t('app.form.addonDeleteData'),
                confirmButtonText: this.$t('global.remove'),
                cancelButtonText: this.$t('global.cancel'),
            });
            if (!confirmed) return;

            // remove addon from local view and kuberoapp yaml
            const index = this.addons.indexOf(addon);
            if (index !== -1) this.addons.splice(index, 1);
            this.newInSession = this.newInSession.filter((name) => name !== this.addonName(addon));
        },
        editAddon(addon: Addon) {
            //console.log(addon);
            this.mode = 'edit';
            this.editingIndex = this.addons.indexOf(addon);

            // search in available addons for the selected addon
            for (let i = 0; i < this.availableAddons.length; i++) {
              if (this.availableAddons[i].value.kind == addon.kind) {
                this.selectedAddon = this.availableAddons[i].value;
                break;
              }
            }

            // set the formfields to the values from the yaml
            //console.log(this.selectedAddon.formfields);
            Object.entries(this.selectedAddon.formfields as FormField[]).forEach(([field, value]) => {
                const fieldvalue = get(addon.resourceDefinitions, field, value.default)
                //console.log(field, value, fieldvalue);

                if (value.name === 'metadata.name' && typeof value.default === 'string') {
                    if (fieldvalue.startsWith(this.appname)) {
                      // remove appname prefix
                      value.default = fieldvalue.replace(`${this.appname}-`, '');
                    }
                } else {
                   value.default = fieldvalue;
                }
            });
            //console.log(this.selectedAddon.formfields);

            this.dialog = true;
        },
        loadAddons() {
            axios.get(`/api/addons`)
            .then(response => {
                for (let addon of response.data) {
                    if (addon.enabled) {
                        this.availableAddons.push({
                            text: addon.displayName,
                            value: addon
                        });
                    }
                }
            })
            .catch(error => {
                console.log(error);
            });
        },
        submitForm() {
            this.dialog = false;

            // replace the formfields with the form value
            Object.entries(this.selectedAddon.formfields as FormField[]).forEach(([field, value]) => {

                // Cast number fields to int
                if (value.type === 'number' && typeof value.default === 'string') {
                    value.default = parseInt(value.default);
                }

                if (value.name === 'metadata.name' && typeof value.default === 'string') {
                    if (!value.default.startsWith(this.appname)) {
                        value.default = this.appname+"-"+value.default
                    }
                }

                set(this.selectedAddon.resourceDefinitions, field, value.default);
            });

            const addon = {
                id: this.selectedAddon.id,
                kind: this.selectedAddon.kind,
                version: this.selectedAddon.version,
                env: this.selectedAddon.env,
                icon: this.selectedAddon.icon,
                displayName: this.selectedAddon.displayName,
                // copia: la plantilla del addon es compartida, y sin esto dos
                // addons del mismo tipo terminaban con la misma definición
                resourceDefinitions: JSON.parse(JSON.stringify(this.selectedAddon.resourceDefinitions)),
            } as Addon;

            if (this.mode === 'create') {
                this.addAddon(addon);
            } else {
                this.updateAddon(addon);
            }

        },
        addAddon(addon: Addon) {
            this.addons.push(addon);
            this.newInSession.push(this.addonName(addon));
            this.$emit('addon-added', addon);
        },
        updateAddon(addon: Addon) {
            // por posición, no por tipo: con dos addons del mismo tipo se
            // reemplazaba siempre el primero
            if (this.editingIndex !== -1) {
                const previousName = this.addonName(this.addons[this.editingIndex]);
                this.addons[this.editingIndex] = addon;
                this.newInSession = this.newInSession.map((name) =>
                    name === previousName ? this.addonName(addon) : name,
                );
            }
            this.editingIndex = -1;
            this.$emit('addon-updated', addon);
        },
    }
})
</script>
