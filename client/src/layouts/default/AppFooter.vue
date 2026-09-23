<template>
  <v-footer color="navBG" class="border-t py-2">
    <v-col
      cols="12"
      class="text-center text-caption text-medium-emphasis py-1"
    >
      <span class="font-weight-medium">Universidad Católica de Temuco</span> · Facultad de Ingeniería · Kubero PaaS v{{ kuberoversion }}
      <span v-if="kubeversion && kubeversion != 'unknown'"> | K8s API {{ kubeversion }}</span>
    </v-col>
  </v-footer>
</template>
<script lang="ts">
export default {

  props: [
    'kubeversion',
    'kuberoversion',
  ],
}
</script>