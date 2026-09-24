import { HttpException } from '@nestjs/common';
import { LoginThrottleService } from './login-throttle.service';

describe('LoginThrottleService', () => {
  let throttle: LoginThrottleService;
  const T0 = 1_000_000;

  const fail = (ip: string, user: string, times: number, at = T0) => {
    for (let i = 0; i < times; i++) throttle.recordFailure(ip, user, at + i);
  };

  beforeEach(() => {
    throttle = new LoginThrottleService();
  });

  it('allows attempts under the limit', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER - 1);
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'ana', T0 + 100),
    ).not.toThrow();
  });

  it('blocks an IP+user pair after too many failures with a 429', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    let error: any;
    try {
      throttle.assertAllowed('1.1.1.1', 'ana', T0 + 100);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
  });

  it('does not block the same user from a different IP yet', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    expect(() =>
      throttle.assertAllowed('2.2.2.2', 'ana', T0 + 100),
    ).not.toThrow();
  });

  it('does not block other users behind the same IP (shared proxy)', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'luis', T0 + 100),
    ).not.toThrow();
  });

  it('blocks a user attacked from many IPs once the per-user limit is reached', () => {
    for (let i = 0; i < LoginThrottleService.MAX_PER_USER; i++) {
      throttle.recordFailure(`10.0.0.${i}`, 'ana', T0 + i);
    }
    expect(() => throttle.assertAllowed('9.9.9.9', 'ana', T0 + 1000)).toThrow(
      HttpException,
    );
  });

  it('forgets the failures once the window has passed', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    const later = T0 + LoginThrottleService.WINDOW_MS + 1000;
    expect(() => throttle.assertAllowed('1.1.1.1', 'ana', later)).not.toThrow();
  });

  it('a successful login clears the counters', () => {
    fail('1.1.1.1', 'ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    throttle.reset('1.1.1.1', 'ana');
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'ana', T0 + 100),
    ).not.toThrow();
  });

  it('treats usernames case-insensitively', () => {
    fail('1.1.1.1', 'Ana', LoginThrottleService.MAX_PER_IP_AND_USER);
    expect(() => throttle.assertAllowed('1.1.1.1', 'ANA', T0 + 100)).toThrow(
      HttpException,
    );
  });

  it('keeps memory bounded', () => {
    for (let i = 0; i < 12000; i++) {
      throttle.recordFailure('1.1.1.1', `user${i}`, T0);
    }
    // nada vence todavía, pero el mapa no debe crecer sin control al vencer
    const later = T0 + LoginThrottleService.WINDOW_MS + 1;
    throttle.recordFailure('1.1.1.1', 'nuevo', later);
    expect((throttle as any).failures.size).toBeLessThan(10);
  });
});
