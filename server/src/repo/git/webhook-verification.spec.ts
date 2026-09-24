import * as crypto from 'crypto';
import { BitbucketApi } from './bitbucket';
import { GiteaApi } from './gitea';
import { GithubApi } from './github';
import { GitlabApi } from './gitlab';
import { GogsApi } from './gogs';

jest.mock('@octokit/core', () => ({
  Octokit: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));

jest.mock('git-url-parse', () =>
  jest.fn(() => ({ name: 'repo', owner: 'owner' })),
);

/**
 * Los webhooks son un endpoint público que dispara rebuilds y crea o borra
 * apps, así que la verificación tiene que ser estricta en los cinco
 * proveedores: firma o token válido obligatorio, secreto obligatorio y nada
 * sensible en los logs.
 */
describe('webhook verification', () => {
  const SECRET = 'test-webhook-secret';
  const original = process.env.KUBERO_WEBHOOK_SECRET;

  const hmac = (payload: string | Buffer, prefix = '', secret = SECRET) =>
    prefix + crypto.createHmac('sha256', secret).update(payload).digest('hex');

  beforeEach(() => {
    process.env.KUBERO_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    if (original === undefined) {
      delete process.env.KUBERO_WEBHOOK_SECRET;
    } else {
      process.env.KUBERO_WEBHOOK_SECRET = original;
    }
  });

  const pushBody = {
    ref: 'refs/heads/main',
    repository: { ssh_url: 'ssh://repo' },
    project: { git_ssh_url: 'ssh://repo' },
  };

  // proveedor, cómo se firma y cómo se llama a getWebhook
  const hmacProviders: Array<{
    name: string;
    api: () => any;
    prefix: string;
    pretty: boolean;
    event: string;
  }> = [
    {
      name: 'github',
      api: () => new GithubApi('https://api.github.com', 'token'),
      prefix: 'sha256=',
      pretty: false,
      event: 'push',
    },
    {
      name: 'gitea',
      api: () => new GiteaApi('https://gitea.example', 'token'),
      prefix: 'sha256=',
      pretty: true,
      event: 'push',
    },
    {
      name: 'gogs',
      api: () => new GogsApi('http://gogs.example', 'token'),
      prefix: '',
      pretty: true,
      event: 'push',
    },
    {
      name: 'bitbucket',
      api: () => new BitbucketApi('user', 'password'),
      prefix: 'sha256=',
      pretty: false,
      event: 'repo:push',
    },
  ];

  describe.each(hmacProviders)('$name', ({ api, prefix, pretty, event }) => {
    const serialize = (b: any) =>
      pretty ? JSON.stringify(b, null, '  ') : JSON.stringify(b);

    it('accepts a valid signature', () => {
      const res = api().getWebhook(
        event,
        'd1',
        hmac(serialize(pushBody), prefix),
        pushBody,
      );
      expect(res).toHaveProperty('verified', true);
    });

    it('verifies against the raw body when there is one', () => {
      // el cuerpo crudo no coincide con JSON.stringify(body): con caracteres
      // escapados la reserialización daba una firma distinta
      const raw = Buffer.from(
        '{"ref":"refs/heads/main","repository":{"ssh_url":"ssh://repo"},"note":"\\u003cx\\u003e"}',
      );
      const res = api().getWebhook(
        event,
        'd1',
        hmac(raw, prefix),
        pushBody,
        raw,
      );
      expect(res).toHaveProperty('verified', true);
    });

    it('rejects a wrong signature and a tampered body', () => {
      const good = hmac(serialize(pushBody), prefix);
      expect(api().getWebhook(event, 'd1', 'nope', pushBody)).toBe(false);
      expect(
        api().getWebhook(event, 'd1', good, { ...pushBody, ref: 'refs/x' }),
      ).toBe(false);
    });

    it('rejects a missing signature', () => {
      expect(api().getWebhook(event, 'd1', undefined, pushBody)).toBe(false);
    });

    it('rejects everything when KUBERO_WEBHOOK_SECRET is not set', () => {
      delete process.env.KUBERO_WEBHOOK_SECRET;
      // firmado con la cadena vacía: antes createHmac aceptaba ese secreto
      const forged = hmac(serialize(pushBody), prefix, '');
      expect(api().getWebhook(event, 'd1', forged, pushBody)).toBe(false);
      expect(api().getWebhook(event, 'd1', undefined, pushBody)).toBe(false);
    });

    it('never writes the secret or the expected signature to the log', () => {
      const instance = api();
      const spy = jest
        .spyOn(instance.logger, 'log')
        .mockImplementation(() => undefined);
      instance.getWebhook(event, 'd1', 'wrong', pushBody);
      const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('invalid signature');
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toContain(hmac(serialize(pushBody), prefix));
    });
  });

  describe('gitlab', () => {
    const gitlab = () => new GitlabApi('https://gitlab.example', 'token');

    it('accepts the exact token', () => {
      const res = gitlab().getWebhook('Push Hook', 'd1', SECRET, pushBody);
      expect(res).toHaveProperty('verified', true);
    });

    it('rejects a wrong or missing token', () => {
      expect(gitlab().getWebhook('Push Hook', 'd1', 'nope', pushBody)).toBe(
        false,
      );
      expect(
        gitlab().getWebhook('Push Hook', 'd1', undefined as any, pushBody),
      ).toBe(false);
    });

    it('does not accept a request without token when the secret is not set (undefined === undefined)', () => {
      delete process.env.KUBERO_WEBHOOK_SECRET;
      expect(
        gitlab().getWebhook('Push Hook', 'd1', undefined as any, pushBody),
      ).toBe(false);
    });

    it('never writes the secret or the received token to the log', () => {
      const instance = gitlab();
      const spy = jest
        .spyOn((instance as any).logger, 'log')
        .mockImplementation(() => undefined);
      instance.getWebhook('Push Hook', 'd1', 'attacker-guess', pushBody);
      const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toContain('attacker-guess');
    });
  });
});
