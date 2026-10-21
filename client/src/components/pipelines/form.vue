<template>
  <v-form v-model="valid" class="pipeline-form">
    <v-container class="pipeline-shell">
      <Breadcrumbs :items="breadcrumbItems"></Breadcrumbs>

      <header class="pipeline-header">
        <div class="pipeline-header__icon" aria-hidden="true">
          <v-icon size="30" color="primary">mdi-source-fork</v-icon>
        </div>
        <div class="pipeline-header__copy">
          <h1 v-if="pipeline == 'new'" class="uct-h1 pipeline-header__title">
            {{ $t('pipeline.form.title.create') }}
          </h1>
          <i18n-t v-else keypath="pipeline.form.title.edit" tag="h1" class="uct-h1 pipeline-header__title">
            <template #name>
              <span class="pipeline-header__name">{{ pipelineName }}</span>
            </template>
          </i18n-t>
          <p class="pipeline-header__description">
            {{ $t('pipeline.form.description') }}
          </p>
        </div>
      </header>

      <main class="pipeline-content">
        <v-card color="cardBackground" class="uct-card pipeline-card pipeline-card--settings" elevation="0">
          <v-card-text class="pipeline-card__body">
            <v-row class="pipeline-fields" dense>
              <v-col cols="12" lg="6">
                <v-text-field
                  v-model="pipelineName"
                  :rules="nameRules"
                  :counter="60"
                  :label="$t('pipeline.form.label.name') + ' *'"
                  :disabled="!newPipeline"
                  variant="outlined"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" lg="6">
                <v-combobox
                  v-model="access.teams"
                  chips
                  multiple
                  :label="$t('pipeline.form.label.teamAccess')"
                  hint="Select teams that have access to this pipeline"
                  :items="isAdmin ? allTeams : authStore.userGroups"
                  :rules="teamRules"
                  variant="outlined"
                ></v-combobox>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="domain"
                  :rules="domainRules"
                  :label="$t('pipeline.form.label.fqdnDomain')"
                  hint="This Wildcard Domain should point to the IP of your clusters IP defined in 'Cluster Context'. It will be used as a base domain when creating a new app."
                  variant="outlined"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card color="cardBackground" class="uct-card pipeline-card pipeline-card--environments" elevation="0">
          <v-card-title class="pipeline-card__header">
            <span class="uct-section-title">{{ $t('pipeline.form.title.environments') }}</span>
            <v-icon size="20" color="primary" aria-hidden="true">mdi-layers-triple-outline</v-icon>
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="pipeline-card__body pipeline-card__body--environments">
            <section
              v-for="phase in phases"
              :key="phase.name"
              class="phase-row"
              :class="{ 'phase-row--enabled': phase.enabled }"
            >
              <div class="phase-row__rail" aria-hidden="true"></div>
              <div class="phase-row__content">
                <div class="phase-row__controls">
                  <v-switch
                    v-model="phase.enabled"
                    :label="phase.name"
                    :disabled="phase.name == 'review'"
                    class="phase-switch"
                    color="primary"
                    density="compact"
                    hide-details
                  ></v-switch>
                  <v-select
                    v-if="phase.enabled && phase.name != 'review'"
                    v-model="phase.context"
                    class="phase-context"
                    :items="contextList"
                    :label="$t('pipeline.form.label.cluster')"
                    variant="outlined"
                    density="compact"
                    hide-details
                  ></v-select>
                </div>

                <div v-if="phase.enabled && phase.name == 'review'" class="review-settings">
                  <v-row dense>
                    <v-col cols="12" md="6">
                      <v-select
                        v-if="phase.enabled"
                        v-model="phase.context"
                        :items="contextList"
                        :label="$t('pipeline.form.label.clusterContext') + ' *'"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="phase.domain"
                        :rules="domainRules"
                        label="Base domain"
                        density="compact"
                        hint="This Wildcard Domain should point to the IP of your cluster defined in 'Cluster Context'. It will be used to create a subdomain for each PR."
                        variant="outlined"
                      ></v-text-field>
                    </v-col>
                  </v-row>

                  <div class="env-header">
                    <div class="uct-label env-header__title">Default Environment Variables</div>
                    <v-btn
                      variant="text"
                      size="small"
                      color="primary"
                      :prepend-icon="showEnvValues ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                      @click="showEnvValues = !showEnvValues"
                    >
                      {{ showEnvValues ? $t('app.form.hideEnvValues') : $t('app.form.showEnvValues') }}
                    </v-btn>
                  </div>

                  <div class="env-list">
                    <v-row
                      v-for="(envvar, index) in phase.defaultEnvvars"
                      :key="index"
                      class="env-row"
                      dense
                    >
                      <v-col cols="12" md="5">
                        <v-text-field
                          v-model="envvar.name"
                          :label="$t('global.name')"
                          density="compact"
                          :counter="60"
                          variant="outlined"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="envvar.value"
                          :label="$t('global.value')"
                          density="compact"
                          :type="showEnvValues ? 'text' : 'password'"
                          autocomplete="new-password"
                          variant="outlined"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" md="1" class="env-row__action">
                        <v-btn
                          icon="mdi-minus"
                          size="small"
                          variant="tonal"
                          color="error"
                          aria-label="Remove environment variable"
                          @click="removeEnvLine(phase, envvar.name)"
                        ></v-btn>
                      </v-col>
                    </v-row>
                  </div>

                  <v-btn
                    class="env-add"
                    icon="mdi-plus"
                    size="small"
                    variant="tonal"
                    color="primary"
                    aria-label="Add environment variable"
                    @click="addEnvLine(phase)"
                  ></v-btn>
                </div>
              </div>
            </section>
          </v-card-text>
        </v-card>

        <div class="pipeline-actions">
          <v-btn
            v-if="newPipeline"
            color="primary"
            size="large"
            variant="flat"
            prepend-icon="mdi-source-fork"
            :disabled="!valid"
            @click="createPipeline()"
          >
            {{ $t('pipeline.buttons.create') }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            size="large"
            variant="flat"
            prepend-icon="mdi-content-save-outline"
            :disabled="!valid"
            @click="updatePipeline()"
          >
            {{ $t('pipeline.buttons.update') }}
          </v-btn>
        </div>
      </main>
    </v-container>
  </v-form>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'
import Breadcrumbs from "../breadcrumbs.vue";
import { EnvVar } from '../apps/form.vue'
import { useAuthStore } from '../../stores/auth';
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'

const authStore = useAuthStore();

export default defineComponent({
    props: {
      pipeline: {
        type: String,
        default: "new"
      }
    },
    data () {
    return {
      access: {
        teams: [] as string[],
      },
      // todos los equipos que existen (para que un admin pueda asignar
      // cualquiera, no solo los suyos); solo se carga si es admin
      allTeams: [] as string[],
      authStore,
      showEnvValues: false,
      breadcrumbItems: [
          {
              title: 'Dashboard.Pipelines',
              disabled: false,
              to: { name: 'Pipelines', params: {}}
          },
      ],
      dockerimage: '',
      deploymentstrategy: "docker",
      buildstrategy: "plain",
      newPipeline: true,
      resourceVersion: undefined,
      valid: false, // final form validation
      pipelineName: '',
      domain: '',
      reviewapps: false,
      contextList: [] as string[], // a list of kubernets contexts in the kubeconfig to select from
      // solo se llenan al editar un pipeline existente, para no perder lo que ya tenía
      git: undefined as any,
      registry: undefined as any,
      buildpack: undefined as any,
      phases: [ // List of phases to enable
        {
          name: 'review',
          enabled: false,
          context: '',
          domain: '',
          defaultTTL: undefined as number | undefined,
          defaultEnvvars: [] as EnvVar[],
        },
        {
          name: 'test',
          enabled: false,
          context: '',
          domain: '',
          defaultTTL: undefined as number | undefined,
          defaultEnvvars: [] as EnvVar[],
        },
        {
          name: 'stage',
          enabled: false,
          context: '',
          domain: '',
          defaultTTL: undefined as number | undefined,
          defaultEnvvars: [] as EnvVar[],
        },
        {
          name: 'production',
          enabled: true,
          context: '',
          domain: '',
          defaultTTL: undefined as number | undefined,
          defaultEnvvars: [] as EnvVar[],
        },
      ],
      nameRules: [
        (v: any) => !!v || 'Name is required',
        (v: any) => v.length <= 60 || 'Name must be less than 60 characters',
        (v: any) => /^[a-z0-9][a-z0-9-]*$/.test(v) || 'Allowed characters : [a-z0-9-]',
        (v: any) => v !== 'new' || 'Name cannot be "new"',
      ],
      domainRules: [
        //(v: any) => v.length <= 253 || 'Name must be less than 253 characters',
        (v: any) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^localhost$|^$/.test(v) || 'Not a domain',
      ],
    }}, 
    computed: {
      isAdmin(): boolean {
        return this.authStore.role === 'admin';
      },
      // 'everyone' no se preselecciona: haría el pipeline visible para todos los usuarios
      defaultTeams(): string[] {
        return this.authStore.userGroups.filter(
          (g: string) => g !== 'everyone' && g !== 'admin',
        );
      },
      teamRules(): ((v: string[]) => boolean | string)[] {
        return [
          (v: string[]) =>
            this.isAdmin ||
            (Array.isArray(v) && v.length > 0) ||
            this.$t('pipeline.form.validation.teamRequired'),
        ];
      },
    },
    watch: {
      defaultTeams: {
        immediate: true,
        handler(teams: string[]) {
          if (this.pipeline === 'new' && this.access.teams.length === 0) {
            this.access.teams = [...teams];
          }
        },
      },
    },
    mounted() {
      this.getContextList();
      this.loadPipeline();
      if (this.isAdmin) {
        this.loadTeams();
      }
    },
    components: {
        Breadcrumbs,
    },
    methods: {
      loadTeams() {
        axios.get('/api/groups').then((response) => {
          this.allTeams = response.data.map((group: any) => group.name);
        }).catch(() => {
          // si falla, el combobox queda igual que antes (solo los equipos propios)
          this.allTeams = [];
        });
      },
      getContextList() {
        axios.get('/api/kubernetes/contexts').then(response => {
          for (let i = 0; i < response.data.length; i++) {
            this.contextList.push(response.data[i].name);
          }
          if (response.data.length > 0) {
            this.phases[0].context = response.data[0].name;
            this.phases[1].context = response.data[0].name;
            this.phases[2].context = response.data[0].name;
            this.phases[3].context = response.data[0].name;
          }
        });
      },
      loadPipeline() {
        if (this.pipeline !== 'new') {
          axios.get(`/api/pipelines/${this.pipeline}`)
          .then(response => {
            this.newPipeline = false;
            const p = response.data;

            this.access.teams = p.access?.teams || [];
            this.resourceVersion = p.resourceVersion;
            this.pipelineName = p.name;
            this.domain = p.domain;
            this.phases = p.phases;
            this.reviewapps = p.reviewapps;
            this.git = p.git;
            this.registry = p.registry;
            this.buildstrategy = p.buildstrategy || this.buildstrategy;
            this.dockerimage = p.dockerimage;
            this.deploymentstrategy = p.deploymentstrategy;
            this.buildpack = p.buildpack;

            // Backward compatibility for < v2.4.6
            for (let i = 0; i < this.phases.length; i++) {
              if (this.phases[i].defaultEnvvars === undefined) {
                this.phases[i].defaultEnvvars = [] as EnvVar[];
              }
            }
          }).catch(error => {
            console.log(error);
          });
        }
      },
      createPipeline() {
        axios.post(`/api/pipelines/${this.pipeline}`, {
          access: this.access,
          pipelineName: this.pipelineName,
          domain: this.domain,
          phases: this.phases,
          reviewapps: this.reviewapps,
          dockerimage: '',
          deploymentstrategy: this.deploymentstrategy,
          buildstrategy: this.buildstrategy,
        }, handledApiErrorConfig)
        .then(() => {
          this.pipelineName = '';
          this.$router.push({path: '/'});
        })
        .catch(error => {
          notifyApiError(error, 'createPipeline');
        });
      },
      updatePipeline() {
        axios.put(`/api/pipelines/${this.pipeline}`, {
          access: this.access,
          resourceVersion: this.resourceVersion,
          pipelineName: this.pipelineName,
          domain: this.domain,
          phases: this.phases,
          reviewapps: this.reviewapps,
          git: this.git,
          registry: this.registry,
          dockerimage: '',
          deploymentstrategy: this.deploymentstrategy,
          buildstrategy: this.buildstrategy,
          buildpack: this.buildpack,
        }, handledApiErrorConfig)
        .then(() => {
          this.pipelineName = '';
          this.$router.push({path: '/'});
        })
        .catch(error => {
          notifyApiError(error, 'updatePipeline');
        });
      },
      addEnvLine(phase: any) {
        phase.defaultEnvvars.push({
          name: '',
          value: '',
        });
      },
      removeEnvLine(phase: any, index: string) {
        for (let i = 0; i < phase.defaultEnvvars.length; i++) {
          if (phase.defaultEnvvars[i].name === index) {
            phase.defaultEnvvars.splice(i, 1);
          }
        }
      },
    },
})
</script>

<style lang="scss" scoped>
.pipeline-form {
  min-height: 100%;
}

.pipeline-shell {
  max-width: 1120px;
  padding: 24px;
}

.pipeline-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 8px 0 24px;
}

