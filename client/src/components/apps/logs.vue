<template>
    <div class="logs-container">
        <v-tabs class="console-bar" style="position: relative;">
            <v-tab v-if="logType == 'runlogs'" @click="getLogHistory('web')">run</v-tab>
            <v-tab v-if="logType == 'runlogs' && hasAddons" @click="getLogHistory('addons')">addons</v-tab>
            <v-tab v-if="logType == 'runlogs' && deploymentstrategy == 'git' && buildstrategy=='plain'" @click="getLogHistory('builder')">build</v-tab>
            <v-tab v-if="logType == 'runlogs' && deploymentstrategy == 'git' && buildstrategy=='plain'" @click="getLogHistory('fetcher')">fetch</v-tab>
            <v-tab v-if="logType == 'buildlogs'" @click="getBuildLogHistory('fetch')">fetch</v-tab>
            <v-tab v-if="logType == 'buildlogs' && (buildstrategy=='nixpacks' || buildstrategy=='buildpacks')" @click="getBuildLogHistory('build')">build</v-tab>
            <v-tab v-if="logType == 'buildlogs' && (buildstrategy=='nixpacks' || buildstrategy=='dockerfile')" @click="getBuildLogHistory('push')">push</v-tab>
            <v-tab v-if="logType == 'buildlogs'" @click="getBuildLogHistory('deploy')">deploy</v-tab>
        </v-tabs>
        <div class="console-toolbar">
            <v-select
                v-if="currentTab == 'addons' && addonInstances.length > 0"
                v-model="selectedAddon"
                :items="addonItems()"
                :aria-label="$t('app.actions.addonFilter')"
                prepend-inner-icon="mdi-filter-variant"
                density="compact"
                variant="outlined"
                hide-details
                theme="dark"
                bg-color="#16202D"
                class="addon-select"
            ></v-select>
            <v-spacer></v-spacer>
            <v-btn
                size="small"
                variant="text"
                :aria-label="$t('global.copy')"
                :title="$t('global.copy')"
                @click="copyLogs"
            >
                <v-icon left>{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
                {{ $t('global.copy') }}
            </v-btn>
        </div>
        <div class="console" id="console" ref="consoleEl" @scroll="onConsoleScroll">
            <div v-for="line in displayLines" :key="line.id">
            {{ new Date(line.time).toLocaleDateString() }} {{ new Date(line.time).toLocaleTimeString()}} <span :style="'color:' +line.color">[{{ lineLabel(line) }}]</span>
            <span class="log-text">{{ cleanLog(line) }}</span>
            </div>
            <span style="margin: 25px;"></span>
        </div>
    </div>
</template>


<script lang="ts">
import axios from "axios";
import { ref, reactive, defineComponent, computed, watch, nextTick } from 'vue'
import { useKuberoStore } from '../../stores/kubero'

type LogLine = {
    app: string;
    container: string;
    id: string;
    log: string;
    phase: string;
    pipeline: string;
    pod: string;
    podID: string;
    time: number;
    color: string;
}

type AddonInstance = {
    name: string;
    displayName: string;
}

const socket = useKuberoStore().kubero.socket as any;
const loglines = ref([] as LogLine[]);
// pestaña activa: las líneas en vivo son de los pods de la app, solo van en "web"
const currentTab = ref('web');

socket.on('log', (data: LogLine) => {
    //console.log("log", data);
    if (currentTab.value == 'web') {
        loglines.value.unshift(data)
    }
});


export default defineComponent({
    setup(props) {
        // addon seleccionado en la pestaña addons ("all" = todos)
        const selectedAddon = ref('all');
        // la popup no recibe la lista de addons, así que se carga desde la app
        const loadedAddons = ref([] as any[]);

        // nombre de la instancia (prefijo de sus pods) y nombre a mostrar
        const addonInstances = computed((): AddonInstance[] => {
            const addons = props.addons.length > 0 ? props.addons : loadedAddons.value;
            return addons.map((addon: any) => {
                const crd = addon.resourceDefinitions?.[addon.kind]
                    ?? Object.values(addon.resourceDefinitions || {}).find((r: any) => r?.kind !== 'Secret');
                return {
                    name: crd?.metadata?.name as string,
                    displayName: (addon.displayName || addon.kind) as string,
                };
            }).filter((addon: AddonInstance) => !!addon.name);
        });

        // el addon con el prefijo más largo gana (evita que "app-pg" se confunda con "app-pg-2")
        const addonForPod = (podName: string): AddonInstance | undefined => {
            let match: AddonInstance | undefined;
            for (const addon of addonInstances.value) {
                if (podName.startsWith(addon.name + '-') && (!match || addon.name.length > match.name.length)) {
                    match = addon;
                }
            }
            return match;
        };

        const visibleLines = computed((): LogLine[] => {
            if (currentTab.value != 'addons' || selectedAddon.value == 'all') {
                return loglines.value;
            }
            return loglines.value.filter((line) => addonForPod(line.pod)?.name == selectedAddon.value);
        });

        // true durante 1.5 s después de copiar, para cambiar el icono
        const copied = ref(false);

        // la lista llega con lo más nuevo primero; se muestra al revés (lo nuevo abajo)
        const displayLines = computed((): LogLine[] => [...visibleLines.value].reverse());

        // si la persona está leyendo más arriba, no la movemos con cada línea nueva
        const consoleEl = ref<HTMLElement | null>(null);
        const stickToBottom = ref(true);
        const onConsoleScroll = () => {
            const el = consoleEl.value;
            if (el) {
                stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }
        };
        watch(displayLines, async () => {
            await nextTick();
            const el = consoleEl.value;
            if (el && stickToBottom.value) {
                el.scrollTop = el.scrollHeight;
            }
        });

        return {
            loglines,
            currentTab,
            socket,
            copied,
            displayLines,
            consoleEl,
            onConsoleScroll,
            selectedAddon,
            loadedAddons,
            addonInstances,
            addonForPod,
            visibleLines,
        }
    },
    mounted() {
        if (this.logType == 'buildlogs')  {
            this.getBuildLogHistory('fetch')
            //this.socketJoin()
            //this.startLogs()
        } else {
            if (this.logType == 'runlogs' && this.hasAddons && this.addons.length == 0) {
                axios.get(`/api/apps/${this.pipeline}/${this.phase}/${this.app}`).then((response) => {
                    this.loadedAddons = response.data.spec.addons || [];
                });
            }
            this.getLogHistory('web')
            this.socketJoin()
            this.startLogs()
            socket.on('connect', this.onSocketConnect)
        }
    },
    unmounted() {
        socket.off('connect', this.onSocketConnect)
        this.socketLeave()
        this.loglines = []
    },
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
      logType: {
        type: String,
        default: "runlogs"
      },
      buildID: {
        type: String,
        default: "MISSING"
      },
      height: {
        type: String,
        default: "100%"
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
        loglines: [
            /* example
            {
                app: "bla"
                container: "kuberoapp-web"
                id: "049464b6-3f35-4b72-a885-6c263e64aec7"
                log: "logtest: nana\n"
                phase: "production"
                pipeline: "hoho"
                pod: "bla-kuberoapp-web-6dfd5c4c9b-mxg9v"
                podID: "6dfd5c4c9b-mxg9v"
                time: 1656970421989
            },
            */
        ] as LogLine[],
    }),
    methods: {
        // quita los códigos de color ANSI (los de tracing/Rust) y el salto de línea final,
        // para que no aparezcan como texto ni dejen líneas vacías
        cleanLog(line: LogLine) {
            // eslint-disable-next-line no-control-regex
            return line.log.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\n+$/, '');
        },
        async copyLogs() {
            // displayLines ya va de lo más viejo a lo más nuevo
            const text = this.displayLines.map((line: LogLine) =>
                `${new Date(line.time).toLocaleString()} [${this.lineLabel(line)}] ${this.cleanLog(line)}`
            ).join('\n');
            try {
                await navigator.clipboard.writeText(text);
                this.copied = true;
                setTimeout(() => { this.copied = false; }, 1500);
            } catch (e) {
                console.log('Cannot copy');
            }
        },
        addonItems() {
            return [
                { title: this.$t('app.actions.allAddons'), value: 'all' },
                ...this.addonInstances.map((addon: AddonInstance) => ({ title: addon.displayName, value: addon.name })),
            ];
        },
        lineLabel(line: LogLine) {
            const addon = this.addonForPod(line.pod);
            if (addon) {
                return `${addon.displayName}/${line.container}`;
            }
            if (this.currentTab == 'addons') {
                return `${line.pod.replace(this.app + '-', '')}/${line.container}`;
            }
            return `${line.podID}/${line.container.replace('kuberoapp-', '')}`;
        },
        socketJoin() {
            console.log("socketJoin", `${this.pipeline}-${this.phase}-${this.app}`);
            socket.emit("join", {
                room: `${this.pipeline}-${this.phase}-${this.app}`,
            });
        },
        socketLeave() {
            console.log("socketLeave", `${this.pipeline}-${this.phase}-${this.app}`);
            socket.emit("leave", {
                room: `${this.pipeline}-${this.phase}-${this.app}`,
            });
        },
        onSocketConnect() {
            // al reconectar, el socket nuevo no está en la sala: hay que volver a entrar
            this.socketJoin();
            this.startLogs();
            this.getLogHistory(this.currentTab);
        },
        startLogs() {
            axios.get(`/api/logs/${this.pipeline}/${this.phase}/${this.app}`).then(() => {
                console.log("logs started");
            });
        },
        getLogHistory(container: string) {
            this.currentTab = container;
            axios.get(`/api/logs/${this.pipeline}/${this.phase}/${this.app}/${container}/history`).then((response) => {
                this.loglines = response.data;
            });
        },
        getBuildLogHistory(container: string) {
            //http://localhost:2000/api/deployments/devcon/production/aaa/20240717-0651/log
            axios.get(`/api/deployments/${this.pipeline}/${this.phase}/${this.app}/${this.buildID}/${container}/history`).then((response) => {
                if (response.data.length > 0) {
                    this.loglines = response.data;
                } else {
                    this.loglines = [{
                        app: "container",
                        container: "debug",
                        id: "00000000-0000-0000-0000-000000000000",
                        log: "No logs available",
                        phase: "",
                        pipeline: "",
                        pod: "",
                        podID: "error",
                        color: "#FF0000",
                        time: Date.now(),
                    }];
                }
            });
        },
    },
});
</script>

<style lang="scss">

a:link { text-decoration: none;}
.v-icon.v-icon {
    vertical-align:inherit;
}

.logs-container {
    /*height: calc(100vh - 400px);*/
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
}

.v-tabs.console-bar {
    color: #9F9F9F;
    background-color: #16202D;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    flex-shrink: 0;
}


.console-toolbar {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    background-color: #0B1119;
    border: 1px solid rgba(135, 135, 135, 0.2);
    border-bottom: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    color: #E2E8F0;
}

.console-toolbar .addon-select {
    max-width: 260px;
    margin-right: 8px;
}

.console {
    flex: 1;
    overflow-x: auto;
    overflow-y: auto;
    background-color: #0B1119;
    color: #E2E8F0;
    padding: 10px;
    font-family: "Fira Code", SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    border: 1px solid rgba(135, 135, 135, 0.2);
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    display: block;
    min-height: 0;
    user-select: text;
}

/* el texto del log se ajusta en vez de cortarse con scroll horizontal */
.console .log-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
</style>