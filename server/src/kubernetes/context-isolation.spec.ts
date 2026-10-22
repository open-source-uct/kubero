import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import { PassThrough } from 'stream';
import { KubernetesService } from './kubernetes.service';

describe('Kubernetes context isolation', () => {
  let service: KubernetesService;
  let base: KubeConfig;

  beforeEach(() => {
    jest
      .spyOn(KubernetesService.prototype as any, 'initKubeConfig')
      .mockResolvedValue(undefined);
    service = new KubernetesService();
    base = new KubeConfig();
    base.loadFromOptions({
      clusters: ['control', 'a', 'b'].map((name) => ({
        name,
        server: `https://${name}.invalid`,
      })),
      users: ['control', 'a', 'b'].map((name) => ({
        name,
        token: `fake-${name}`,
      })),
      contexts: ['control', 'a', 'b'].map((name) => ({
        name,
        cluster: name,
        user: name,
      })),
      currentContext: 'control',
    });
    (service as any).kc = base;
  });
  afterEach(() => jest.restoreAllMocks());

  it('retains both cluster and credentials across interleaved asynchronous calls', async () => {
    const seen: any[] = [];
    let resume!: () => void;
    const barrier = new Promise<void>((resolve) => {
      resume = resolve;
    });
    jest
      .spyOn(KubeConfig.prototype, 'makeApiClient')
      .mockImplementation(function (this: KubeConfig, api: any): any {
        if (api === CoreV1Api)
          return {
            listNamespacedPod: async () => {
              if (this.getCurrentContext() === 'a') await barrier;
              seen.push([
                this.getCurrentCluster()?.server,
                this.getCurrentUser()?.token,
              ]);
              return { body: { items: [] } };
            },
          };
        return {};
      });
    const first = service.getPods('same-namespace', 'a');
    await service.getPods('same-namespace', 'b');
    resume();
    await first;
    expect(seen).toEqual([
      ['https://b.invalid', 'fake-b'],
      ['https://a.invalid', 'fake-a'],
    ]);
    expect(base.getCurrentContext()).toBe('control');
  });

  it('keeps both reads of a TLS secret copy on its original cluster', async () => {
    const previous = process.env.KUBERO_SHARED_TLS_SECRET_NAME;
    process.env.KUBERO_SHARED_TLS_SECRET_NAME = 'fake-cert';
    const seen: string[] = [];
    jest
      .spyOn(KubeConfig.prototype, 'makeApiClient')
      .mockImplementation(function (this: KubeConfig): any {
        return {
          readNamespacedSecret: jest
            .fn()
            .mockRejectedValueOnce(new Error('missing'))
            .mockImplementation(async () => {
              await service.getEvents('same-namespace', 'b');
              seen.push(this.getCurrentContext());
              return { body: { type: 'kubernetes.io/tls', data: {} } };
            }),
          listNamespacedEvent: async () => ({ body: { items: [] } }),
          createNamespacedSecret: async () => {
            seen.push(this.getCurrentContext());
          },
        };
      });
    try {
      await expect(
        service.ensureSharedTlsSecret('destination', 'a'),
      ).resolves.toBe('fake-cert');
      expect(seen).toEqual(['a', 'a']);
      expect(base.getCurrentContext()).toBe('control');
    } finally {
      if (previous === undefined)
        delete process.env.KUBERO_SHARED_TLS_SECRET_NAME;
      else process.env.KUBERO_SHARED_TLS_SECRET_NAME = previous;
    }
  });

  it('rejects an unknown context before any API call', async () => {
    const factory = jest.spyOn(base, 'makeApiClient');
    await expect(service.getPods('ns', 'missing')).rejects.toThrow(
      'Unknown kubernetes context',
    );
    expect(factory).not.toHaveBeenCalled();
    expect(base.getCurrentContext()).toBe('control');
  });

  it('passes dedicated output streams to exec instead of process stdout/stderr', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const exec = jest.fn().mockResolvedValue({});
    (service as any).exec = { exec };
    await service.execInContainer(
      'ns',
      'pod',
      'web',
      'sh',
      stdin,
      stdout,
      stderr,
    );
    expect(exec).toHaveBeenCalledWith(
      'ns',
      'pod',
      'web',
      'sh',
      stdout,
      stderr,
      stdin,
      true,
    );
    expect(exec.mock.calls[0]).not.toContain(process.stdout);
    expect(exec.mock.calls[0]).not.toContain(process.stderr);
  });
});
