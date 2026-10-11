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
            <v-col cols="12" sm="12" md="6">
              <Alerts :app="app" :phase="phase" :pipeline="pipeline"/>
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select
                label="Rango"
                v-model="scale"
                :items="[ '2h', '24h' ]"
                density="compact"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select
                label="Zona horaria"
                v-model="timezone"
                :items="timezoneItems"
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
                <VueApexCharts :key="'memory-' + scale + '-' + timezone + '-' + memoryDecimals" type="area" height="180" :options="memoryOptions" :series="memoryData"></VueApexCharts>
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
                <VueApexCharts :key="'cpu-' + scale + '-' + timezone + '-' + cpuDecimals" type="line" height="180" :options="cpuOptions" :series="cpuDataRate"></VueApexCharts>
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
                <VueApexCharts :key="'responsetime-' + scale + '-' + timezone + '-' + responsetimeDecimals" type="area" height="180" :options="ResponsetimeOptions" :series="responsetimeData"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                Throughput
                <VueApexCharts :key="'throughput-' + scale + '-' + timezone + '-' + throughputDecimals" type="line" height="180" :options="httpStusCodeOptions" :series="httpStusCodeData"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                <VueApexCharts :key="'httpcode-increase-' + scale + '-' + timezone + '-' + throughputDecimals" type="area" height="180" :options="httpStusCodeIncreaseOptions" :series="httpStusCodeDataIncrease"></VueApexCharts>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" sm="12" md="12">
                <VueApexCharts :key="'traffic-' + scale + '-' + timezone + '-' + trafficDecimals" type="area" height="180" :options="httpResponseTrafficOptions" :series="httpResponseTrafficData"></VueApexCharts>
            </v-col>
        </v-row>
      </div>
    </v-container>
</template>

