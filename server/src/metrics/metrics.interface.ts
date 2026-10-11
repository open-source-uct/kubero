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

export type Rule = {
  alert: any;
  duration: number;
  health: string;
  labels: any;
  name: string;
  query: string;
  alerting: boolean;
};
