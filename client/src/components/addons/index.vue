<template>
    <v-container>

        <v-row class="justify-space-between">
            <v-col cols="6" sm="6" md="6" lg="6" xl="6">
                <!--<h1>Add-ons</h1>-->
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="4"
            v-for="addon in addons" :key="addon.kind"
            class="d-flex flex-column">
                <v-card
                    :disabled="!addon.enabled"
                    style="padding-bottom: 40px;"
                    color="cardBackground"
                    class="uct-card flex-grow-1 d-flex flex-column">
                    <v-list-item class="justify-center">
                        <div  class="d-flex justify-center" style="margin-top: 20px;">
                            <v-avatar
                                size="100"
                                rounded="0"
                                class="pa-3"
                                :image="addon.icon"
                                >
                            </v-avatar>
                            <v-badge
                                v-if="addon.beta"
                                color="blue"
                                content="beta"
                                >
                            </v-badge>
                            <v-badge
                                v-if="addon.deprecated"
                                color="red"
                                :content="$t('addonsCatalog.deprecated')"
                                >
                            </v-badge>
                        </div>
                        <v-card-title>
                            <a :href="addon.url" target="_blank">{{ addon.displayName }}</a>
                        </v-card-title>
                        <!--
                        <v-card-subtitle>
                            <span v-if="addon.enabled">{{ addon.version.installed }}</span>
                            <span v-if="!addon.enabled">{{ addon.version.latest }}</span>
                        </v-card-subtitle>
                        -->
                        <v-card-text style="min-height: 120px;">
                            {{ addon.description }}
                            <!--Operator: <a :href="addon.url">{{ addon.id }}</a>-->
                        </v-card-text>
                    </v-list-item>
                </v-card>
                <div class="text-center" style="height:0px" v-if="!addon.enabled">
                <v-btn
                    style="top: -50px;"
                    color="primary"
                    dark
                    elevation="0"
                    @click="openInstallDialog(addon)"
                    >
                    {{ $t('addonsCatalog.installation') }}
                </v-btn>
                </div>
            </v-col>
        </v-row>
        <v-dialog
            v-model="dialog"
            max-width="890"
            >
            <v-card color="cardBackground" class="uct-card">
                <v-card-item>
                    <v-card-title class="text-h6 font-weight-bold">
                        {{clickedAddon.displayName}} ({{clickedAddon.kind}})
                    </v-card-title>
                    <v-card-text>
                        <v-container>
                        {{clickedAddon.description}}
                        <br/>
                        <h3 class="mt-3">{{ $t('addonsCatalog.maintainers') }}</h3>
                        <ul>
                            <li v-for="maintainer in clickedAddon.maintainers" :key="maintainer.name">{{ maintainer.name }} <a :href="maintainer.url">{{ maintainer.url }}</a></li>
                        </ul>
                        <br/>
                        <h3 class="mt-3">{{ $t('addonsCatalog.links') }}</h3>
                        <ul>
                            <li v-for="link in clickedAddon.links" :key="link.url"><a :href="link.url">{{ link.name }}</a></li>
                        </ul>
                        </v-container>
                    </v-card-text>
                    <v-card-text>
                        <pre class="addon-install">{{clickedAddon.install}}</pre>
                        <v-btn
                            color="primary"
                            @click="copyInstall(clickedAddon.install)"
                            >
                            {{ $t('global.copy') }}
                            <v-icon
                                right
                                color="white"
                            >
                                mdi-content-copy
                            </v-icon>
                        </v-btn>

                    </v-card-text>
                </v-card-item>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                        variant="text"
                        @click="dialog = false"
                    >
                        {{ $t('global.close') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </v-container>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'

type Addon = {
    displayName: string,
    description: string,
    install: string,
    kind: string,
    links: {
        name: string,
        url: string,
    }[],
    maintainers: {
        name: string,
        url: string,
    }[],
    url: string,
    icon: string,
    deprecated: boolean,
    beta: boolean,
    enabled: boolean,
}

export default defineComponent({
    sockets: {
    },
    mounted() {
        this.loadAddonsList();
    },
    data: () => ({
        addons: [] as Addon[],
        dialog: false,
        clickedAddon: {} as Addon,
    }),
    components: {
    },
    methods: {
        async copyInstall(install: string) {
            try {
                await navigator.clipboard.writeText(install);
            } catch($e) {
                console.log('Cannot copy');
            }
            this.dialog = false;
        },
        openInstallDialog(addon: any) {
            this.clickedAddon = addon;
            this.dialog = true;
        },
        loadAddonsList() {
            const self = this;
            axios.get(`/api/addons`)
            .then(response => {
                self.addons = response.data;
            })
            .catch(error => {
                console.log(error);
            });
        },
    },
})
</script>

<style lang="scss" scoped>
/* instrucciones de instalación: mismo bloque de terminal que registros y consola,
   legible en los dos temas (antes era gris claro fijo con el borde naranjo de Kubero) */
.addon-install {
    display: block;
    max-width: 100%;
    margin: 0 0 16px;
    padding: 14px 18px;
    overflow: auto;
    border: 1px solid var(--uct-corp-gray-border);
    border-radius: 8px;
    background: var(--uct-corp-dark-nav);
    color: #E2E8F0;
    font-family: var(--uct-font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>