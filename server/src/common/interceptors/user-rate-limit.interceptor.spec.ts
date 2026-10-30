import { HttpException } from '@nestjs/common';
import { of } from 'rxjs';
import { UserRateLimitInterceptor } from './user-rate-limit.interceptor';

describe('UserRateLimitInterceptor', () => {
  const { BURST, PER_SECOND } = UserRateLimitInterceptor;
  let limiter: UserRateLimitInterceptor;
  const next = { handle: jest.fn(() => of('ok')) };

  const httpContext = (user: any, res: any = { setHeader: jest.fn() }) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => res,
      }),
    }) as any;

  beforeEach(() => {
    limiter = new UserRateLimitInterceptor();
    next.handle.mockClear();
  });

  it('lets a burst through and rejects the next request', () => {
    const now = 1_000_000;
    for (let i = 0; i < BURST; i++) {
      expect(limiter.take('u1', now)).toBe(0);
    }
    expect(limiter.take('u1', now)).toBeGreaterThan(0);
  });

  it('refills at the sustained rate', () => {
    const now = 1_000_000;
    for (let i = 0; i < BURST; i++) limiter.take('u1', now);
    expect(limiter.take('u1', now)).toBeGreaterThan(0);
    // un segundo después hay PER_SECOND fichas nuevas
    for (let i = 0; i < PER_SECOND; i++) {
      expect(limiter.take('u1', now + 1000)).toBe(0);
    }
    expect(limiter.take('u1', now + 1000)).toBeGreaterThan(0);
  });

  it('holds a scan at the observed pace (~17 per second) to the sustained rate', () => {
    // 20 minutos, como el escaneo del 30 de octubre
    const seconds = 20 * 60;
    let accepted = 0;
    for (let i = 0; i < 17 * seconds; i++) {
      if (limiter.take('scanner', 1_000_000 + (i * 1000) / 17) === 0)
        accepted++;
    }
    expect(accepted).toBeLessThanOrEqual(BURST + seconds * PER_SECOND + 1);
    expect(accepted).toBeLessThan(17 * seconds * 0.65);
  });

  it('keeps users independent', () => {
    const now = 1_000_000;
    for (let i = 0; i < BURST; i++) limiter.take('u1', now);
    expect(limiter.take('u1', now)).toBeGreaterThan(0);
    expect(limiter.take('u2', now)).toBe(0);
  });

  it('answers 429 with Retry-After once the user is over the limit', () => {
    const res = { setHeader: jest.fn() };
    for (let i = 0; i < BURST; i++) {
      limiter.intercept(httpContext({ userId: 'u1' }, res), next);
    }
    let error: any;
    try {
      limiter.intercept(httpContext({ userId: 'u1' }, res), next);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(Number),
    );
    expect(next.handle).toHaveBeenCalledTimes(BURST);
  });

  it('does not count requests without a session', () => {
    for (let i = 0; i < BURST * 2; i++) {
      limiter.intercept(httpContext(undefined), next);
    }
    expect(next.handle).toHaveBeenCalledTimes(BURST * 2);
  });

  it('ignores WebSocket and other non-HTTP contexts', () => {
    const ws = { getType: () => 'ws' } as any;
    for (let i = 0; i < BURST * 2; i++) limiter.intercept(ws, next);
    expect(next.handle).toHaveBeenCalledTimes(BURST * 2);
  });
});
