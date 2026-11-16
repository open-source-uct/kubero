<template>
    <div>
      <v-dialog
        v-model="dialog"
        max-width="600"
      >
        <template v-slot:activator="{ props: activatorProps }">
          <v-btn
            block
            prepend-icon="mdi-wrench"
            :text="$t('builds.build')"
            color="secondary"
            v-bind="activatorProps"
          ></v-btn>
        </template>
  
        <v-form @submit.prevent="saveBuild"><v-card
          color="cardBackground"
          class="uct-card"
          prepend-icon="mdi-wrench"
          :title="$t('builds.newBuild')"
        >
          <v-card-text>

            <v-row dense>
              <v-col
                cols="12"
                sm="6"
              >
                <ValidationField as="v-select" :validation="validation.field('strategy')"
                  :items="['nixpacks', 'dockerfile', 'buildpacks']"
                  :label="$t('validation.buildStrategy')"
                  description="The strategy to build the source code"
                  auto-select-first
                  required
                  v-model="form.buildstrategy"
                  @update:modelValue="changedBuildStrategy"
                ></ValidationField>
              </v-col>
              <v-col
                cols="12"
                sm="6"
              >
                <ValidationField as="v-combobox" :validation="validation.field('reference')"
                  :label="$t('validation.buildReference')"
                  description="The reference to the source code"
                  :items="references"
                  v-model="form.reference"
                ></ValidationField>
              </v-col>
              <v-col
                cols="12"
                sm="6"
              >
                <v-text-field
                  v-if="form.buildstrategy === 'dockerfile' || form.buildstrategy === 'nixpacks'"
                  label="Dockerfile Path"
                  description="Path to the Dockerfile in the source code"
                  v-model="form.dockerfilePath"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <small class="text-caption text-medium-emphasis">*indicates required field</small>
          </v-card-text>
  
          <v-divider></v-divider>
  
          <FormValidationSummary :validation="validation" class="px-6" />
          <v-card-actions>
            <v-spacer></v-spacer>
  
            <v-btn
              :text="$t('global.cancel')"
              variant="text"
              @click="dialog = false"
            ></v-btn>
  
            <v-btn
              color="primary"
              :text="$t('builds.build')"
              variant="flat"
              type="submit" :disabled="!validation.valid || validationSaving" :loading="validationSaving"
            ></v-btn>
          </v-card-actions>
        </v-card></v-form>
      </v-dialog>
    </div>
</template>



<script lang="ts">
import formValidationMixin from "../../composables/formValidationMixin";
import { buildFields } from "../../validation/addons";
import type { ValidationFieldDefinition } from "../../composables/useFormValidation";
import axios from "axios";
import { defineComponent } from 'vue'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'

export default defineComponent({
  mixins: [formValidationMixin],
  name: 'BuildsForm',
  
  props: {
        pipeline: {
            type: String,
            default: "MISSING"
        },
        phase: {
            type: String,
            default: "MISSING"
        },
        app: {
            type: String,
            default: "MISSING"
        },
        appData: {
            type: Object,
        }
  },
  data: () => ({
    dialog: false,
    form: {
        buildstrategy: 'dockerfile',
        reference: '',
        dockerfilePath: 'Dockerfile'
    },
    references: [] as string[],
  }),

  computed: {
    validationFields(): ValidationFieldDefinition[] {
      return buildFields(this.form, key => this.$t(key));
    },
  },
  watch: { dialog(value: boolean) { if (value) this.validation.reset(); } },
  mounted() {
    this.loadReferences()
    console.log('BuildsForm', this.pipeline, this.phase, this.app, this.appData)
  },
  methods: {
    changedBuildStrategy() {
        console.log('changedBuildStrategy', this.form.buildstrategy)
        if (this.form.buildstrategy === 'nixpacks') {
            this.form.dockerfilePath = '.nixpacks/Dockerfile'
        } else {
            this.form.dockerfilePath = 'Dockerfile'
        }
    },
    loadReferences() {
        const repoB64 = btoa(this.appData?.spec.gitrepo.ssh_url)
        //const provider = this.appData?.spec.gitrepo.provider
        const provider = "github" // TODO: FIX: get provider from appData
        axios.get(`/api/repo/${provider}/${repoB64}/references`)
        .then(response => {
            this.references = response.data
        })
        .catch(error => {
            notifyApiError(error, 'loadBuildReferences')
        })
    },
    saveBuild() {
        if (this.validationSaving || !this.validation.validate()) return;
        this.validationSaving = true;
        //console.log('Build', this.pipeline, this.phase, this.app, this.form, this.appData)
        let repository = this.appData?.spec.gitrepo.ssh_url
        if (!this.appData?.spec.gitrepo.private) {
            //repository = this.appData?.spec.gitrepo.ssh_url.replace('git@', 'https://')
            repository = this.appData?.spec.gitrepo.clone_url
        }

        const body = {
            buildstrategy: this.form.buildstrategy,
            repository: repository,
            reference: this.form.reference,
            dockerfilePath: this.form.dockerfilePath
        }
        axios.post(`/api/deployments/build/${this.pipeline}/${this.phase}/${this.app}`, body, handledApiErrorConfig)
        .then(() => {
            this.dialog = false
        })
        .catch(error => {
            notifyApiError(error, 'submitBuild')
        }).finally(() => { this.validationSaving = false })
    }
  }
})
</script>