.pipeline-header__icon {
  display: grid;
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 12px;
  background: rgb(var(--v-theme-primary) / 0.1);
}

.pipeline-header__copy {
  min-width: 0;
}

.pipeline-header__title {
  margin: 0;
  color: rgb(var(--v-theme-on-background));
}

.pipeline-header__name {
  color: rgb(var(--v-theme-primary));
}

.pipeline-header__description {
  max-width: 70ch;
  margin: 4px 0 0;
  color: rgb(var(--v-theme-on-background) / 0.68);
  font-size: 0.875rem;
  line-height: 1.5;
}

.pipeline-content {
  display: grid;
  gap: 24px;
}

.pipeline-card {
  overflow: hidden;
}

.pipeline-card__header {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.pipeline-card__body {
  padding: 24px;
}

.pipeline-card__body--environments {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.pipeline-fields {
  margin-bottom: -12px;
}

.phase-row {
  position: relative;
  display: grid;
  grid-template-columns: 3px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgb(var(--v-theme-on-cardBackground) / 0.1);
  border-radius: 8px;
  background: rgb(var(--v-theme-secondary) / 0.42);
  transition: border-color 180ms ease-out, background-color 180ms ease-out;
}

.phase-row--enabled {
  border-color: rgb(var(--v-theme-primary) / 0.24);
  background: rgb(var(--v-theme-cardBackground));
}

.phase-row__rail {
  background: rgb(var(--v-theme-on-cardBackground) / 0.12);
  transition: background-color 180ms ease-out;
}

.phase-row--enabled .phase-row__rail {
  background: rgb(var(--v-theme-primary));
}

.phase-row__content {
  min-width: 0;
  padding: 12px 16px;
}

.phase-row__controls {
  display: grid;
  grid-template-columns: minmax(180px, 0.4fr) minmax(240px, 0.6fr);
  align-items: center;
  gap: 24px;
  min-height: 44px;
}

.phase-switch {
  width: fit-content;
  text-transform: capitalize;
}

.phase-switch :deep(.v-label) {
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.025em;
}

.review-settings {
  padding-top: 16px;
  border-top: 1px solid rgb(var(--v-theme-on-cardBackground) / 0.1);
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 4px 0 12px;
}

.env-header__title {
  color: rgb(var(--v-theme-on-cardBackground) / 0.62) !important;
}

.env-list {
  display: grid;
  gap: 4px;
}

.env-row__action {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.env-add {
  margin-top: 4px;
}

.pipeline-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 0 16px;
}

.pipeline-actions .v-btn {
  min-width: 176px;
  border-radius: 8px;
  font-weight: 600;
}

.pipeline-card :deep(.v-field) {
  border-radius: 8px;
}

.pipeline-card :deep(.v-field--focused) {
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary) / 0.12);
}

@media (max-width: 959px) {
  .pipeline-shell {
    padding: 16px;
  }

  .pipeline-header {
    margin-bottom: 20px;
  }

  .phase-row__controls {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .phase-context {
    width: 100%;
    padding-bottom: 4px;
  }

  .env-row__action {
    justify-content: flex-start;
    padding-top: 0;
  }
}

@media (max-width: 599px) {
  .pipeline-shell {
    padding: 12px;
  }

  .pipeline-header {
    align-items: flex-start;
    gap: 12px;
  }

  .pipeline-header__icon {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
    border-radius: 8px;
  }

  .pipeline-card__body {
    padding: 16px;
  }

  .pipeline-card__body--environments {
    padding: 12px;
  }

  .phase-row__content {
    padding: 12px;
  }

  .env-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .pipeline-actions .v-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .phase-row,
  .phase-row__rail {
    transition: none;
  }
}
</style>
