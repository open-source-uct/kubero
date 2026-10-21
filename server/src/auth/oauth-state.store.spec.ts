import { StatelessOauthStateStore } from './oauth-state.store';

describe('StatelessOauthStateStore', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, KUBERO_SESSION_KEY: 'test-secret' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function store(): Promise<string> {
    return new Promise((resolve, reject) => {
      new StatelessOauthStateStore().store(undefined, (err, state) => {
        if (err || !state) return reject(err ?? new Error('no state'));
        resolve(state);
      });
    });
  }

  function verify(state: string): Promise<{ ok: boolean; info?: string }> {
    return new Promise((resolve, reject) => {
      new StatelessOauthStateStore().verify(
        undefined,
        state,
        (err, ok, info) => {
          if (err) return reject(err);
          resolve({ ok: !!ok, info });
        },
      );
    });
  }

  it('accepts a state it just issued', async () => {
    const state = await store();
    const result = await verify(state);
    expect(result.ok).toBe(true);
  });

  it('rejects a malformed state', async () => {
    const result = await verify('not-a-real-state');
    expect(result.ok).toBe(false);
    expect(result.info).toBe('Invalid state');
  });

  it('rejects a tampered signature', async () => {
    const state = await store();
    const [nonce, issuedAt] = state.split('.');
    const tampered = `${nonce}.${issuedAt}.deadbeef`;
    const result = await verify(tampered);
    expect(result.ok).toBe(false);
    expect(result.info).toBe('Invalid state signature');
  });

  it('rejects an expired state', async () => {
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000_000)
      .mockReturnValueOnce(1_000_000 + 6 * 60 * 1000);
    const state = await store();
    const result = await verify(state);
    expect(result.ok).toBe(false);
    expect(result.info).toBe('Expired state');
    dateSpy.mockRestore();
  });

  it('rejects a state signed with a different secret', async () => {
    const state = await store();
    process.env.KUBERO_SESSION_KEY = 'a-different-secret';
    const result = await verify(state);
    expect(result.ok).toBe(false);
  });
});
