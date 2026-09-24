import { getJwtSecret, resetJwtSecretCache } from './jwt-secret';

// dotenv.config() dentro del helper cargaría el .env local y taparía el caso
jest.mock('dotenv', () => ({ config: jest.fn() }));

const KNOWN_DEFAULT =
  'DO NOT USE THIS VALUE. INSTEAD, CREATE A COMPLEX SECRET AND KEEP IT SAFE OUTSIDE OF THE SOURCE CODE.';

describe('getJwtSecret', () => {
  const saved = {
    jwt: process.env.JWT_SECRET,
    session: process.env.KUBERO_SESSION_KEY,
  };

  beforeEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.KUBERO_SESSION_KEY;
    resetJwtSecretCache();
  });

  afterAll(() => {
    if (saved.jwt !== undefined) process.env.JWT_SECRET = saved.jwt;
    if (saved.session !== undefined)
      process.env.KUBERO_SESSION_KEY = saved.session;
    resetJwtSecretCache();
  });

  it('uses JWT_SECRET when it is set', () => {
    process.env.JWT_SECRET = 'from-env';
    expect(getJwtSecret()).toBe('from-env');
  });

  it('never falls back to the value that is public in the source code', () => {
    expect(getJwtSecret()).not.toBe(KNOWN_DEFAULT);
    resetJwtSecretCache();
    process.env.KUBERO_SESSION_KEY = 'some-installation-key';
    expect(getJwtSecret()).not.toBe(KNOWN_DEFAULT);
  });

  it('derives a stable secret from KUBERO_SESSION_KEY', () => {
    process.env.KUBERO_SESSION_KEY = 'some-installation-key';
    const first = getJwtSecret();
    resetJwtSecretCache();
    expect(getJwtSecret()).toBe(first);
    expect(first).toHaveLength(64);
    // y no es la clave de sesión tal cual
    expect(first).not.toBe('some-installation-key');
  });

  it('derives different secrets for different session keys', () => {
    process.env.KUBERO_SESSION_KEY = 'key-a';
    const a = getJwtSecret();
    resetJwtSecretCache();
    process.env.KUBERO_SESSION_KEY = 'key-b';
    expect(getJwtSecret()).not.toBe(a);
  });

  it('generates a random secret when nothing is configured', () => {
    const a = getJwtSecret();
    resetJwtSecretCache();
    const b = getJwtSecret();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it('keeps the same secret for the whole process once resolved', () => {
    const first = getJwtSecret();
    expect(getJwtSecret()).toBe(first);
  });
});
