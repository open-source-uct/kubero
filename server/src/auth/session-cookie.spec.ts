import {
  cookieToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './session-cookie';

describe('session cookies', () => {
  it('always uses HttpOnly, SameSite and a consistent root path', () => {
    expect(sessionCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('requires Secure in production even behind a TLS-terminating proxy', () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(sessionCookieOptions({ secure: false }).secure).toBe(true);
      process.env.NODE_ENV = 'development';
      expect(sessionCookieOptions({ secure: false }).secure).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('extracts the exact cookie name and handles malformed encoding without throwing', () => {
    expect(
      cookieToken({
        headers: { cookie: `other=x; ${SESSION_COOKIE}=signed%2Ejwt` },
      }),
    ).toBe('signed.jwt');
    expect(
      cookieToken({ headers: { cookie: `${SESSION_COOKIE}x=wrong` } }),
    ).toBeNull();
    expect(
      cookieToken({ headers: { cookie: `${SESSION_COOKIE}=%ZZ` } }),
    ).toBeNull();
    expect(
      cookieToken({ headers: { cookie: `${SESSION_COOKIE}=` } }),
    ).toBeNull();
  });

  it('restricts cookie mutations and websocket handshakes to the same origin', () => {
    const req = {
      method: 'POST',
      headers: {
        host: 'kubero.test',
        origin: 'https://kubero.test',
        cookie: `${SESSION_COOKIE}=jwt`,
      },
    };
    expect(cookieToken(req)).toBe('jwt');
    for (const origin of [
      'https://attacker.test',
      'https://kubero.test.attacker.test',
      'invalid',
    ]) {
      expect(
        cookieToken({ ...req, headers: { ...req.headers, origin } }),
      ).toBeNull();
    }
    expect(
      cookieToken({
        headers: { ...req.headers, 'sec-fetch-site': 'cross-site' },
      }),
    ).toBeNull();
    expect(
      cookieToken({ ...req, headers: { ...req.headers, origin: undefined } }),
    ).toBeNull();
  });
});
