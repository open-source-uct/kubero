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
import { useSocketIO } from '../../socket.io';

const { socket } = useSocketIO();

// Write socket to pinia
const kuberoStore = useKuberoStore();
kuberoStore.kubero.socket = socket;

</script>