<template>
    <v-container fluid class="app-overview">
        <v-row class="app-overview__grid">
            <v-col cols="12" class="app-overview__main">
                <Appstats :pipeline="pipeline" :phase="phase" :app="app" :appData="appData" :pipelineData="pipelineData"></Appstats>
            </v-col>
        </v-row>
    </v-container>
</template>

<script lang="ts">
import Appstats from './appstats.vue'

import { defineComponent } from 'vue'

export default defineComponent({
    props: {
      appData: {
        type: Object,
        default: () => {}
      },
      pipelineData : {
        type: Object,
        default: () => {}
      },
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
    },
    data: () => ({
    }),
    components: {
        Appstats,
    },
});
</script>

<style lang="scss" scoped>
.app-overview {
    padding: 0;
}

.app-overview__grid {
    margin: -8px;
}

.app-overview__main {
    padding: 8px;
}

</style>
