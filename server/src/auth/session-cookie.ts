import { CookieOptions } from 'express';

export const SESSION_COOKIE = 'kubero.JWT_TOKEN';

export function sessionCookieOptions(req: any): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req?.secure === true,
    sameSite: 'lax',
    path: '/',
  };
}

// Shared by HTTP and Socket.IO; no cookie-parser dependency is needed.
export function cookieToken(req: any): string | null {
  const headers = req?.headers ?? {};
  // Keep the legacy GET logout route for Bearer clients only. Browser logout
  // must use POST so a navigation cannot revoke a session through CSRF.
  if (req?.method === 'GET' && req?.path?.endsWith('/auth/logout')) return null;
  const origin = headers.origin;
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req?.method ?? 'GET');
  // Cookie authentication is only for the same-origin browser UI. Bearer
  // authentication remains available to API/CLI clients without an Origin.
  if (headers['sec-fetch-site'] === 'cross-site') return null;
  if (origin) {
    try {
      if (new URL(origin).host !== headers.host) return null;
    } catch {
      return null;
    }
  } else if (unsafe) {
    return null;
  }
  const entries = (headers.cookie ?? '').split(';');
  const prefix = `${SESSION_COOKIE}=`;
  const value = entries
    .map((s: string) => s.trim())
    .find((s: string) => s.startsWith(prefix));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(prefix.length)) || null;
  } catch {
    return null;
  }
}
