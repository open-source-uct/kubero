<template>
  <v-form v-model="valid">

  <v-alert
    v-if="showButtons && persisted"
    type="info"
    variant="tonal"
    class="mt-4"
  >
    {{ $t('app.form.addonsInstant') }}
    <template v-if="hasLockedAddons"> {{ $t('app.form.addonsLocked') }}</template>
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
                :loading="removing === addonName(addon)"
                :disabled="removing !== ''"
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
              <v-col cols="12" v-if="dialogError">
                <v-alert type="error" variant="tonal" density="compact">
                  {{ dialogError }}
                </v-alert>
              </v-col>
              <v-col cols="12" v-if="prefilledFrom">
                <v-alert type="info" variant="tonal" density="compact">
                  {{ $t('app.form.postgresPrefilled', { vars: prefilledFrom }) }}
                </v-alert>
              </v-col>
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
            :disabled="saving"
            @click="closeDialog"
          >
            {{ $t('global.close') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!valid"
            :loading="saving"
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
import { addonPrefill, POSTGRES_ADDON_KIND, type EnvVar } from '../../utils/postgresEnv'
// los avisos de crear o eliminar un addon los muestra este componente, con
// su nombre; sin esto el aviso genérico de "guardado" salía repetido
const instantAddonConfig = { feedback: { error: false, success: false } }
import { useNotificationStore } from '../../stores/notifications'

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
        // para guardar al instante los addons de una app ya creada
        pipeline: {
            type: String,
            default: ''
        },
        phase: {
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
        // variables de entorno de la app: un Postgres nuevo se rellena con ellas
        envVars: {
            type: Array<EnvVar>,
            default: () => [] as EnvVar[],
        },
    },
    watch: {
        selectedAddon() {
            this.onAddonSelected();
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
        // variables de la app con que se rellenó el addon, para avisarlo
        prefilledFrom: '',
        // copia intacta de cada plantilla (por tipo): la ventana escribe sobre
        // la plantilla, y sin esto un addon nuevo aparecía con los datos del
        // anterior
        pristineAddons: {} as Record<string, string>,
        // guardando el addon del diálogo, o nombre del addon que se está quitando
        saving: false,
        removing: '',
        dialogError: '',
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
        // Al elegir PostgreSQL al crear un addon, usuario, contraseña y base se
        // completan con lo que la app ya usa en sus variables, para que ambos
        // coincidan desde el principio. El estudiante puede cambiarlos igual.
        applyPostgresPrefill() {
            this.prefilledFrom = '';
            if (this.mode !== 'create' || this.selectedAddon?.kind !== POSTGRES_ADDON_KIND) return;

            const fields = this.selectedAddon.formfields as unknown as Record<string, FormField>;
            const field = (path: string) => fields?.[`${POSTGRES_ADDON_KIND}.${path}`];
            const setField = (path: string, value: string | boolean) => {
                const f = field(path);
                if (f) f.default = value;
            };

            const prefill = addonPrefill(this.envVars as EnvVar[], this.appname);
            if (prefill) {
                setField('spec.postgres.auth.username', prefill.auth.username ?? '');
                setField('spec.postgres.auth.password', prefill.auth.password ?? '');
                setField('spec.postgres.auth.database', prefill.auth.database ?? '');
                if (prefill.auth.enablePostgresUser) {
                    setField('spec.postgres.auth.enablePostgresUser', true);
                }
                if (prefill.auth.postgresPassword) {
                    setField('spec.postgres.auth.postgresPassword', prefill.auth.postgresPassword);
                }
                if (prefill.name) {
                    setField('metadata.name', prefill.name);
                }
                this.prefilledFrom = prefill.vars.join(', ');
            }
        },
        openNewDialog() {
            this.mode = 'create';
            this.dialogError = '';
            // sin addon elegido: elegir uno (aunque sea el mismo tipo de antes)
            // parte siempre de la plantilla limpia
            this.selectedAddon = {} as Addon;
            this.dialog = true;
        },
        onAddonSelected() {
            if (this.mode === 'create' && this.selectedAddon?.kind) {
                this.resetTemplate(this.selectedAddon);
            }
            this.applyPostgresPrefill();
        },
        resetTemplate(addon: Addon) {
            const pristine = this.pristineAddons[addon.kind];
            if (!pristine) return;
            const fresh = JSON.parse(pristine) as Addon;
            addon.formfields = fresh.formfields;
            addon.resourceDefinitions = fresh.resourceDefinitions;
        },
        closeDialog() {
            this.dialog = false;
            this.dialogError = '';
            this.selectedAddon = {} as Addon;
        },
        // Un addon de una app que ya existe se crea y se borra al instante, sin
        // esperar a "Actualizar". Los de una app nueva van con el botón Crear.
        savesInstantly(addon?: Addon): boolean {
            return this.persisted && (!addon || !this.newInSession.includes(this.addonName(addon)));
        },
        addonsUrl(): string {
            return `/api/apps/${this.pipeline}/${this.phase}/${this.appname}/addons`;
        },
        // el mensaje del server dice qué corregir (nombre inválido, volumen
        // anterior, falta una contraseña...); otros errores, un texto general
        apiMessage(error: any): string {
            const status = error?.response?.status;
            const message = error?.response?.data?.message;
            if ([400, 404, 409].includes(status) && message) {
                return Array.isArray(message) ? message.join('. ') : String(message);
            }
            return this.$t('app.form.addonSaveError') as string;
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

            if (this.savesInstantly(addon)) {
                const name = this.addonName(addon);
                this.removing = name;
                try {
                    const { data } = await axios.delete(
                        `${this.addonsUrl()}/${encodeURIComponent(name)}`,
                        instantAddonConfig,
                    );
                    this.$emit('saved', { resourceVersion: data.resourceVersion, generation: data.generation });
                    if (data.volumesPending) {
                        // se eliminó, pero el volumen tarda: el aviso queda más tiempo
                        useNotificationStore().show({
                            kind: 'success',
                            title: this.$t('app.form.addonRemoved') as string,
                            message: this.$t('app.form.addonVolumePending') as string,
                            duration: 10000,
                        });
                    } else {
                        useNotificationStore().success(
                            this.$t('app.form.addonRemoved') as string,
                            this.$t('app.form.addonRemovedMessage', { name }) as string,
                        );
                    }
                } catch (error: any) {
                    // 404: el addon ya no existe en el clúster (otra persona lo
                    // quitó); solo falta sacarlo de la vista
                    if (error?.response?.status !== 404) {
                        useNotificationStore().error(
                            this.$t('app.form.addonRemoveError') as string,
                            this.apiMessage(error),
                        );
                        return;
                    }
                } finally {
                    this.removing = '';
                }
            }

            // remove addon from local view and kuberoapp yaml
            const index = this.addons.indexOf(addon);
            if (index !== -1) this.addons.splice(index, 1);
            this.newInSession = this.newInSession.filter((name) => name !== this.addonName(addon));
        },
        editAddon(addon: Addon) {
            //console.log(addon);
            this.mode = 'edit';
            this.dialogError = '';
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
                        this.pristineAddons[addon.kind] = JSON.stringify(addon);
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
        async submitForm() {
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

            if (this.mode === 'create' && this.savesInstantly()) {
                // la ventana queda abierta hasta que el server lo acepte, para
                // mostrar ahí mismo qué corregir si lo rechaza
                this.saving = true;
                this.dialogError = '';
                try {
                    const { data } = await axios.post(this.addonsUrl(), addon, instantAddonConfig);
                    this.pushAddon(addon);
                    this.$emit('saved', { resourceVersion: data.resourceVersion, generation: data.generation });
                    useNotificationStore().success(
                        this.$t('app.form.addonCreated') as string,
                        this.$t('app.form.addonCreatedMessage', { name: this.addonName(addon) }) as string,
                    );
                } catch (error) {
                    this.dialogError = this.apiMessage(error);
                    return;
                } finally {
                    this.saving = false;
                }
                this.closeDialog();
                return;
            }

            this.dialog = false;
            if (this.mode === 'create') {
                this.addAddon(addon);
            } else {
                this.updateAddon(addon);
            }

        },
        // la lista es la misma que el formulario envía al guardar la app
        pushAddon(addon: Addon) {
            this.addons.push(addon);
        },
        addAddon(addon: Addon) {
            this.pushAddon(addon);
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
