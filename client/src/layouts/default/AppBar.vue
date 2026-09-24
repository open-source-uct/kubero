<template>
  <v-app-bar
    density="compact"
    max-height="50"
    :color="banner.bgcolor || 'primary'"
    v-if="banner.show && popup != 'true'"
    elevation="0"
    class="border-b"
  >
      <v-toolbar-title
        :style="'width: 100%; text-align: center; font-weight: 600; font-size: 0.875rem; letter-spacing: 0.02em; color: ' + (banner.fontcolor || '#FFFFFF') + ';'"
      >
        {{ banner.message }}
      </v-toolbar-title>
  </v-app-bar>
</template>

<script lang="ts">
import axios from 'axios';
import { defineComponent } from 'vue'

export default defineComponent({
  name: "AppBar",

  data() {
    return {
      banner: {
        show: false,
        message: '',
        bgcolor: '',
        fontcolor: ''
      },
      popup: 'false'
    }
  },

  methods: {
    getBanner() {
      axios.get('/api/config/banner').then((response: any) => {
        this.banner.show = response.data.show;
        this.banner.message = response.data.message;
        this.banner.bgcolor = response.data.bgcolor;
        this.banner.fontcolor = response.data.fontcolor;
      })
    },

    getPopUp() {
        const p = localStorage.getItem('popup');
        if (p != null && p != undefined) {
            this.popup = p;
        }
    }
  },
  mounted() {
      this.getBanner();
      this.getPopUp();
  },
});
</script>
