import { Injectable, Logger } from '@nestjs/common';
import { ILoglines } from './logs.interface';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { AppsService } from '../apps/apps.service';
import { EventsGateway } from '../events/events.gateway';
import { Stream } from 'stream';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LogsService {
  private logger = new Logger(LogsService.name);
  private podLogStreams: string[] = [];
  // cómo cerrar cada stream abierto, y cuándo se cortó cada uno
  private streamAborts = new Map<string, () => void>();
  private streamClosedAt = new Map<string, number>();
  // apps con los logs abiertos por alguien, con su vigilante de pods
  private roomWatchers = new Map<
    string,
    {
      startedAt: number;
      idleRounds: number;
      busy: boolean;
      timer: NodeJS.Timeout;
    }
  >();
  static readonly WATCH_INTERVAL_MS = 5000;
  // rondas seguidas sin nadie en la sala antes de dejar de vigilar
  static readonly IDLE_ROUNDS = 2;

  constructor(
    private kubectl: KubernetesService,
    private pipelinesService: PipelinesService,
    private EventsGateway: EventsGateway,
    private appsService: AppsService,
  ) {}

  // Nombre de la instancia de cada addon de la app (es el prefijo de sus pods).
  // Se toma del recurso principal, igual que en la pestaña de logs del cliente.
  private addonInstanceNames(app: any): string[] {
    const names: string[] = [];
    for (const addon of app?.spec?.addons || []) {
      const definitions = addon.resourceDefinitions || {};
      const crd =
        definitions[addon.kind] ??
        Object.values(definitions).find((r: any) => r?.kind !== 'Secret');
      const name = crd?.metadata?.name;
      if (name) {
        names.push(name);
      }
    }
    return names;
  }

  private logcolor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += ('00' + value.toString(16)).substring(2);
    }
    return color;
  }

  public async emitLogs(
    pipelineName: string,
    phaseName: string,
    appName: string,
    podName: string,
    container: string,
    userGroups: string[],
  ) {
    const contextName = await this.pipelinesService.getContext(
      pipelineName,
      phaseName,
      userGroups,
    );
    if (contextName) {
      await this.openStream(
        contextName,
        pipelineName,
        phaseName,
        appName,
        podName,
        container,
      );
    }
  }

  // Abre el stream en vivo de un contenedor. `sinceSeconds` retoma las líneas
  // que se escribieron mientras no había stream (reinicio o corte).
  private async openStream(
    contextName: string,
    pipelineName: string,
    phaseName: string,
    appName: string,
    podName: string,
    container: string,
    sinceSeconds?: number,
  ) {
    const namespace = pipelineName + '-' + phaseName;
    // un pod puede tener varios contenedores, cada uno con su propio stream
    const streamKey = `${contextName}/${namespace}/${podName}/${container}`;

    if (this.podLogStreams.includes(streamKey)) {
      this.logger.debug('logs already running ' + podName + ' ' + container);
      return;
    }

    const logStream = new Stream.PassThrough();
    logStream.on('data', (chunk: any) => {
      const roomname = `${pipelineName}-${phaseName}-${appName}`;
      const logline = {
        id: uuidv4(),
        time: new Date().getTime(),
        pipeline: pipelineName,
        phase: phaseName,
        app: appName,
        pod: podName,
        podID: podName.split('-')[3] + '-' + podName.split('-')[4],
        container: container,
        color: this.logcolor(podName),
        log: chunk.toString(),
      };
      void this.EventsGateway.sendLogline(roomname, logline);
    });

    this.podLogStreams.push(streamKey);
    this.streamClosedAt.delete(streamKey);
    // si el stream se corta o falla se libera, para poder abrirlo de nuevo
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.podLogStreams = this.podLogStreams.filter((k) => k !== streamKey);
      this.streamAborts.delete(streamKey);
      // solo importa mientras alguien mira los logs (para retomar el stream);
      // sin vigilante, guardarlo dejaría entradas que nadie limpia
      if (this.roomWatchers.has(`${pipelineName}-${phaseName}-${appName}`)) {
        this.streamClosedAt.set(streamKey, Date.now());
      }
    };
    logStream.on('close', release);
    logStream.on('error', release);

    const options =
      sinceSeconds !== undefined
        ? { follow: true, sinceSeconds, pretty: false, timestamps: false }
        : { follow: true, tailLines: 0, pretty: false, timestamps: false };

    try {
      const request: any = await this.kubectl
        .getLog(contextName)
        .log(namespace, podName, container, logStream, options);
      if (!released) {
        this.streamAborts.set(streamKey, () => {
          request?.abort?.();
          logStream.destroy();
        });
      }
      this.logger.debug('logs started for ' + podName + ' ' + container);
    } catch (err: any) {
      release();
      this.logger.error(
        'Failed to start logs for ' + podName + ' ' + container,
      );
      this.logger.error(err?.body?.message ?? err?.message);
    }
  }

  // Abre los streams de los contenedores que están corriendo. Los que se están
  // creando o reiniciando se saltan: la siguiente ronda del vigilante los toma.
  private async streamRunningContainers(
    contextName: string,
    pipelineName: string,
    phaseName: string,
    appName: string,
    watchStartedAt?: number,
  ) {
    const namespace = pipelineName + '-' + phaseName;
    const pods = await this.kubectl.getPods(namespace, contextName);
    for (const pod of pods) {
      const podName = pod.metadata?.name;
      if (!podName?.startsWith(appName + '-kuberoapp')) {
        continue;
      }
      for (const container of pod.spec?.containers || []) {
        const status = pod.status?.containerStatuses?.find(
          (s: any) => s.name === container.name,
        );
        if (status && !status.state?.running) {
          continue;
        }
        const streamKey = `${contextName}/${namespace}/${podName}/${container.name}`;
        await this.openStream(
          contextName,
          pipelineName,
          phaseName,
          appName,
          podName,
          container.name,
          this.resumeSeconds(
            streamKey,
            status?.state?.running?.startedAt,
            watchStartedAt,
          ),
        );
      }
    }
  }

  // Desde cuántos segundos atrás pedir líneas al reabrir un stream, para no
  // perder lo que el contenedor escribió mientras no había stream.
  private resumeSeconds(
    streamKey: string,
    startedAt: string | Date | undefined,
    watchStartedAt?: number,
  ): number | undefined {
    if (!watchStartedAt) {
      return undefined;
    }
    const now = Date.now();
    const started = startedAt ? new Date(startedAt).getTime() : NaN;
    // el contenedor arrancó mientras alguien miraba los logs (reinicio o pod
    // nuevo de un despliegue): se trae todo desde que arrancó
    if (started >= watchStartedAt) {
      return Math.ceil((now - started) / 1000) + 1;
    }
    // el stream se cortó con el contenedor corriendo: se retoma desde el corte
    const closedAt = this.streamClosedAt.get(streamKey);
    if (closedAt && closedAt >= watchStartedAt) {
      return Math.ceil((now - closedAt) / 1000) + 1;
    }
    return undefined;
  }

  public async startLogging(
    pipelineName: string,
    phaseName: string,
    appName: string,
    userGroups: string[],
  ) {
    const contextName = await this.pipelinesService.getContext(
      pipelineName,
      phaseName,
      userGroups,
    );
    if (!contextName) {
      return;
    }
    await this.streamRunningContainers(
      contextName,
      pipelineName,
      phaseName,
      appName,
    );
    this.watchRoom(contextName, pipelineName, phaseName, appName);
  }

  // Mientras alguien tenga los logs abiertos, revisa los pods cada pocos
  // segundos y reabre los streams que se cortaron: reinicios del contenedor,
  // pods que aún se estaban creando y pods nuevos de un despliegue.
  private watchRoom(
    contextName: string,
    pipelineName: string,
    phaseName: string,
    appName: string,
  ) {
    const room = `${pipelineName}-${phaseName}-${appName}`;
    if (this.roomWatchers.has(room)) {
      return;
    }
    const watcher = {
      startedAt: Date.now(),
      idleRounds: 0,
      busy: false,
      timer: undefined as unknown as NodeJS.Timeout,
    };
    watcher.timer = setInterval(() => {
      void this.watchTick(room, contextName, pipelineName, phaseName, appName);
    }, LogsService.WATCH_INTERVAL_MS);
    watcher.timer.unref?.();
    this.roomWatchers.set(room, watcher);
  }

  private async watchTick(
    room: string,
    contextName: string,
    pipelineName: string,
    phaseName: string,
    appName: string,
  ) {
    const watcher = this.roomWatchers.get(room);
    if (!watcher || watcher.busy) {
      return;
    }
    if (!this.EventsGateway.hasListeners(room)) {
      watcher.idleRounds++;
      if (watcher.idleRounds >= LogsService.IDLE_ROUNDS) {
        this.stopWatching(
          room,
          contextName,
          pipelineName + '-' + phaseName,
          appName,
        );
      }
      return;
    }
    watcher.idleRounds = 0;
    watcher.busy = true;
    try {
      await this.streamRunningContainers(
        contextName,
        pipelineName,
        phaseName,
        appName,
        watcher.startedAt,
      );
    } catch (err: any) {
      this.logger.debug('logs watch failed for ' + room + ': ' + err?.message);
    } finally {
      watcher.busy = false;
    }
  }

  // Nadie mira los logs de la app: se deja de vigilar y se cierran sus streams
  private stopWatching(
    room: string,
    contextName: string,
    namespace: string,
    appName: string,
  ) {
    const watcher = this.roomWatchers.get(room);
    if (watcher) {
      clearInterval(watcher.timer);
      this.roomWatchers.delete(room);
    }
    const prefix = `${contextName}/${namespace}/${appName}-kuberoapp`;
    for (const [key, abort] of this.streamAborts) {
      if (key.startsWith(prefix)) {
        abort();
      }
    }
    for (const key of this.streamClosedAt.keys()) {
      if (key.startsWith(prefix)) {
        this.streamClosedAt.delete(key);
      }
    }
  }

  public async getLogsHistory(
    pipelineName: string,
    phaseName: string,
    appName: string,
    container: string,
    userGroups: string[],
  ) {
    const contextName = await this.pipelinesService.getContext(
      pipelineName,
      phaseName,
      userGroups,
    );
    const namespace = pipelineName + '-' + phaseName;

    if (!['web', 'builder', 'fetcher', 'addons'].includes(container)) {
      console.log('unknown container: ' + container);
      return [];
    }

    // Los pods de la app siempre son <app>-kuberoapp-*; todo lo demás que
    // empiece con <app>- (ej. la base de datos) es de un addon.
    const appPrefix = appName + '-kuberoapp';

    let loglines: ILoglines[] = [];
    if (contextName) {
      // Los pods de addon se identifican por el nombre exacto de cada addon de
      // esta app. Un prefijo no alcanza: "server-api" empieza con "server-".
      const addonNames =
        container == 'addons'
          ? this.addonInstanceNames(
              await this.appsService.getApp(
                pipelineName,
                phaseName,
                appName,
                userGroups,
              ),
            )
          : [];
      const pods = await this.kubectl.getPods(namespace, contextName);
      for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) {
          continue;
        }
        const isJob = !!pod.metadata?.labels?.['job-name'];

        if (container == 'web' && podName.startsWith(appPrefix) && !isJob) {
          // only fetch logs for the web container, exclude job pods (builds)
          for (const c of pod.spec?.containers || []) {
            const ll = await this.fetchLogs(
              namespace,
              podName,
              c.name,
              pipelineName,
              phaseName,
              appName,
              contextName,
            );
            loglines = loglines.concat(ll);
            // si el contenedor se reinició, sus últimas líneas antes de caer
            // explican por qué; el contenedor actual puede no tener ninguna
            const status = pod.status?.containerStatuses?.find(
              (st: any) => st.name === c.name,
            );
            if ((status?.restartCount ?? 0) > 0) {
              const previous = await this.fetchLogs(
                namespace,
                podName,
                c.name,
                pipelineName,
                phaseName,
                appName,
                contextName,
                true,
              );
              loglines = loglines.concat(previous);
            }
          }
        } else if (
          (container == 'builder' || container == 'fetcher') &&
          podName.startsWith(appPrefix)
        ) {
          const ll = await this.fetchLogs(
            namespace,
            podName,
            'kuberoapp-' + container,
            pipelineName,
            phaseName,
            appName,
            contextName,
          );
          loglines = loglines.concat(ll);
        } else if (
          container == 'addons' &&
          !podName.includes('-kuberoapp-') &&
          !isJob &&
          addonNames.some((name) => podName.startsWith(name + '-'))
        ) {
          for (const c of pod.spec?.containers || []) {
            const ll = await this.fetchLogs(
              namespace,
              podName,
              c.name,
              pipelineName,
              phaseName,
              appName,
              contextName,
            );
            loglines = loglines.concat(ll);
          }
        }
      }
    }
    // lo más nuevo primero, igual que las líneas en vivo (unshift en el cliente)
    return loglines.sort((a, b) => b.time - a.time);
  }

  public async fetchLogs(
    namespace: string,
    podName: string,
    containerName: string,
    pipelineName: string,
    phaseName: string,
    appName: string,
    contextName?: string,
    previous = false,
  ): Promise<ILoglines[]> {
    const loglines: ILoglines[] = [];

    const logStream = new Stream.PassThrough();
    let logs: string = '';
    logStream.on('data', (chunk: any) => {
      //console.log(chunk.toString());
      logs += chunk.toString();
    });

    try {
      await this.kubectl
        .getLog(contextName)
        .log(namespace, podName, containerName, logStream, {
          follow: false,
          tailLines: previous ? 40 : 80,
          pretty: false,
          timestamps: true,
          previous,
        });
    } catch {
      console.log('error getting logs for ' + podName + ' ' + containerName);
      return [];
    }

    // sleep for 1 second to wait for all logs to be collected
    await new Promise((r) => setTimeout(r, 300));

    // split loglines into array
    const loglinesArray = logs.split('\n').reverse();
    for (const logline of loglinesArray) {
      if (logline.length > 0) {
        // split after first whitespace
        const loglineArray = logline.split(/(?<=^\S+)\s/);
        const loglineDate = new Date(loglineArray[0]);
        const loglineText = loglineArray[1];

        loglines.push({
          id: uuidv4(),
          time: loglineDate.getTime(),
          pipeline: pipelineName,
          phase: phaseName,
          app: appName,
          pod: podName,
          podID: podName.split('-')[3] + '-' + podName.split('-')[4],
          container: containerName,
          color: this.logcolor(podName),
          log: loglineText,
          ...(previous && { previous: true }),
        });
      }
    }

    return loglines;
  }
}
