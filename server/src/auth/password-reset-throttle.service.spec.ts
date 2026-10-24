import { HttpException } from '@nestjs/common';
import { PasswordResetThrottleService } from './password-reset-throttle.service';

describe('PasswordResetThrottleService', () => {
  let throttle: PasswordResetThrottleService;
  const T0 = 1_000_000;

  const attempt = (ip: string, email: string, times: number, at = T0) => {
    for (let i = 0; i < times; i++) throttle.record(ip, email, at + i);
  };

  beforeEach(() => {
    throttle = new PasswordResetThrottleService();
  });

  it('allows attempts under the limit', () => {
    attempt(
      '1.1.1.1',
      'ana@example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL - 1,
    );
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'ana@example.com', T0 + 100),
    ).not.toThrow();
  });

  it('blocks an IP+email pair after too many requests with a 429', () => {
    attempt(
      '1.1.1.1',
      'ana@example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL,
    );
    let error: any;
    try {
      throttle.assertAllowed('1.1.1.1', 'ana@example.com', T0 + 100);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
  });

  it('does not block the same email from a different IP yet', () => {
    attempt(
      '1.1.1.1',
      'ana@example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL,
    );
    expect(() =>
      throttle.assertAllowed('2.2.2.2', 'ana@example.com', T0 + 100),
    ).not.toThrow();
  });

  it('does not block other emails behind the same IP (shared proxy)', () => {
    attempt(
      '1.1.1.1',
      'ana@example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL,
    );
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'luis@example.com', T0 + 100),
    ).not.toThrow();
  });

  it('blocks an email bombarded from many IPs once the per-email limit is reached', () => {
    for (let i = 0; i < PasswordResetThrottleService.MAX_PER_EMAIL; i++) {
      throttle.record(`10.0.0.${i}`, 'ana@example.com', T0 + i);
    }
    expect(() =>
      throttle.assertAllowed('9.9.9.9', 'ana@example.com', T0 + 1000),
    ).toThrow(HttpException);
  });

  it('forgets attempts once the window has passed', () => {
    attempt(
      '1.1.1.1',
      'ana@example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL,
    );
    const later = T0 + PasswordResetThrottleService.WINDOW_MS + 1000;
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'ana@example.com', later),
    ).not.toThrow();
  });

  it('treats emails case-insensitively', () => {
    attempt(
      '1.1.1.1',
      'Ana@Example.com',
      PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL,
    );
    expect(() =>
      throttle.assertAllowed('1.1.1.1', 'ANA@EXAMPLE.COM', T0 + 100),
    ).toThrow(HttpException);
  });

  it('keeps memory bounded', () => {
    for (let i = 0; i < 12000; i++) {
      throttle.record('1.1.1.1', `user${i}@example.com`, T0);
    }
    const later = T0 + PasswordResetThrottleService.WINDOW_MS + 1;
    throttle.record('1.1.1.1', 'nuevo@example.com', later);
    expect((throttle as any).attempts.size).toBeLessThan(10);
  });
});
