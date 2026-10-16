<template>
    <v-container>
        <v-row>
            <v-col cols="12" sm="12" md="12" style="height: calc(100vh - 400px);">
                <Logs :pipeline=pipeline :phase=phase :app=app :deploymentstrategy=deploymentstrategy :buildstrategy=buildstrategy :hasAddons=hasAddons :addons=addons logType="runlogs" height="600px"/>
            </v-col>
        </v-row>

    </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Logs from './logs.vue'

export default defineComponent({
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
        default: "new"
      },
      deploymentstrategy: {
        type: String,
        default: "docker"
      },
      buildstrategy: {
        type: String,
        default: "dockerfile"
      },
      hasAddons: {
        type: Boolean,
        default: false
      },
      addons: {
        type: Array,
        default: () => []
      },
    },
    data: () => ({
    }),
    components: {
        Logs,
    },
});
</script>

<style lang="scss">

a:link { text-decoration: none;}
.v-icon.v-icon {
    vertical-align:inherit;
}
</style>
