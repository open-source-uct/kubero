<template>
  <v-breadcrumbs :items="items">
      <template v-slot:divider>
        <v-icon icon="mdi-chevron-right" size="x-large"></v-icon>
      </template>
      <template v-slot:item="{ item}">
      <v-breadcrumbs-item
          :href="item.href"
          :to="item.to"
          :disabled="item.disabled"
      >
        <div class="breadcrumTitle">{{ item.title.split('.')[0] }}</div><div class="breadcrumText">{{ item.title.split('.')[1] }}</div>
      </v-breadcrumbs-item>
      </template>
  </v-breadcrumbs>
</template>


<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
      items: {
        type: Array<any>, // can't extract type from v-breadcrumbs-item
        default: () => ([]),
      },
    },
})
</script>

<style scoped>
  .v-breadcrumbs {
    padding-left: 0;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    /* en una sola fila, con nombres largos, se salían de la pantalla del
       celular y toda la página quedaba con scroll hacia el lado */
    flex-wrap: wrap;
    row-gap: 6px;
    min-width: 0;
  }
  .v-breadcrumbs :deep(.v-breadcrumbs-item) {
    min-width: 0;
  }
  .breadcrumText {
    overflow-wrap: anywhere;
  }
  @media (max-width: 599px) {
    .v-breadcrumbs :deep(.v-breadcrumbs-divider) {
      padding-inline: 4px;
    }
    .breadcrumText {
      font-size: 1rem;
    }
  }
  .breadcrumTitle {
    text-transform: uppercase;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: rgb(var(--v-theme-primary));
    line-height: 1;
    margin-bottom: 2px;
  }
  .breadcrumText {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .v-breadcrumbs-item--link {
    text-decoration: none !important;
  }
</style>