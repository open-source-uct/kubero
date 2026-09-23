<template>
  <v-form v-model="valid">
    <v-container>
      <Breadcrumbs :items="breadcrumbItems"></Breadcrumbs>
      <v-row>
        <v-col
          cols="12"
          md="1"
        >
          <v-icon
            size="44"
            color="primary"
            class="mr-2"
          >mdi-source-fork</v-icon>
        </v-col>
        <v-col cols="12" sm="11" md="11" lg="11" xl="11">

            <h2 v-if="pipeline=='new'">
                Create a new Pipeline
            </h2>
            <h2 v-if="pipeline!='new'">
                Edit <span style="color: rgb(var(--v-theme-kubero))">{{ pipelineName }}</span>
            </h2>
            <p class="text-justify">
                A Pipeline may have several stages with apps
            </p>
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          md="5"
        >
          <v-text-field
            v-model="pipelineName"
            :rules="nameRules"
            :counter="60"
            :label="$t('pipeline.form.label.name') + ' *'"
            :disabled="!newPipeline"
            required
          ></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          md="6"
        >
          <v-text-field
            v-model="domain"
            :rules="domainRules"
            :label="$t('pipeline.form.label.fqdnDomain')"
            hint="This Wildcard Domain should point to the IP of your clusters IP defined in 'Cluster Context'. It will be used as a base domain when creating a new app."
          ></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col
          cols="12"
          md="6"
        >
        <v-combobox
            chips
            multiple
            v-model="access.teams"
            :label="$t('pipeline.form.label.teamAccess')"
            hint="Select teams that have access to this pipeline"
            :items="authStore.userGroups"
            :rules="teamRules"
          ></v-combobox>
        </v-col>
      </v-row>




      <v-card elevation="2" color="cardBackground">
        <v-card-title>{{ $t('pipeline.form.title.environments') }}</v-card-title>
        <v-card-text>
          <div v-for="phase in phases" :key="phase.name" class="my-0">
          <v-row>
            <v-col
              cols="12"
              md="3"
              class="py-0"
            >
              <v-switch
                v-model="phase.enabled"
                :label="phase.name"
                :disabled="phase.name == 'review'"
                dense
                class="text-overline"
                color="primary"
              ></v-switch>
            </v-col>
            <v-col
              cols="12"
              md="4"
              class="py-0"
            >
              <v-select
                v-model="phase.context"
                :items="contextList"
                :label="$t('pipeline.form.label.cluster')"
                v-if="phase.enabled && phase.name != 'review'"
                dense
              ></v-select>
            </v-col>
          </v-row>
            <div v-if="phase.enabled && phase.name == 'review'">
              <v-row>
                <v-col
                  cols="12"
                  md="5"
                  class="py-0"
                >
                  <v-select
                    v-model="phase.context"
                    :items="contextList"
                    :label="$t('pipeline.form.label.clusterContext') + ' *'"
                    v-if="phase.enabled"
                    dense
                  ></v-select>
                </v-col>
              </v-row>
              <!-- TTL Feature is not ready yet
              <v-row v-if="phase.name == 'review'">
                <v-col
                  cols="12"
                  md="2"
                  class="py-0"
                  density="compact"
                >
                  <v-combobox
                    clearable
                    label="TTL"
                    :items="['8h', '1d', '1w', '1m']"
                  ></v-combobox>
                </v-col>
              </v-row>
              -->
              <v-row>
                <v-col
                  cols="12"
                  md="5"
                >
                  <v-text-field
                    v-model="phase.domain"
                    :rules="domainRules"
                    label="Base domain"
                    density="compact"
                    hint="This Wildcard Domain should point to the IP of your cluster defined in 'Cluster Context'. It will be used to create a subdomain for each PR."
                  ></v-text-field>
                </v-col>
              </v-row>
              <div class="d-flex align-center pa-2 mb-1">
                <div class="font-weight-bold v-label">Default Environment Variables</div>
                <v-btn
                  variant="text"
                  size="small"
                  class="ml-2"
                  :prepend-icon="showEnvValues ? 'mdi-eye-off' : 'mdi-eye'"
                  @click="showEnvValues = !showEnvValues"
                >
                  {{ showEnvValues ? $t('app.form.hideEnvValues') : $t('app.form.showEnvValues') }}
                </v-btn>
              </div>
              <v-row v-for="(envvar, index) in phase.defaultEnvvars" :key="index">
                <v-col
                  cols="12"
                  md="5"
                  class="py-0"
                >
                  <v-text-field
                    v-model="envvar.name"
                    :label="$t('global.name')"
                    density="compact"
                    :counter="60"
                  ></v-text-field>
                </v-col>
                <v-col
                  cols="12"
                  md="6"
                  class="py-0"
                >
                  <v-text-field
                    v-model="envvar.value"
                    :label="$t('global.value')"
                    density="compact"
                    :type="showEnvValues ? 'text' : 'password'"
                    autocomplete="new-password"
                  ></v-text-field>
                </v-col>
                <v-col
                  cols="12"
                  md="1"
                  class="py-0"
                >
                  <v-btn
                  elevation="2"
                  icon
                  size="small"
                  @click="removeEnvLine(phase, envvar.name)"
                  >
                      <v-icon dark >
                          mdi-minus
                      </v-icon>
                  </v-btn>
                </v-col>
              </v-row>

              <v-row class="mt-0">
                <v-col
                  cols="12"
                  class="pt-0 mb-8"
                >
                  <v-btn
                  elevation="2"
                  icon
                  size="small"
                  @click="addEnvLine(phase)"
                  >
                      <v-icon dark >
                          mdi-plus
                      </v-icon>
                  </v-btn>
                </v-col>
              </v-row>
              <hr class="mb-5">
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col
          cols="12"
          md="4"
          class="mt-8"
        >
            <v-btn
                color="primary"
                v-if="newPipeline"
                elevation="2"
                @click="createPipeline()"
                :disabled="!valid"
                >{{ $t('pipeline.buttons.create') }}</v-btn>
            <v-btn
                color="primary"
                v-if="!newPipeline"
                elevation="2"
                @click="updatePipeline()"
                :disabled="!valid"
                >{{ $t('pipeline.buttons.update') }}</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'
