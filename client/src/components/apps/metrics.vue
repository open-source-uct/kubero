<template>
    <v-container>

      <div v-if="!kubero.metricsEnabled">
        <v-row>
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
                    <h3>No metrics available</h3>
                    <p>
                        Metrics are not available for this application. Metrics can be enabled in the Kubero CRD.
                    </p>
                </v-alert>
            </v-col>
        </v-row>
      </div>
      <div v-if="kubero.metricsEnabled">
        <v-row class="justify-space-between mb-2">
            <v-col cols="12" sm="12" md="8">
              <Alerts :app="app" :phase="phase" :pipeline="pipeline"/>
            </v-col>
            <v-col cols="12" sm="12" md="2">
              <v-select
                label="Select"
                v-model="scale"
                :items="[ '2h', '24h', '7d' ]"
                density="compact"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="12" md="2">
                <v-btn
                    block
                    @click="refreshMetrics()"
                    color="secondary"
                    >
                    <v-icon>mdi-refresh</v-icon>
                    <span>Refresh</span>  
                </v-btn>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                Memory Usage
                <VueApexCharts type="area" height="180" :options="memoryOptions" :series="memoryData"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
          <!--
            <v-col cols="6" sm="6" md="6">
                CPU usage
                <VueApexCharts type="line" height="180" :options="cpuOptions" :series="cpuData"></VueApexCharts>
            </v-col>
          -->
            <v-col cols="12" sm="12" md="12">
                CPU usage
                <VueApexCharts type="line" height="180" :options="cpuOptions" :series="cpuDataRate"></VueApexCharts>
            </v-col>
        </v-row>
        <!--
        <v-row>
            <v-col cols="12" sm="12" md="12">
                Pod Load
                <VueApexCharts type="line" height="180" :options="LoadOptions" :series="loadData"></VueApexCharts>
            </v-col>
        </v-row>
        -->
        <v-row>
            <v-col cols="12" sm="12" md="12">
                Responset Time
                <VueApexCharts type="area" height="180" :options="ResponsetimeOptions" :series="responsetimeData"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                Throughput
                <VueApexCharts type="line" height="180" :options="httpStusCodeOptions" :series="httpStusCodeData"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                <VueApexCharts type="area" height="180" :options="httpStusCodeIncreaseOptions" :series="httpStusCodeDataIncrease"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                <VueApexCharts type="area" height="180" :options="httpResponseTrafficOptions" :series="httpResponseTrafficData"></VueApexCharts>
            </v-col>
        </v-row>
      </div>
    </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import VueApexCharts from "vue3-apexcharts";
import { useKuberoStore } from '../../stores/kubero'
import { mapState } from 'pinia'

import axios from "axios";
import Alerts from './alerts.vue';

const colors = ['#0075B4', '#0090DC', '#EDC500', '#10B981', '#005888', '#878787']


