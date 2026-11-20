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
        <div class="breadcrumTitle">{{ itemLabel(item) }}</div><div class="breadcrumText">{{ itemText(item) }}</div>
      </v-breadcrumbs-item>
      </template>
  </v-breadcrumbs>
</template>


<script lang="ts">
import { defineComponent } from 'vue'

// Cada miga trae su etiqueta como clave de traducción (label) y su valor ya
// listo (text) o como clave (textKey, p. ej. el nombre de la fase). Se mantiene
// el formato antiguo "Etiqueta.valor" en title para lo que todavía lo use.
export default defineComponent({
    props: {
      items: {
        type: Array<any>, // can't extract type from v-breadcrumbs-item
        default: () => ([]),
      },
    },
    methods: {
      itemLabel(item: any): string {
        return item.label ? this.$t(item.label) : String(item.title ?? '').split('.')[0]
      },
      itemText(item: any): string {
        if (item.textKey) return this.$t(item.textKey)
        return item.text ?? String(item.title ?? '').split('.')[1] ?? ''
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