import { MetricsService } from './metrics.service';

jest.mock('prometheus-query', () => {
  return {
    PrometheusDriver: jest.fn().mockImplementation(() => ({
      status: jest.fn().mockResolvedValue(true),
      instantQuery: jest.fn().mockResolvedValue({
        result: [
          {
            metric: { labels: { pod: 'pod1', status: '200' } },
            values: [{ time: '2024-05-23T12:00:00Z', value: 123 }],
          },
        ],
      }),
      rangeQuery: jest.fn().mockResolvedValue({
        result: [
          {
            metric: { labels: { pod: 'pod1', status: '200' } },
            values: [{ time: '2024-05-23T12:00:00Z', value: 456 }],
          },
        ],
      }),
      rules: jest.fn().mockResolvedValue([
        {
          rules: [
            {
              type: 'alerting',
              alerts: [
                {
                  labels: {
                    namespace: 'pipe-phase',
                    service: 'app-kuberoapp',
                  },
                },
              ],
              duration: 10,
              health: 'ok',
              labels: { foo: 'bar' },
              name: 'TestRule',
              query: 'up',
            },
          ],
        },
      ]),
    })),
    QueryResult: jest.fn(),
    RuleGroup: jest.fn(),
  };
});

describe('MetricsService', () => {
  let service: MetricsService;
  let kubectl: any;

  beforeEach(() => {
    kubectl = {
      getPodMetrics: jest.fn().mockResolvedValue([{ pod: 'pod1', value: 1 }]),
      getPodUptimes: jest
        .fn()
        .mockResolvedValue([{ pod: 'pod1', uptime: 100 }]),
    };
    service = new MetricsService(kubectl);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should getStatus true', async () => {
    await expect(service.getStatus()).resolves.toBe(true);
  });

  it('should getLongTermMetrics', async () => {
    const result = await service.getLongTermMetrics('up');
    expect(result).toBeDefined();
    expect(result?.result[0].metric.labels.pod).toBe('pod1');
  });

  it('should queryMetrics', async () => {
    const q = { pipeline: 'pipe', phase: 'phase', app: 'app', scale: '24h' };
    const result = await service.queryMetrics('container_memory_rss', q as any);
    expect(result).toBeDefined();
    expect(result?.result[0].metric.labels.pod).toBe('pod1');
  });

  it('should getMemoryMetrics', async () => {
    const q = { pipeline: 'pipe', phase: 'phase', app: 'app', scale: '24h' };
    const result = await service.getMemoryMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('pod1');
  });

  it('should getLoadMetrics', async () => {
    const q = { pipeline: 'pipe', phase: 'phase', app: 'app', scale: '24h' };
    const result = await service.getLoadMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('pod1');
  });

  it('should getCPUMetrics', async () => {
    const q = {
      pipeline: 'pipe',
      phase: 'phase',
      app: 'app',
      scale: '24h',
      calc: 'rate',
    };
    const result = await service.getCPUMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('pod1');
  });

  it('should getHttpStatusCodesMetrics', async () => {
    const q = {
      pipeline: 'pipe',
      phase: 'phase',
      scale: '24h',
      calc: 'rate',
      host: 'host',
    };
    const result = await service.getHttpStatusCodesMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('200');
  });

  it('should getHttpResponseTimeMetrics', async () => {
    const q = {
      pipeline: 'pipe',
      phase: 'phase',
      scale: '24h',
      calc: 'rate',
      host: 'host',
    };
    const result = await service.getHttpResponseTimeMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('200');
  });

  it('should getHttpResponseTrafficMetrics', async () => {
    const q = {
      pipeline: 'pipe',
      phase: 'phase',
      scale: '24h',
      calc: 'sum',
      host: 'host',
    };
    const result = await service.getHttpResponseTrafficMetrics(q as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('200');
  });

  it('should getRules', async () => {
    const q = { pipeline: 'pipe', phase: 'phase', app: 'app' };
    const result = await service.getRules(q);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('TestRule');
    expect(result[0].alerting).toBe(true);
  });

  it('should getPodMetrics', async () => {
    const result = await service.getPodMetrics('pipe', 'phase', 'app');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].pod).toBe('pod1');
  });

  it('should getUptimes', async () => {
    const result = await service.getUptimes('pipe', 'phase');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].pod).toBe('pod1');
  });

  it('should getStepsAndStart for 2h', () => {
    const result = (service as any).getStepsAndStart('2h');
    expect(result.vector).toBe('5m');
  });

  it('should getStepsAndStart for 24h', () => {
    const result = (service as any).getStepsAndStart('24h');
    expect(result.vector).toBe('10m');
  });

  it('should getStepsAndStart for 7d', () => {
    const result = (service as any).getStepsAndStart('7d');
    expect(result.vector).toBe('20m');
  });
  describe('query safety and size', () => {
    const base = {
      pipeline: 'pipe',
      phase: 'phase',
      app: 'app',
      scale: '24h',
      calc: 'rate',
      host: 'a.example.test',
    };
    const lastQuery = () =>
      (service as any).prom.rangeQuery.mock.calls.at(-1)[0] as string;

    beforeEach(() => (service as any).prom.rangeQuery.mockClear());

    it('filters the pod series by app (the namespace holds every app of the pipeline)', async () => {
      await service.getMemoryMetrics(base as any);
      expect(lastQuery()).toContain('namespace="pipe-phase"');
      expect(lastQuery()).toContain('pod=~"app-kuberoapp-.*"');
      await service.getCPUMetrics(base as any);
      expect(lastQuery()).toContain('pod=~"app-kuberoapp-.*"');
    });

    it.each([
      ['host', { host: 'x"} or {namespace="other-team' }],
      ['host', { host: 'a.example.test", status=~".+' }],
      ['app', { app: 'x"} or {namespace="other-team' }],
      ['app', { app: 'a b' }],
      ['pipeline', { pipeline: 'p"} or {job=~".+' }],
      ['phase', { phase: 'p}{' }],
      ['app', { app: undefined }],
    ])(
      'rejects an injected %s and never queries Prometheus',
      async (_n, patch) => {
        const q: any = { ...base, ...patch };
        for (const call of [
          () => service.getMemoryMetrics(q),
          () => service.getLoadMetrics(q),
          () => service.getCPUMetrics(q),
          () => service.getHttpStatusCodesMetrics(q),
          () => service.getHttpResponseTimeMetrics(q),
          () => service.getHttpResponseTrafficMetrics(q),
        ]) {
          // los métodos que no usan ese dato no están obligados a rechazarlo
          await call().catch(() => undefined);
        }
        const queries = (service as any).prom.rangeQuery.mock.calls.map(
          (c: any[]) => c[0] as string,
        );
        for (const query of queries) {
          expect(query).not.toContain('other-team');
          expect(query).not.toContain('=~".+');
        }
      },
    );

    it('rejects an invalid pipeline, host or app with 400', async () => {
      await expect(
        service.getHttpStatusCodesMetrics({
          ...base,
          host: 'x"} or {a="b',
        } as any),
      ).rejects.toThrow('Invalid host');
      await expect(
        service.getMemoryMetrics({ ...base, app: 'bad app' } as any),
      ).rejects.toThrow('Invalid app');
      await expect(
        service.getCPUMetrics({ ...base, pipeline: 'a"b' } as any),
      ).rejects.toThrow('Invalid pipeline');
    });

    it('only accepts rate or increase as calc (anything else becomes rate)', async () => {
      await service.getCPUMetrics({ ...base, calc: 'sum(' } as any);
      expect(lastQuery().startsWith('rate(')).toBe(true);
      await service.getCPUMetrics({ ...base, calc: 'increase' } as any);
      expect(lastQuery().startsWith('increase(')).toBe(true);
      await service.getHttpStatusCodesMetrics({
        ...base,
        calc: 'count({__name__=~".+"}) or rate',
      } as any);
      expect(lastQuery().startsWith('rate(')).toBe(true);
      expect(lastQuery()).not.toContain('__name__');
    });

    it('returns only the most recent pod series when a range has dozens', async () => {
      const many = Array.from({ length: 96 }, (_, i) => ({
        metric: { labels: { pod: 'pod-' + String(i).padStart(3, '0') } },
        // el pod i vivió hasta el minuto i: pod-095 es el más reciente
        values: [
          {
            time: new Date(Date.UTC(2026, 8, 24, 0, i)).toISOString(),
            value: i,
          },
        ],
      }));
      (service as any).prom.rangeQuery.mockResolvedValueOnce({ result: many });
      const res = await service.getMemoryMetrics(base as any);
      expect(res).toHaveLength(12);
      expect(res[0].name).toBe('pod-095');
      expect(res.map((r) => r.name)).not.toContain('pod-000');
    });

    it('does not limit series that are few', async () => {
      (service as any).prom.rangeQuery.mockResolvedValueOnce({
        result: [
          {
            metric: { labels: { pod: 'a' } },
            values: [{ time: '2026-09-24T00:00:00Z', value: 1 }],
          },
          {
            metric: { labels: { pod: 'b' } },
            values: [{ time: '2026-09-24T00:01:00Z', value: 2 }],
          },
        ],
      });
      const res = await service.getCPUMetrics(base as any);
      expect(res.map((r) => r.name).sort()).toEqual(['a', 'b']);
    });
  });
});
