// Plugins
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import ViteFonts from 'unplugin-fonts/vite'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      sass: {
        //silenceDeprecations: ["legacy-js-api"],
        api: 'modern-compiler', // or "modern", "legacy"
      },
      scss: {
        //silenceDeprecations: ["legacy-js-api"],
        api: 'modern-compiler', // or "modern", "legacy"
      },
    },
  },
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    ViteFonts({
      google: {
        families: [
          {
            name: 'Roboto',
            styles: 'wght@100;300;400;500;700;900',
          },
        ],
      },
      // Sin esto, el plugin precarga TODAS las fuentes del bundle (los 4
      // formatos del icono MDI, ~3,4 MB) aunque el navegador use solo una.
      custom: {
        families: [],
        preload: false,
      },
    }),
  ],
  define: { 
    'process.env': {},
    __VUE_PROD_DEVTOOLS__ : true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
    //dedupe: ['pinia'],
  },
  build: {
    outDir: '../server/dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
})
