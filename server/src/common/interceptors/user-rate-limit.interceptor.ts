import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Límite de solicitudes por usuario autenticado, en memoria.
 *
 * Antes un usuario con sesión válida podía hacer todas las solicitudes que
 * quisiera: un script probó unas 23.000 rutas en 20 minutos (~17 por
 * segundo), y la API completa atiende unas 67 por segundo. Cada usuario tiene
 * un balde de fichas: puede gastar una ráfaga (cargar una página dispara
 * varias solicitudes a la vez) y el balde se rellena a un ritmo sostenido muy
 * por encima del uso normal de la interfaz.
 *
 * Corre después de los guards, así que solo cuenta solicitudes ya
 * autenticadas; login y "olvidé mi contraseña" tienen su propio límite.
 */
@Injectable()
export class UserRateLimitInterceptor implements NestInterceptor {
  static readonly BURST = 120;
  static readonly PER_SECOND = 10;
  private static readonly MAX_TRACKED = 10000;

  private buckets = new Map<string, { tokens: number; updated: number }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest();
    const userId = req?.user?.userId;
    if (userId === undefined || userId === null) {
      return next.handle();
    }
    const waitSeconds = this.take(String(userId));
    if (waitSeconds > 0) {
      context
        .switchToHttp()
        .getResponse()
        ?.setHeader?.('Retry-After', waitSeconds);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Demasiadas solicitudes seguidas. Espera unos segundos e inténtalo de nuevo.',
          retryAfterSeconds: waitSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return next.handle();
  }

  // Gasta una ficha del usuario. Devuelve 0 si alcanzó, o los segundos que
  // faltan para tener una disponible.
  take(key: string, now = Date.now()): number {
    const { BURST, PER_SECOND, MAX_TRACKED } = UserRateLimitInterceptor;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= MAX_TRACKED) {
        this.dropFullBuckets(now);
      }
      bucket = { tokens: BURST, updated: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = Math.max(0, now - bucket.updated) / 1000;
    bucket.tokens = Math.min(BURST, bucket.tokens + elapsed * PER_SECOND);
    bucket.updated = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / PER_SECOND));
  }

  // memoria acotada: un balde que ya se rellenó entero equivale a no tenerlo
  private dropFullBuckets(now: number) {
    const { BURST, PER_SECOND } = UserRateLimitInterceptor;
    for (const [key, bucket] of this.buckets) {
      const refilled =
        bucket.tokens + ((now - bucket.updated) / 1000) * PER_SECOND;
      if (refilled >= BURST) {
        this.buckets.delete(key);
      }
    }
  }
}
