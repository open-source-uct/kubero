export interface ILoglines {
  id: string;
  time: number;
  pipeline: string;
  phase: string;
  app: string;
  pod: string;
  podID: string;
  container: string;
  color: string;
  log: string;
  // línea del contenedor anterior, que terminó antes de un reinicio
  previous?: boolean;
}
