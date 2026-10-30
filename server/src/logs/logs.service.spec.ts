import { LogsService } from './logs.service';

const mockUserGroups = ['group1', 'group2'];

// App mock con addons; el nombre de la instancia va en el recurso principal
const appWithAddons = (app: string, instanceNames: string[]) => ({
  spec: {
    addons: instanceNames.map((name) => ({
      kind: 'KuberoAddonPostgres',
      displayName: 'PostgreSQL',
      resourceDefinitions: {
        KuberoAddonPostgres: {
          kind: 'KuberoAddonPostgres',
          metadata: { name },
        },
      },
    })),
  },
});

describe('LogsService', () => {
  let service: LogsService;
  let kubectl: any;
  let pipelinesService: any;
  let eventsGateway: any;
  let appsService: any;

  beforeEach(() => {
    kubectl = {
      setCurrentContext: jest.fn(),
      getPods: jest.fn(),
      log: {
        log: jest.fn().mockResolvedValue(undefined),
      },
    };
    kubectl.getLog = jest.fn(() => kubectl.log);
    pipelinesService = {
      getContext: jest.fn(),
    };
    eventsGateway = {
      sendLogline: jest.fn(),
      hasListeners: jest.fn().mockReturnValue(true),
    };
    appsService = {
      getApp: jest.fn().mockResolvedValue({ spec: { addons: [] } }),
    };
    service = new LogsService(
      kubectl,
      pipelinesService,
      eventsGateway,
      appsService,
    );
  });

  afterEach(() => {
    for (const watcher of (service as any).roomWatchers.values()) {
      clearInterval(watcher.timer);
    }
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logcolor', () => {
    it('should return a color string', () => {
      const color = (service as any).logcolor('testpod');
      expect(typeof color).toBe('string');
      expect(color.startsWith('#')).toBe(true);
    });
  });

  describe('emitLogs', () => {
    it('keeps same-named pod log streams separate across contexts and namespaces', async () => {
      pipelinesService.getContext
        .mockResolvedValueOnce('cluster-a')
        .mockResolvedValueOnce('cluster-b');
      await service.emitLogs('pipe', 'dev', 'app', 'same-pod', 'web', [
        'group1',
      ]);
      await service.emitLogs('pipe', 'prod', 'app', 'same-pod', 'web', [
        'group1',
      ]);
      expect(kubectl.getLog).toHaveBeenNthCalledWith(1, 'cluster-a');
      expect(kubectl.getLog).toHaveBeenNthCalledWith(2, 'cluster-b');
      expect(kubectl.log.log).toHaveBeenCalledTimes(2);
    });

    it('should emit logs and call sendLogline', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.setCurrentContext.mockReturnValue(undefined);
      kubectl.log.log.mockImplementation((_ns, _pod, _container, logStream) => {
        setTimeout(() => {
          logStream.emit('data', Buffer.from('logline'));
        }, 10);
        return Promise.resolve();
      });

      await service.emitLogs(
        'pipe',
        'phase',
        'app',
        'pod-foo-bar-123-456',
        'web',
        ['group1', 'group2'],
      );
      // Simuliere das Eintreffen von Logdaten
      await new Promise((r) => setTimeout(r, 20));
      expect(eventsGateway.sendLogline).toHaveBeenCalled();
    });

    it('should not start logs if already running', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      (service as any).podLogStreams = [
        'ctx/pipe-phase/pod-foo-bar-123-456/web',
      ];
      const spy = jest.spyOn(kubectl.log, 'log');
      await service.emitLogs(
        'pipe',
        'phase',
        'app',
        'pod-foo-bar-123-456',
        'web',
        ['group1', 'group2'],
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it('should allow restarting logs after the stream closes', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      let stream: any;
      kubectl.log.log.mockImplementation((_ns, _pod, _container, logStream) => {
        stream = logStream;
        return Promise.resolve();
      });
      const start = () =>
        service.emitLogs('pipe', 'phase', 'app', 'pod-foo-bar-123-456', 'web', [
          'group1',
        ]);

      await start();
      await start();
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);

      stream.destroy();
      await new Promise((r) => setImmediate(r));
      await start();
      expect(kubectl.log.log).toHaveBeenCalledTimes(2);
    });

    it('should free the stream if starting logs fails', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.log.log.mockRejectedValue({ body: { message: 'boom' } });
      const start = () =>
        service.emitLogs('pipe', 'phase', 'app', 'pod-foo-bar-123-456', 'web', [
          'group1',
        ]);

      await start();
      await new Promise((r) => setImmediate(r));
      await start();
      expect(kubectl.log.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('startLogging', () => {
    // pod de la app con un contenedor en el estado indicado
    const appPod = (state: any, name = 'app-kuberoapp-web-abc-123') => ({
      metadata: { name, labels: {} },
      spec: { containers: [{ name: 'kuberoapp-web' }] },
      status: { containerStatuses: [{ name: 'kuberoapp-web', state }] },
    });
    const running = (startedAt: number) => ({
      running: { startedAt: new Date(startedAt).toISOString() },
    });
    const logOptions = (call: number) => kubectl.log.log.mock.calls[call][4];

    it('should stream matching pods and containers', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-123', labels: {} },
          spec: { containers: [{ name: 'web' }] },
        },
      ]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);
      expect(kubectl.log.log.mock.calls[0].slice(0, 3)).toEqual([
        'pipe-phase',
        'app-kuberoapp-123',
        'web',
      ]);
      expect(logOptions(0)).toMatchObject({ follow: true, tailLines: 0 });
    });

    it('waits for a container that is still being created and streams it once it runs', async () => {
      jest.useFakeTimers();
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        appPod({ waiting: { reason: 'ContainerCreating' } }),
      ]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      expect(kubectl.log.log).not.toHaveBeenCalled();

      kubectl.getPods.mockResolvedValue([appPod(running(Date.now() + 1000))]);
      await jest.advanceTimersByTimeAsync(LogsService.WATCH_INTERVAL_MS);
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);
      // arrancó mientras alguien miraba: se piden sus líneas desde el inicio
      expect(logOptions(0).sinceSeconds).toBeGreaterThan(0);
      expect(logOptions(0).tailLines).toBeUndefined();
    });

    it('reopens the stream after the container restarts', async () => {
      jest.useFakeTimers();
      pipelinesService.getContext.mockResolvedValue('ctx');
      let stream: any;
      kubectl.log.log.mockImplementation((_ns, _pod, _container, logStream) => {
        stream = logStream;
        return Promise.resolve({ abort: jest.fn() });
      });
      kubectl.getPods.mockResolvedValue([appPod(running(Date.now() - 60000))]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);

      // el contenedor se cae: el stream termina y el pod queda reiniciándose
      stream.destroy();
      kubectl.getPods.mockResolvedValue([
        appPod({ waiting: { reason: 'CrashLoopBackOff' } }),
      ]);
      await jest.advanceTimersByTimeAsync(LogsService.WATCH_INTERVAL_MS);
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);

      kubectl.getPods.mockResolvedValue([appPod(running(Date.now()))]);
      await jest.advanceTimersByTimeAsync(LogsService.WATCH_INTERVAL_MS);
      expect(kubectl.log.log).toHaveBeenCalledTimes(2);
      expect(logOptions(1).sinceSeconds).toBeGreaterThan(0);
    });

    it('follows the new pod of a redeploy', async () => {
      jest.useFakeTimers();
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        appPod(running(Date.now() - 60000), 'app-kuberoapp-web-old-1'),
      ]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);

      kubectl.getPods.mockResolvedValue([
        appPod(running(Date.now()), 'app-kuberoapp-web-new-2'),
      ]);
      await jest.advanceTimersByTimeAsync(LogsService.WATCH_INTERVAL_MS);
      expect(kubectl.log.log).toHaveBeenCalledTimes(2);
      expect(kubectl.log.log.mock.calls[1][1]).toBe('app-kuberoapp-web-new-2');
    });

    it('does not open the same stream twice while it is still running', async () => {
      jest.useFakeTimers();
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.log.log.mockResolvedValue({ abort: jest.fn() });
      kubectl.getPods.mockResolvedValue([appPod(running(Date.now() - 60000))]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      await jest.advanceTimersByTimeAsync(LogsService.WATCH_INTERVAL_MS * 3);
      expect(kubectl.log.log).toHaveBeenCalledTimes(1);
    });

    it('stops watching and closes the streams when nobody has the logs open', async () => {
      jest.useFakeTimers();
      pipelinesService.getContext.mockResolvedValue('ctx');
      const abort = jest.fn();
      kubectl.log.log.mockResolvedValue({ abort });
      kubectl.getPods.mockResolvedValue([appPod(running(Date.now() - 60000))]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);

      eventsGateway.hasListeners.mockReturnValue(false);
      await jest.advanceTimersByTimeAsync(
        LogsService.WATCH_INTERVAL_MS * LogsService.IDLE_ROUNDS,
      );
      expect(eventsGateway.hasListeners).toHaveBeenCalledWith('pipe-phase-app');
      expect(abort).toHaveBeenCalled();
      expect((service as any).roomWatchers.size).toBe(0);
      expect((service as any).podLogStreams).toEqual([]);
    });

    it('keeps a single watcher per app', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([]);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      expect((service as any).roomWatchers.size).toBe(1);
    });

    it('does nothing without access to the pipeline', async () => {
      pipelinesService.getContext.mockResolvedValue(undefined);
      await service.startLogging('pipe', 'phase', 'app', mockUserGroups);
      expect(kubectl.getPods).not.toHaveBeenCalled();
      expect((service as any).roomWatchers.size).toBe(0);
    });
  });

  describe('getLogsHistory', () => {
    it('should return loglines for web container', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-123', labels: {} },
          spec: { containers: [{ name: 'web' }] },
        },
      ]);
      jest.spyOn(service, 'fetchLogs').mockResolvedValue([
        {
          id: 'id',
          time: Date.now(),
          pipeline: 'pipe',
          phase: 'phase',
          app: 'app',
          pod: 'app-kuberoapp-123',
          podID: '123-undefined',
          container: 'web',
          color: '#000000',
          log: 'logline',
        },
      ]);
      const result = await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'web',
        ['group1', 'group2'],
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].container).toBe('web');
    });

    it('adds the last lines of the previous container after a restart', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-web-abc-123', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
          status: {
            containerStatuses: [{ name: 'kuberoapp-web', restartCount: 3 }],
          },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'web',
        mockUserGroups,
      );
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][7]).toBeUndefined();
      expect(spy.mock.calls[1][7]).toBe(true);
    });

    it('does not ask for previous logs when the container never restarted', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-web-abc-123', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
          status: {
            containerStatuses: [{ name: 'kuberoapp-web', restartCount: 0 }],
          },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'web',
        mockUserGroups,
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for unknown container', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-123', labels: {} },
          spec: { containers: [{ name: 'web' }] },
        },
      ]);
      const result = await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'unknown',
        ['group1', 'group2'],
      );
      expect(result).toEqual([]);
    });
    it('should not include addon pods in web logs', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-web-abc-123', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
        },
        {
          metadata: { name: 'app-postgres-0', labels: {} },
          spec: { containers: [{ name: 'postgres' }] },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'web',
        mockUserGroups,
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBe('app-kuberoapp-web-abc-123');
    });

    it('should return only addon pod logs for addons container', async () => {
      appsService.getApp.mockResolvedValue(
        appWithAddons('app', ['app-postgres']),
      );
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-web-abc-123', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
        },
        {
          metadata: { name: 'app-postgres-0', labels: {} },
          spec: { containers: [{ name: 'postgres' }] },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'addons',
        mockUserGroups,
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBe('app-postgres-0');
      expect(spy.mock.calls[0][2]).toBe('postgres');
    });

    it('should not include pods of another app whose name shares the prefix', async () => {
      appsService.getApp.mockResolvedValue(
        appWithAddons('server', ['server-postgres']),
      );
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'server-postgres-0', labels: {} },
          spec: { containers: [{ name: 'postgres' }] },
        },
        {
          metadata: { name: 'server-api-postgres-0', labels: {} },
          spec: { containers: [{ name: 'postgres' }] },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      await service.getLogsHistory(
        'pipe',
        'phase',
        'server',
        'addons',
        mockUserGroups,
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBe('server-postgres-0');
    });

    it('should return nothing for addons when the app has no addons', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-postgres-0', labels: {} },
          spec: { containers: [{ name: 'postgres' }] },
        },
      ]);
      const spy = jest.spyOn(service, 'fetchLogs').mockResolvedValue([]);
      const result = await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'addons',
        mockUserGroups,
      );
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should sort loglines by time descending', async () => {
      pipelinesService.getContext.mockResolvedValue('ctx');
      kubectl.getPods.mockResolvedValue([
        {
          metadata: { name: 'app-kuberoapp-web-abc-1', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
        },
        {
          metadata: { name: 'app-kuberoapp-web-abc-2', labels: {} },
          spec: { containers: [{ name: 'kuberoapp-web' }] },
        },
      ]);
      const line = (time: number) =>
        ({
          id: String(time),
          time,
          pipeline: 'pipe',
          phase: 'phase',
          app: 'app',
          pod: 'p',
          podID: 'x',
          container: 'kuberoapp-web',
          color: '#000000',
          log: 'l',
        }) as any;
      jest
        .spyOn(service, 'fetchLogs')
        .mockResolvedValueOnce([line(100), line(300)])
        .mockResolvedValueOnce([line(200)]);
      const result = await service.getLogsHistory(
        'pipe',
        'phase',
        'app',
        'web',
        mockUserGroups,
      );
      expect(result.map((l) => l.time)).toEqual([300, 200, 100]);
    });
  });

  describe('fetchLogs', () => {
    it('should return parsed loglines', async () => {
      kubectl.log.log.mockImplementation((_ns, _pod, _container, logStream) => {
        logStream.emit(
          'data',
          Buffer.from(
            '2024-05-23T12:00:00Z logline1\n2024-05-23T12:01:00Z logline2\n',
          ),
        );
        return Promise.resolve();
      });
      const result = await service.fetchLogs(
        'ns',
        'pod-foo-bar-123-456',
        'web',
        'pipe',
        'phase',
        'app',
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].log).toBeDefined();
    });

    it('marks the lines of the previous container', async () => {
      kubectl.log.log.mockImplementation(
        (_ns, _pod, _container, logStream, options) => {
          expect(options).toMatchObject({ previous: true, tailLines: 40 });
          logStream.emit(
            'data',
            Buffer.from('2024-05-23T12:00:00Z intento 15/15\n'),
          );
          return Promise.resolve();
        },
      );
      const result = await service.fetchLogs(
        'ns',
        'pod-foo-bar-123-456',
        'web',
        'pipe',
        'phase',
        'app',
        'ctx',
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].previous).toBe(true);
    });

    it('should return empty array on error', async () => {
      kubectl.log.log.mockRejectedValue(new Error('fail'));
      const result = await service.fetchLogs(
        'ns',
        'pod',
        'web',
        'pipe',
        'phase',
        'app',
      );
      expect(result).toEqual([]);
    });
  });
});
