export interface MetricsOptions {
  enabled: boolean;
  endpoint: string;
}

export interface PrometheusQuery {
  // El rango de 7 días se quitó: con el paso de 2 minutos que usaba, un pod
  // reciente ya cubría casi toda la gráfica y era difícil de leer.
  scale: '2h' | '24h';
  pipeline: string;
  phase: string;
  app?: string;
  host?: string;
  calc?: 'rate' | 'increase';
}
export interface IMetric {
  name: string;
  metric: any;
  data: {
    x: Date;
    y: number;
  }[];
}

export interface IUsage {
  cpuCores: number;
  memoryBytes: number;
}

// Uso real de CPU/memoria de Kubero en el cluster entero (no por pipeline),
// usado en el panel de Overview. cpuCores/memoryBytes es el total; breakdown
// lo separa en las apps, sus addons (bases de datos y otros servicios de los
// namespaces de los pipelines) y la plataforma (panel y operador de Kubero).
export interface IClusterUsage extends IUsage {
  cpuCapacityCores: number;
  memoryCapacityBytes: number;
  breakdown: {
    apps: IUsage;
    addons: IUsage;
    platform: IUsage;
  };
}

export type Rule = {
  alert: any;
  duration: number;
  health: string;
  labels: any;
  name: string;
  query: string;
  alerting: boolean;
};
