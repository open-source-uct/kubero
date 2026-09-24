import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Límite de intentos fallidos de login, en memoria.
 *
 * Antes no había ninguno: se podía probar contraseñas sin freno. Se cuentan
 * solo los fallos, y un login correcto borra el contador de ese usuario.
 *
 * Dos claves, porque detrás de un ingress todos los clientes pueden compartir
 * la IP del proxy y una sola clave por IP bloquearía a todos:
 * - IP + usuario: pocos intentos, frena al que insiste sobre una cuenta.
 * - usuario: más holgado, frena el ataque repartido en varias IP.
 * El costo es que quien falla muchas veces con un usuario ajeno puede
 * bloquearlo unos minutos; se acepta a cambio de frenar la fuerza bruta.
 */
@Injectable()
export class LoginThrottleService {
  static readonly WINDOW_MS = 15 * 60 * 1000;
  static readonly MAX_PER_IP_AND_USER = 8;
  static readonly MAX_PER_USER = 40;
  private static readonly MAX_TRACKED = 10000;

  private failures = new Map<string, number[]>();

  private keys(ip: string, username: string): [string, string] {
    const user = (username ?? '').toString().toLowerCase().slice(0, 200);
    return [`ip-user:${ip}|${user}`, `user:${user}`];
  }

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter(
      (t) => now - t < LoginThrottleService.WINDOW_MS,
    );
    if (list.length === 0) {
      this.failures.delete(key);
    } else {
      this.failures.set(key, list);
    }
    return list;
  }

  // Lanza 429 si el usuario o la pareja IP+usuario superaron el límite.
  assertAllowed(ip: string, username: string, now = Date.now()): void {
    const [pair, user] = this.keys(ip, username);
    const limits: Array<[string, number]> = [
      [pair, LoginThrottleService.MAX_PER_IP_AND_USER],
      [user, LoginThrottleService.MAX_PER_USER],
    ];
    for (const [key, max] of limits) {
      const list = this.recent(key, now);
      if (list.length >= max) {
        const retryAfter = Math.ceil(
          (list[0] + LoginThrottleService.WINDOW_MS - now) / 1000,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many failed login attempts. Try again later.',
            retryAfterSeconds: Math.max(retryAfter, 1),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(ip: string, username: string, now = Date.now()): void {
    if (this.failures.size >= LoginThrottleService.MAX_TRACKED) {
      // memoria acotada: se descartan las entradas vencidas
      for (const key of [...this.failures.keys()]) {
        this.recent(key, now);
      }
    }
    for (const key of this.keys(ip, username)) {
      const list = this.recent(key, now);
      list.push(now);
      this.failures.set(key, list);
    }
  }

  // Un login correcto limpia los fallos de esa pareja y de ese usuario.
  reset(ip: string, username: string): void {
    for (const key of this.keys(ip, username)) {
      this.failures.delete(key);
    }
  }
}