import Breadcrumbs from "../breadcrumbs.vue";
import { EnvVar } from '../apps/form.vue'
import { useAuthStore } from '../../stores/auth';

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
        return this.authStore.userGroups.includes('admin');
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
    },
    components: {
        Breadcrumbs,
    },
    methods: {
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
        })
        .then(response => {
          this.pipelineName = '';
          //console.log(response);
          this.$router.push({path: '/'});
        })
        .catch(error => {
          console.log(error);
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
        })
        .then(response => {
          this.pipelineName = '';
          //console.log(response);
          this.$router.push({path: '/'});
        })
        .catch(error => {
          console.log(error);
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

<style lang="scss">
.alert i.v-icon.v-icon {
  color: white !important;
}

.gogs{
    background-image: url('./../../../public/img/icons/gogs.svg');
    background-size: contain;
    background-repeat: no-repeat;
    filter: brightness(0) saturate(100%) invert(28%) sepia(0%) saturate(78%) hue-rotate(197deg) brightness(95%) contrast(83%);
    /*filter: invert(39%) sepia(47%) saturate(584%) hue-rotate(228deg) brightness(95%) contrast(80%);
    /*filter: invert(93%) sepia(49%) saturate(7411%) hue-rotate(184deg) brightness(87%) contrast(90%);*/
}

.gogs::before {
    height: 23px;
    width: 23px;
    visibility: hidden;
    content: "";
}


.onedev{
    background-image: url('./../../../public/img/icons/onedev.svg');
    background-size: contain;
    background-repeat: no-repeat;
    filter: brightness(0) saturate(100%) invert(28%) sepia(0%) saturate(78%) hue-rotate(197deg) brightness(95%) contrast(83%);
    /*filter: invert(39%) sepia(47%) saturate(584%) hue-rotate(228deg) brightness(95%) contrast(80%);
    /*filter: invert(93%) sepia(49%) saturate(7411%) hue-rotate(184deg) brightness(87%) contrast(90%);*/
}

.onedev::before {
    height: 23px;
    width: 23px;
    visibility: hidden;
    content: "";
}

.gitea{
    background-image: url('./../../../public/img/icons/gitea.svg');
    background-size: contain;
    background-repeat: no-repeat;
    filter: brightness(0) saturate(100%) invert(28%) sepia(0%) saturate(78%) hue-rotate(197deg) brightness(95%) contrast(83%);
    /*filter: invert(39%) sepia(47%) saturate(584%) hue-rotate(228deg) brightness(95%) contrast(80%);
    /*filter: invert(93%) sepia(49%) saturate(7411%) hue-rotate(184deg) brightness(87%) contrast(90%);*/
}

.gitea::before {
    height: 23px;
    width: 23px;
    visibility: hidden;
    content: "";
}

</style>