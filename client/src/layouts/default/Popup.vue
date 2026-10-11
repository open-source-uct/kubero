<template>
  <v-app>
    <default-view />
  </v-app>
</template>

<script lang="ts" setup>
  import { useTheme } from 'vuetify'
  import DefaultView from './View.vue'

  // la ventana emergente no pasa por la barra lateral, así que aplica el tema guardado aquí
  const theme = useTheme()
  theme.global.name.value = localStorage.getItem('theme') || 'light'
</script>

<script lang="ts">

import { useKuberoStore } from '../../stores/kubero'
import { useCookies } from "vue3-cookies";
import { useSocketIO } from '../../socket.io';

const { cookies } = useCookies();
const token = cookies.get("kubero.JWT_TOKEN");
//console.log("COOKIE token", token);
const { socket } = useSocketIO(token);

// Write socket to pinia
const kuberoStore = useKuberoStore();
kuberoStore.kubero.socket = socket;

</script>