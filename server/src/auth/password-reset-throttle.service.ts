import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Límite de pedidos de "olvidé mi contraseña", en memoria. Mismo patrón que
 * LoginThrottleService, pero más estricto: cada pedido manda un correo real,
 * así que sin límite alguien podría usarlo para bombardear la bandeja de
 * entrada de otra persona (o agotar la cuota del SMTP).
 *
 * Dos claves, igual que en login: IP+correo (frena a quien insiste sobre una
 * cuenta) y correo solo (frena aunque reparta los intentos en varias IP).
 */
@Injectable()
export class PasswordResetThrottleService {
  static readonly WINDOW_MS = 60 * 60 * 1000;
  static readonly MAX_PER_IP_AND_EMAIL = 3;
  static readonly MAX_PER_EMAIL = 5;
  private static readonly MAX_TRACKED = 10000;

  private attempts = new Map<string, number[]>();

  private keys(ip: string, email: string): [string, string] {
    const addr = (email ?? '').toString().trim().toLowerCase().slice(0, 200);
    return [`ip-email:${ip}|${addr}`, `email:${addr}`];
  }

  private recent(key: string, now: number): number[] {
    const list = (this.attempts.get(key) ?? []).filter(
      (t) => now - t < PasswordResetThrottleService.WINDOW_MS,
    );
    if (list.length === 0) {
      this.attempts.delete(key);
    } else {
      this.attempts.set(key, list);
    }
    return list;
  }

  // Lanza 429 si el correo o la pareja IP+correo superaron el límite.
  assertAllowed(ip: string, email: string, now = Date.now()): void {
    const [pair, addr] = this.keys(ip, email);
    const limits: Array<[string, number]> = [
      [pair, PasswordResetThrottleService.MAX_PER_IP_AND_EMAIL],
      [addr, PasswordResetThrottleService.MAX_PER_EMAIL],
    ];
    for (const [key, max] of limits) {
      const list = this.recent(key, now);
      if (list.length >= max) {
        const retryAfter = Math.ceil(
          (list[0] + PasswordResetThrottleService.WINDOW_MS - now) / 1000,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many password reset requests. Try again later.',
            retryAfterSeconds: Math.max(retryAfter, 1),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  record(ip: string, email: string, now = Date.now()): void {
    if (this.attempts.size >= PasswordResetThrottleService.MAX_TRACKED) {
      for (const key of [...this.attempts.keys()]) {
        this.recent(key, now);
      }
    }
    for (const key of this.keys(ip, email)) {
      const list = this.recent(key, now);
      list.push(now);
      this.attempts.set(key, list);
    }
  }
}
