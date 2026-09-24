<template>
<v-card
    :loading="loadingState"
    class="mt-4 ml-1 pullrequest uct-card"
    elevation="1"
    color="cardBackground"
    v-if="deleted === false"
    style="max-width: 600px;"
    >
    <!-- @vue-expect-error el slot "progress" existe en runtime (viene del mixin de loading de Vuetify), pero no está tipado en VCard -->
    <template v-slot:progress>
      <v-progress-linear
        color="primary"
        height="2"
        indeterminate
      ></v-progress-linear>
    </template>

    <v-card-text class="pt-3 pb-1">
      <v-list :prepend-avatar="pullrequest.user.avatar_url" bg-color="cardBackground">
        <v-list-item class="px-0">
          <v-list-item-subtitle class="uct-label">{{ pullrequest.user.login }}</v-list-item-subtitle>
          <v-list-item-title class="font-weight-bold" style="white-space: inherit; min-width: 250px;">
            <a :href="pullrequest.html_url" target="_blank">{{ pullrequest.title }}</a>
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>
    <v-card-subtitle class="pr-data mb-3 px-4">
        <v-row align="center">
            <v-col cols="12" sm="6">
                <v-chip label size="small" variant="tonal" color="primary" class="mr-1">
                  <span v-if="pullrequest.autodeploy">Autodeploy | </span>{{ pullrequest.branch }}
                </v-chip>
            </v-col>
            <v-col cols="12" sm="6" class="text-caption text-medium-emphasis">
                <div><v-icon size="small" color="primary">mdi-source-commit-start</v-icon> {{ formatDate(pullrequest.created_at) }}</div>
                <div><v-icon size="small" color="primary">mdi-source-pull</v-icon> {{ formatDate(pullrequest.updated_at)}}</div>
            </v-col>
        </v-row>
    </v-card-subtitle>
    <v-divider></v-divider>
    
    <v-card-actions class="px-3 py-1">
        <v-btn
            title="Start Review App"
            @click="startReviewApp()"
            color="primary"
            variant="text"
            size="small"
            v-if="!pullrequest.locked"
        >
            <v-icon start>mdi-play-box-outline</v-icon>
            Lanzar Review App
        </v-btn>
        <v-btn
            title="Review App Bloqueada"
            color="secondary"
            variant="text"
            size="small"
            disabled
            v-if="pullrequest.locked"
        >
            <v-icon start>mdi-play-box-lock-outline</v-icon>
            Bloqueado
        </v-btn>
    </v-card-actions>
</v-card>
</template>


<script lang="ts">
 import axios from "axios";

 import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        pipeline: {
            type: String,
            default: "MISSSING"
        },
        pullrequest: {
            type: Object,
            default: () => ({}),
        }
    },
    data: () => ({
        deleted: false,
        loadingState: false,
    }),
    methods: {
        async startReviewApp() {
            //console.log("startReviewApp", this.pullrequest.number);
            this.loadingState = true;

            axios.post("/api/apps/pullrequest", {
                branch: this.pullrequest.branch,
                title: this.pullrequest.title,
                ssh_url: this.pullrequest.ssh_url,
                pipelineName: this.pipeline,
            }).then((response) => {
                //console.log("startReviewApp", response);
            }).catch((error) => {
                console.log("startReviewApp", error);
            });
        },
        formatDate(date: string) {
            return new Date(date).toLocaleString();
        }
    },
})
</script>

<style>
.pr-data {
    font-size: 0.775rem;
    color: #747474;
    padding-top: 0px;
}
.v-btn.v-size--default {
    font-size: 0.675rem;
}

.mr-1.v-chip.v-size--default {
    font-size: 12px;
    height: 28px;
}

.v-application .text-subtitle-1 {
    font-size: 0.825rem !important;
}

.v-application .v-card__title {
    font-size: 1.1rem;
}

.pullrequest {
    outline: dashed 1.3px #747474;
}
</style>