<script lang="ts">
import { defineComponent, markRaw } from 'vue'
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
      scale: '2h' as '2h'| '24h',
      // zona horaria para mostrar las fechas de los gráficos; se guarda por
      // si la persona prefiere ver otra distinta a Santiago
      timezone: localStorage.getItem('kubero.metricsTimezone') || 'America/Santiago',
      timezoneItems: [
        { title: 'Santiago (Chile continental)', value: 'America/Santiago' },
        { title: 'UTC', value: 'UTC' },
      ] as { title: string, value: string }[],
      // decimales del eje Y de cada gráfico; se recalculan solos según la
      // magnitud real de sus datos (ver pickDecimals), no los elige la persona
      memoryDecimals: 1,
      cpuDecimals: 1,
      responsetimeDecimals: 1,
      throughputDecimals: 1,
      trafficDecimals: 1,
      timer: null as any,
      // consultas de un ciclo de refresco que aún no terminaron
      pending: 0,
    }),
    components: {
        VueApexCharts,
        Alerts,
    },
    created() {
        // las funciones de formato se asignan acá (y no en los objetos de
        // arriba) porque necesitan "this" para leer this.timezone y
        // this.scale en cada dibujo del gráfico, no solo al crearlo
        this.applyTimezoneFormatters();
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
        },
        timezone: function (val) {
          // la key de cada VueApexCharts incluye timezone: cambiarla fuerza a
          // Vue a recrear los 6 gráficos juntos, así no quedan algunos con la
          // hora vieja y otros con la nueva
          localStorage.setItem('kubero.metricsTimezone', val);
        },
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
            return { '2h': 15000, '24h': 60000 }[this.scale];
        },
        // formatea un timestamp (ms) en la zona horaria elegida; se usa tanto
        // en el eje X como en el tooltip de los 6 gráficos
        formatInTimezone(value: number, options: Intl.DateTimeFormatOptions): string {
            return new Intl.DateTimeFormat('es-CL', {
                timeZone: this.timezone,
                ...options,
            }).format(new Date(Number(value)));
        },
        axisLabelFormat(value: number): string {
            // solo hora y minuto en los dos rangos: con fecha, el texto se
            // superpone y tapa las marcas del eje
            return this.formatInTimezone(value, { hour: '2-digit', minute: '2-digit' });
        },
        tooltipLabelFormat(value: number): string {
            return this.formatInTimezone(value, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short',
            });
        },
        // Se asigna acá y no en los data() de arriba: ApexCharts solo
        // redibuja cuando cambian options/series, y cambiar this.timezone no
        // altera esos objetos. La key del componente (ver template) sí fuerza
        // el redibujado; estas funciones leen this.timezone/this.scale frescos
        // en cada llamada, así que no hace falta volver a asignarlas después.
        applyTimezoneFormatters() {
            const chartOptions: any[] = [
                this.memoryOptions,
                this.cpuOptions,
                this.ResponsetimeOptions,
                this.httpStusCodeOptions,
                this.httpStusCodeIncreaseOptions,
                this.httpResponseTrafficOptions,
            ];
            for (const options of chartOptions) {
                options.xaxis.labels.formatter = (value: number) => this.axisLabelFormat(value);
                options.tooltip.x.formatter = (value: number) => this.tooltipLabelFormat(value);
            }
        },
        // Fija el eje X al rango completo pedido (p. ej. las 24 h), en vez de
        // dejar que ApexCharts lo recorte al tramo donde hay datos. Si
        // Prometheus solo tiene la última hora, se ve esa hora con datos y el
        // resto vacío, en vez de que el gráfico de "24h" se vea igual que el
        // de "2h" por puro zoom automático.
        applyAxisRange() {
            const rangeMs = { '2h': 2 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000 }[this.scale];
            const max = Date.now();
            const min = max - rangeMs;
            const chartOptions: any[] = [
                this.memoryOptions,
                this.cpuOptions,
                this.ResponsetimeOptions,
                this.httpStusCodeOptions,
                this.httpStusCodeIncreaseOptions,
                this.httpResponseTrafficOptions,
            ];
            for (const options of chartOptions) {
                options.xaxis.min = min;
                options.xaxis.max = max;
            }
        },
        // con apps casi sin tráfico los millicores de CPU quedan en 0.0 con un
        // solo decimal; esto deja elegir cuántos mostrar en el eje Y
        // cuántos decimales hacen falta para que el valor más grande de la
        // serie no se vea plano en 0.0 (pasa con apps casi sin tráfico, cuyo
        // uso de CPU es de milésimas de millicore)
        pickDecimals(series: { data: number[][] }[]): number {
            let maxAbs = 0;
            for (const serie of series || []) {
                for (const point of serie.data || []) {
                    maxAbs = Math.max(maxAbs, Math.abs(point[1]));
                }
            }
            if (maxAbs === 0) return 1;
            if (maxAbs >= 10) return 1;
            if (maxAbs >= 1) return 2;
            if (maxAbs >= 0.01) return 3;
            return 4;
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
            this.applyAxisRange();
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
                this.memoryData = markRaw(response.data);
                this.memoryDecimals = this.pickDecimals(response.data);
                this.memoryOptions.yaxis.decimalsInFloat = this.memoryDecimals;
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
              this.loadData = markRaw(response.data);
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
              this.httpStusCodeData = markRaw(response.data);
              this.httpStusCodeDataIncrease = markRaw(response.data);
              this.throughputDecimals = this.pickDecimals(response.data);
              this.httpStusCodeOptions.yaxis.decimalsInFloat = this.throughputDecimals;
              this.httpStusCodeIncreaseOptions.yaxis.decimalsInFloat = this.throughputDecimals;
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
              this.httpStusCodeDataIncrease = markRaw(response.data);
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
              this.responsetimeDecimals = this.pickDecimals(response.data);
              this.ResponsetimeOptions.yaxis.decimalsInFloat = this.responsetimeDecimals;
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
              this.httpResponseTrafficData = markRaw(response.data);
              this.trafficDecimals = this.pickDecimals(response.data);
              this.httpResponseTrafficOptions.yaxis.decimalsInFloat = this.trafficDecimals;
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
              this.cpuData = markRaw(response.data);
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
              this.cpuDataRate = markRaw(response.data);
              this.cpuDecimals = this.pickDecimals(response.data);
              this.cpuOptions.yaxis.decimalsInFloat = this.cpuDecimals;
            })
            .catch((error) => {
                console.log(error);
            });
        },
    },
});
</script>