import * as http from 'http';
import { AddressInfo } from 'net';
import { PassThrough } from 'stream';
import { KubeConfig, Log } from '@kubernetes/client-node';
import { liveLogOptions } from './logs.service';

// Con la librería real: la URL que llega a Kubernetes es la que decide si el
// stream en vivo trae el historial completo del contenedor o solo lo nuevo.
describe('liveLogOptions con @kubernetes/client-node', () => {
  let server: http.Server;
  let requested: URL[];
  let log: Log;

  beforeEach(async () => {
    requested = [];
    server = http.createServer((req, res) => {
      requested.push(new URL(req.url ?? '/', 'http://kube'));
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('linea\n');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const kc = new KubeConfig();
    kc.loadFromOptions({
      clusters: [
        {
          name: 'local',
          server: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          skipTLSVerify: true,
        },
      ],
      users: [{ name: 'u', token: 't' }],
      contexts: [{ name: 'local', cluster: 'local', user: 'u' }],
      currentContext: 'local',
    });
    log = new Log(kc);
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  const query = async (options: object) => {
    await log.log('ns', 'pod', 'web', new PassThrough(), options);
    return requested[requested.length - 1].searchParams;
  };

  it('opens the live stream without the container history (tailLines=0)', async () => {
    const params = await query(liveLogOptions());
    expect(params.get('tailLines')).toBe('0');
    expect(params.get('follow')).toBe('true');
    expect(params.has('sinceSeconds')).toBe(false);
  });

  it('resumes a cut stream from a few seconds ago, without tailLines', async () => {
    const params = await query(liveLogOptions(30));
    expect(params.get('sinceSeconds')).toBe('30');
    expect(params.has('tailLines')).toBe(false);
  });
});