export default defineComponent({
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
      host: {
        type: String,
        default: "a.a.localhost"
      },
      // false cuando la pestaña de métricas no está a la vista: el v-window
      // mantiene montado el componente y antes seguía consultando Prometheus
      // cada 4 s desde cualquier otra pestaña
      active: {
        type: Boolean,
        default: true
      },
    },
    data: () => ({
      memoryOptions: {
        fill: {
          opacity: 0.2,
          type: 'solid',
        },
        legend: {
            show: false,
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'memory',
          group: 'metrics',
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'MiB',
          },
        }
      },
      LoadOptions: {
        fill: {
          opacity: 0.5,
          type: 'solid',
        },
        legend: {
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'load',
          group: 'metrics',
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'load',
          },
        }
      },
      cpuOptions: {
        fill: {
          opacity: 0.5,
          type: 'solid',
        },
        legend: {
            show: false,
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'cpu',
          group: 'metrics',
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'millicores',
          },
        }
      },
      ResponsetimeOptions: {
        fill: {
          opacity: 0.2,
          type: 'solid',
        },
        legend: {
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'responsetime',
          group: 'metrics',
          stacked: false,
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'miliseconds',
          },
        }
      },
      httpStusCodeOptions: {
        fill: {
          opacity: 0.5,
          type: 'solid',
        },
        legend: {
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'httpStusCode',
          group: 'metrics',
          stacked: true,
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'Req/sec',
          },
        }
      },
      httpStusCodeIncreaseOptions: {
        fill: {
          opacity: 0.5,
          type: 'solid',
        },
        legend: {
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'httpStusCode',
          group: 'metrics',
          stacked: true,
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'Req',
          },
        }
      },
      httpResponseTrafficOptions: {
        fill: {
          opacity: 0.5,
          type: 'solid',
        },
        legend: {
            position: 'top',
        },
        colors: colors,
        chart: {
          id: 'httpTraffic',
          group: 'metrics',
          stacked: true,
          animations: {
            enabled: false,
          },
          toolbar: {
            show: false
          },
          zoom: {
            enabled: false,
          }
        },
        stroke: {
          curve: 'stepline',
          width: 1
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          type: 'datetime',
          position: 'bottom',
          tickAmount: 10,
          labels: {
            rotate: -45,
            show: true,
            trim: true,
            //offsetY: 17,
            
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM HH:mm',
              hour: 'HH:mm',
            },
          },
          tooltip: {
            enabled: false,
          }
        },
        tooltip: {
          x: {
            format: 'dd MMM HH:mm:ss'
          }
        },
        yaxis: {
          decimalsInFloat: 1,
          title: {
            text: 'KB',
          },
        }
      },
      cpuData: [] as {
            name: string,
            data: number[][],
      }[],
      cpuDataRate: [] as {
            name: string,
            data: number[][],
      }[],
      loadData: [] as {
            name: string,
            data: number[][],
      }[],
      memoryData: [] as {
            name: string,
            data: number[][],
      }[],
      responsetimeData: [] as {
            name: string,
            data: number[][],
      }[],
      httpStusCodeData: [] as {
            name: string,
            data: number[][],
      }[],
      httpStusCodeDataIncrease: [] as {
            name: string,
            data: number[][],
      }[],
      httpResponseTrafficData: [] as {
            name: string,
            data: number[][],
      }[],
      scale: '2h' as '2h'| '24h' | '7d',
      timer: null as any,
      // consultas de un ciclo de refresco que aún no terminaron
      pending: 0,
    }),
    components: {
        VueApexCharts,
        Alerts,
    },
    mounted() {
        this.refreshMetrics();
        this.startTimer();
    },
    unmounted() {
        this.stopTimer();
    },
    watch: {
        scale: function (val) {
          this.refreshMetrics();
          // el intervalo depende del rango: se reinicia con el nuevo
          this.startTimer();
        },
        active: function (val) {
          if (val) {
            this.refreshMetrics();
          }
        }
    },
    computed: {
      ...mapState(useKuberoStore, ['kubero']),
    },
    methods: {
        /*
        generateMetrics(limit: number) {
            // generate a set of random metrics
            let metrics = [];
            for (let i = 0; i < limit; i++) {
                metrics.push(Math.floor(Math.random() * 100));
            }
            return metrics;
        },
        */
        // Cada ciclo son 5 consultas de rango a Prometheus. Antes se repetían cada
        // 4 s con cualquier rango, sin esperar a que terminara la anterior: con
        // 24 h o 7 d tardan más de 4 s, las peticiones se apilaban y la
        // interfaz (y el server) se quedaban pegados. Ahora el intervalo crece
        // con el rango, no se lanza otro ciclo mientras hay uno en curso, y se
        // pausa con la pestaña oculta o en otra pestaña de la app.
        refreshIntervalMs(): number {
            return { '2h': 15000, '24h': 60000, '7d': 300000 }[this.scale];
        },
        startTimer() {
            this.stopTimer();
            this.timer = setInterval(() => {
                if (document.hidden || !this.active || this.pending > 0) {
                    return;
                }
                this.refreshMetrics();
            }, this.refreshIntervalMs());
        },
        stopTimer() {
            if (this.timer != null) {
                clearInterval(this.timer);
                this.timer = null;
            }
        },
        refreshMetrics() {
          if (this.kubero.metricsEnabled) {
            this.pending++;
            Promise.allSettled([
                this.getMemoryMetrics(),
                //this.getLoadMetrics(),
                //this.getCpuMetrics(),
                this.getCpuMetricsRate(),
                // la misma consulta alimenta las dos gráficas de códigos HTTP
                this.getHttpStatusCodeMetrics(),
                this.getResponseTimeMetrics(),
                this.getResponseTrafficMetrics(),
            ]).finally(() => {
                this.pending--;
            });
          }
        },
        getMemoryMetrics() {
            
            return axios.get(`/api/metrics/timeseries/memory/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale
                }
            })
            .then((response) => {
                this.memoryData = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getLoadMetrics() {
            return axios.get(`/api/metrics/timeseries/load/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale
                }
            })
            .then((response) => {
              this.loadData = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getHttpStatusCodeMetrics() {
            return axios.get(`/api/metrics/timeseries/httpstatuscodes/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    host: this.host,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.httpStusCodeData = response.data;
              this.httpStusCodeDataIncrease = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getHttpStatusCodeIncreaseMetrics() {
            return axios.get(`/api/metrics/timeseries/httpstatuscodes/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    host: this.host,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.httpStusCodeDataIncrease = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getResponseTimeMetrics() {
            return axios.get(`/api/metrics/timeseries/responsetime/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    host: this.host,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.responsetimeData = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getResponseTrafficMetrics() {
            return axios.get(`/api/metrics/timeseries/traffic/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    host: this.host,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.httpResponseTrafficData = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getCpuMetrics() {
            // use 'rate' instead of 'increase' when comparing to limit and request
            return axios.get(`/api/metrics/timeseries/cpu/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.cpuData = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
        getCpuMetricsRate() {
            // use 'rate' instead of 'increase' when comparing to limit and request
            return axios.get(`/api/metrics/timeseries/cpu/${this.pipeline}/${this.phase}/${this.app}`, {
                params: {
                    scale: this.scale,
                    calc: 'rate'
                }
            })
            .then((response) => {
              this.cpuDataRate = response.data;
            })
            .catch((error) => {
                console.log(error);
            });
        },
    },
});
</script>