import * as http from 'http';
import { AddressInfo } from 'net';
import { BitbucketClient, BitbucketRequestError } from './bitbucket-client';
import { BitbucketApi } from './bitbucket';

// Servidor local que hace de API de Bitbucket: anota cada petición y responde
// con el estado que indique la prueba.
describe('BitbucketClient', () => {
  let server: http.Server;
  let baseUrl: string;
  let seen: { method?: string; url?: string; auth?: string; body: string }[];
  let status: number;

  beforeEach(async () => {
    seen = [];
    status = 200;
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        seen.push({
          method: req.method,
          url: req.url,
          auth: req.headers.authorization,
          body,
        });
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ values: [{ name: 'main' }] }));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/2.0`;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it('sends the same requests as the old bitbucket library', async () => {
    const client = new BitbucketClient(
      { username: 'usuario', password: 'clave-app' },
      baseUrl,
    );
    await client.getRepository('ws', 'repo');
    await client.listWebhooks('ws', 'repo');
    await client.createWebhook('ws', 'repo', { url: 'https://k/hook' });
    await client.createDeployKey('ws', 'repo', 'bot@kubero', 'ssh-ed25519 A');
    await client.listRepositories('member');
    await client.listBranches('ws', 'repo', '-name');
    await client.listTags('ws', 'repo', '-name');
    await client.listCommits('ws', 'repo', '-date');

    expect(seen.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /2.0/repositories/ws/repo',
      'GET /2.0/repositories/ws/repo/hooks',
      'POST /2.0/repositories/ws/repo/hooks',
      'POST /2.0/repositories/ws/repo/deploy-keys',
      'GET /2.0/repositories?role=member',
      'GET /2.0/repositories/ws/repo/refs/branches?sort=-name',
      'GET /2.0/repositories/ws/repo/refs/tags?sort=-name',
      'GET /2.0/repositories/ws/repo/commits?sort=-date',
    ]);
    const basic =
      'Basic ' + Buffer.from('usuario:clave-app').toString('base64');
    expect(seen.every((r) => r.auth === basic)).toBe(true);
    expect(JSON.parse(seen[2].body)).toEqual({ url: 'https://k/hook' });
    expect(JSON.parse(seen[3].body)).toEqual({
      label: 'bot@kubero',
      key: 'ssh-ed25519 A',
    });
  });

  it('does not send credentials when Bitbucket is not configured', async () => {
    await new BitbucketClient(undefined, baseUrl).getRepository('ws', 'repo');
    expect(seen[0].auth).toBeUndefined();
  });

  it('keeps the workspace and repository inside their path segment', async () => {
    await new BitbucketClient(undefined, baseUrl).getRepository(
      '../ws',
      'repo?x=1',
    );
    expect(seen[0].url).toBe('/2.0/repositories/..%2Fws/repo%3Fx%3D1');
  });

  it('rejects with the HTTP status of the error', async () => {
    status = 404;
    const error = await new BitbucketClient(undefined, baseUrl)
      .getRepository('ws', 'repo')
      .catch((e) => e);
    expect(error).toBeInstanceOf(BitbucketRequestError);
    expect(error.status).toBe(404);
  });

  it('BitbucketApi reports a missing repository as not found', async () => {
    status = 404;
    const api = new BitbucketApi('user', 'password');
    api['bitbucket'] = new BitbucketClient(undefined, baseUrl);
    const res = await api['getRepository']('git@bitbucket.org:ws/repo.git');
    expect(res).toMatchObject({
      status: 404,
      statusText: 'not found',
      data: { owner: 'ws', name: 'repo' },
    });
  });

  it('BitbucketApi lists the branches of a repository', async () => {
    const api = new BitbucketApi('user', 'password');
    api['bitbucket'] = new BitbucketClient(undefined, baseUrl);
    await expect(
      api.getBranches('git@bitbucket.org:ws/repo.git'),
    ).resolves.toEqual(['main']);
  });
});
