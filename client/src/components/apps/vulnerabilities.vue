<template>
    <v-container>
        <v-row class="justify-space-between mb-2">
            <v-col cols="10" sm="10" md="10" lg="10" xl="10">
                <!--<h1>Vulnerabilities in {{ app }}</h1>-->
            </v-col>
            <v-col>
                <v-btn
                    block
                    @click="startVulnScan()"
                    color="secondary"
                    :disabled="scanning || !authStore.hasPermission('security:write')"
                    >
                    <v-icon v-if="scanning == false">mdi-refresh</v-icon>

                    <v-progress-circular
                        v-if="scanning == true"
                        indeterminate
                        size="18"
                        width="2"
                        color="primary"
                        class="mr-1"
                    ></v-progress-circular>
                    <span>{{ $t('app.vulnerabilities.actions.rescan') }}</span>
                </v-btn>
            </v-col>
        </v-row>
        <v-alert
            v-if="scanMessage"
            type="warning"
            variant="tonal"
            closable
            density="compact"
            class="mb-4"
            @click:close="scanMessage = ''"
        >{{ scanMessage }}</v-alert>
        <v-layout class="flex-column">

                <v-row v-if="renderVulnerabilities">
                    <v-col cols="6" sm="6" md="6" lg="9" xl="9" v-if="renderVulnerabilities" >
                        <v-card elevation="1" color="cardBackground" class="uct-card">
                            <v-card-title>
                                <h3 class="headline mb-0">Metadata</h3>
                            </v-card-title>
                            <v-card-text>
                                <v-table density="compact" style="background:rgb(var(--v-theme-cardBackground))">
                                    <tbody>
                                        <tr>
                                            <th>{{ $t('app.vulnerabilities.lastScan') }}</th>
                                            <td>{{ vulnScanResult?.logPod?.startTime }}</td>
                                        </tr>
                                        <tr>
                                            <th>Artefact</th>
                                            <td>
                                                <span
                                                    v-if="vulnScanResult?.logs?.ArtifactType == 'repository'"
                                                    class="mx-0"
                                                >
                                                    <v-icon left small>mdi-git</v-icon>
                                                </span>
                                                <span
                                                    v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'"
                                                    class="mx-0"
                                                >
                                                    <v-icon left small>mdi-docker</v-icon>
                                                </span>
                                                {{ vulnScanResult?.logs?.ArtifactName }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.arch') }}</th>
                                            <td>{{ vulnScanResult?.logs?.Metadata?.ImageConfig?.architecture }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.created') }}</th>
                                            <td>{{ vulnScanResult?.logs?.Metadata?.ImageConfig?.created }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.os') }}</th>
                                            <td>{{ vulnScanResult?.logs?.Metadata?.OS?.Family }} {{ vulnScanResult?.logs?.Metadata?.OS?.Name }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.layers') }}</th>
                                            <td>{{ vulnScanResult?.logs?.Metadata?.ImageConfig?.rootfs?.diff_ids?.length }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.workingDir') }}</th>
                                            <td>{{ vulnScanResult?.logs?.Metadata?.ImageConfig?.config?.WorkingDir }}</td>
                                        </tr>
                                        <tr v-if="vulnScanResult?.logs?.ArtifactType == 'container_image'">
                                            <th>{{ $t('app.vulnerabilities.exposedPorts') }}</th>
                                            <td>
                                                <v-chip
                                                    v-for="(item, key) in vulnScanResult?.logs?.Metadata?.ImageConfig?.config?.ExposedPorts" :key="key"
                                                    small
                                                    label
                                                    class="ma-1"
                                                    color="green"
                                                    text-color="white"
                                                    >
                                                    {{ key }}
                                                </v-chip>
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </v-card-text>
                        </v-card>
                    </v-col>
                    <v-col cols="6" sm="6" md="6" lg="3" xl="3" v-if="renderVulnerabilities" >
                        <v-card elevation="2" outlined color="cardBackground">
                            <v-card-title>
                                <h3 class="headline mb-0">{{ $t('app.vulnerabilities.summary') }}</h3>
                            </v-card-title>
                            <v-card-text>

                                <Doughnut
                                    :data="vulnerabilitiesDoughnut"
                                ></Doughnut>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" sm="12" md="12" lg="12" xl="12" v-if="renderVulnerabilities" >
                        <span v-for="target in vulnScanResult?.logs?.Results" :key="target.Target">
                            <v-card class="mb-6" v-if="target.Class != 'secret'" elevation="2" outlined color="cardBackground">
                                <v-card-title>
                                    <h3 class="headline mb-0">{{ target.Target }}</h3>
                                </v-card-title>
                                <v-card-text>
                                    <!--
                                        TODO : I was not able to get the expandable table to work
                                        :expanded.sync="vulnExpanded"
                                        show-expand
                                        single-expand
                                        item-key="VulnerabilityID"
                                    -->
                                    <v-data-table
                                        :headers="vulnHeaders"
                                        :items="target.Vulnerabilities"
                                        :items-per-page=5
                                        :footer-props="{
                                            'items-per-page-options': [5, 10, 25, { text: 'ALL', value: -1 }]
                                        }"
                                        style="background:rgb(var(--v-theme-cardBackground))">
                                        <!-- eslint-disable-next-line vue/valid-v-slot -->
                                        <template v-slot:item.VulnerabilityID="{ item }">
                                            <a :href="item.PrimaryURL" target="_blank"><span style="white-space: nowrap;">{{ item.VulnerabilityID }}</span></a>
                                        </template>

                                        <!-- eslint-disable-next-line vue/valid-v-slot -->
                                        <template v-slot:item.CVSS="{ item }">
                                            <v-chip
                                            label
                                            :class="'severity-' + item.Severity.toLowerCase()"
                                            >
                                            {{ getMaxCVSS(item.CVSS) }}
                                            </v-chip>
                                        </template>

                                        <template v-slot:expanded-row="{ columns, item }">
                                            <td :colspan="columns.length">
                                                <div class="row sp-details">
                                                    {{ item }}
                                                </div>
                                            </td>
                                        </template>

                                    </v-data-table>
                                </v-card-text>
                            </v-card>
                        </span>
                    </v-col>
                </v-row>

                <v-row
                    v-if="!renderVulnerabilities">
                    <v-col
                    cols="12"
                    md="6"
                    style="margin-top: 20px;"
                    >
                        <v-alert
                            outlined
                            type="info"
                            variant="tonal"
                            border="start"
                        >
                            <h3>{{ $t('app.vulnerabilities.empty.title', {app: app}) }}</h3>
                            {{ $t('app.vulnerabilities.empty.message') }}

                        </v-alert>
                    </v-col>
                </v-row>
        </v-layout>

    </v-container>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'

import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS,  Tooltip, Legend, ArcElement } from 'chart.js'

import { useAuthStore } from '../../stores/auth'
const authStore = useAuthStore();

ChartJS.register( Tooltip, Legend, ArcElement)

type ScanResult = {
    scanned: boolean;
    logs: {
        ArtifactID: string;
        ArtifactType: string;
        ArtifactName: string;
        Metadata: any;
        Results: Target[];
        Summary: any;
    };
    logsummary: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        unknown: number;
    };
    status: string;
    logPod: {
        startTime: string;
        endTime: string;
        podName: string;
        podStatus: string;
        podPhase: string;
        podMessage: string;
    };
}

type Target = {
    Target: string;
    Class: string;
    Vulnerabilities: Vulnerability[];
}

type Vulnerability = {
    VulnerabilityID: string;
    PkgName: string;
    Title: string;
    Severity: string;
    PrimaryURL: string;
    CVSS: any;
    Metadata: any;
}


type severityColors = {
    critical: string;
    high: string;
    medium: string;
    low: string;
    unknown: string;
}

export default defineComponent({
    sockets: {
    },
    setup() {
        return {
            authStore,
        }
    },
    mounted() {
        this.loadVulnerabilities();
    },
    beforeUnmount() {
        // sin esto el polling seguía pidiendo el resultado cada 2 s aunque se
        // saliera de la pestaña
        this.stopPolling();
    },
    data: () => ({
        scanning: false,
        // momento en que se pidió el reescaneo (ms) y último aviso al usuario
        scanStartedAt: null as number | null,
        scanMessage: '',
        vulnScanResult: {} as ScanResult,
        renderVulnerabilities: false,
        vulnExpanded: [],
        vulnHeaders: [
            { text: 'CVE', value: 'VulnerabilityID', filterable: false,},
            { text: 'PGK', value: 'PkgName' },
            { text: 'Title', value: 'Title' },
            //{ text: 'Score', value: 'Severity' },
            { text: 'CVSS', value: 'CVSS', sortable: false, filterable: false,},
        ],
        interval: null as any, //TODO: should be type 'Timer',
        vulnerabilitiesDoughnut: {
            labels: [
                'Critical',
                'High',
                'Medium',
                'Low',
                'Unknown'
            ],
            datasets: [{
                /*label: 'Vulnerabilities',*/
                data: [] as number[],
                backgroundColor: [
                '#ff8080',
                '#ff946d',
                '#ffd07a',
                '#fdfda0',
                'lightgrey',
                ],
                hoverOffset: 4
            }]
        }
    }),
    components: {
        Doughnut
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
        default: "MISSING"
      }
    },
    methods: {
      stopPolling() {
        if (this.interval != null) {
            clearInterval(this.interval);
            this.interval = null;
        }
      },
      startPolling() {
        // uno solo: antes cada escaneo nuevo apilaba otro intervalo
        this.stopPolling();
        this.interval = setInterval(this.loadVulnerabilities, 2000);
      },
      // Un reescaneo tarda: hay que crear el job, arrancar el pod de trivy, bajar su
      // base de datos y la imagen. Mientras tanto el server puede contestar "no hay
      // pod todavía" o devolver el resultado del escaneo anterior. Antes se dejaba
      // de sondear en cuanto llegaba algo distinto de "running": el botón se
      // volvía a habilitar, el segundo clic reiniciaba el escaneo desde cero y
      // parecía que nunca terminaba.
      finishScan(message: string = '') {
        this.scanning = false;
        this.scanStartedAt = null;
        this.scanMessage = message;
        this.stopPolling();
      },
      async loadVulnerabilities() {
        const waiting = this.scanStartedAt != null;
        const elapsed = waiting ? Date.now() - (this.scanStartedAt as number) : 0;

        axios.get(`/api/security/${this.pipeline}/${this.phase}/${this.app}/scan/result`, {
            params : {
                logdetails : true,
            }
        } )
        .then(response => {
            const result = response.data;
            this.vulnScanResult = result;

            if (result.status == "running") {
                this.scanning = true;
                this.renderVulnerabilities = false;
                if (this.interval == null) {
                    this.startPolling();
                }
                return;
            }

            if (waiting) {
                // el resultado es de un pod anterior al clic: sigue esperando
                const podStart = result.logPod?.startTime ? new Date(result.logPod.startTime).getTime() : 0;
                const stale = result.status == "ok" && podStart < (this.scanStartedAt as number) - 30000;
                // el pod del escaneo nuevo todavía no existe
                const notCreatedYet = result.status == "error" && elapsed < 120000;
                if ((stale || notCreatedYet) && elapsed < 15 * 60 * 1000) {
                    this.scanning = true;
                    this.renderVulnerabilities = false;
                    return;
                }
                if (elapsed >= 15 * 60 * 1000) {
                    this.finishScan(this.$t('app.vulnerabilities.scanTimeout') as string);
                    return;
                }
            }

            if (result.status == "failed") {
                this.renderVulnerabilities = false;
                this.finishScan(this.$t('app.vulnerabilities.scanFailed') as string);
                return;
            }

            // solo se dibuja el resultado si trae lo que la plantilla necesita
            if (result.status == "ok" && result.logs && result.logsummary) {
                this.renderVulnerabilities = true;

                this.vulnerabilitiesDoughnut.datasets[0].data = [
                    result.logsummary.critical,
                    result.logsummary.high,
                    result.logsummary.medium,
                    result.logsummary.low,
                    result.logsummary.unknown,
                ];
            }

            this.finishScan();
        })
        .catch(error => {
            console.log(error);
            // un fallo de red o un 5xx puntual no debe cortar la espera de un
            // escaneo en curso; sí se corta si ya pasó demasiado tiempo
            if (!waiting || elapsed >= 15 * 60 * 1000) {
                this.finishScan();
            }
        });

      },
      startVulnScan() {
        this.renderVulnerabilities = false;
        this.scanMessage = '';
        this.scanStartedAt = Date.now();
        axios.get(`/api/security/${this.pipeline}/${this.phase}/${this.app}/scan`)
        .then(() => {
            this.scanning = true;
            this.startPolling();

        })
        .catch(error => {
            console.log(error);
            this.finishScan(this.$t('app.vulnerabilities.scanFailed') as string);
        });
      },
      /*
      getCVSS(cvss) {
        let ret = "N/A";
        if (cvss == null) {
            return ret;
        }

        // first try to fill the value with  the first occurence of V2 score
        forEach(cvss, value => {
            if (value["V2Score"]) {
                ret = value["V2Score"];
                return false;
            }
            return true;
        });

        // override with V3 score of the first occurence
        forEach(cvss, value => {
            if (value["V3Score"]) {
                ret = value["V3Score"];
                return false;
            }
            return true;
        });

        return ret;
      },
      */
      getMaxCVSS(cvss: any) {
        let ret = 0;

        if (cvss != null) {
            const scores = Object.values(cvss).map((value: any) => value.V3Score || value.V2Score).filter(Boolean);
            if (scores.length > 0) {
                ret = Math.max(...scores);
            }
        }

        return ret;
      },
    },
});
</script>

<style lang="scss" scoped>
.v-card {
    margin-left: 1px;
    margin-right: 2px;
}
.v-table__wrapper {
    background-color: #000;
}
.v-btn--disabled {
    color: rgba(var(--v-theme-on-surface),.26) !important;
}

</style>