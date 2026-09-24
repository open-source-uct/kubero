import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

/**
 * Secreto con el que se firman los JWT.
 *
 * Antes, sin JWT_SECRET, se usaba un valor escrito en el código fuente (que es
 * público en el repositorio): cualquiera podía fabricar un token válido. El
 * despliegue por defecto no define JWT_SECRET, así que ese era el caso normal.
 *
 * Orden de preferencia:
 * 1. JWT_SECRET, si está definido.
 * 2. Un secreto derivado de KUBERO_SESSION_KEY, que sí es propio de cada
 *    instalación. Es estable entre reinicios, así que los tokens personales
 *    siguen valiendo.
 * 3. Uno aleatorio generado al arrancar (los tokens dejan de valer al reiniciar).
 */

const logger = new Logger('JwtSecret');
let cached: string | undefined;

export function getJwtSecret(): string {
  if (cached) {
    return cached;
  }
  dotenv.config();

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  const sessionKey = process.env.KUBERO_SESSION_KEY;
  if (sessionKey) {
    logger.warn(
      'JWT_SECRET is not set: deriving the signing key from KUBERO_SESSION_KEY. Set JWT_SECRET explicitly.',
    );
    cached = crypto
      .createHmac('sha256', sessionKey)
      .update('kubero-jwt-signing-key-v1')
      .digest('hex');
    return cached;
  }

  logger.error(
    'Neither JWT_SECRET nor KUBERO_SESSION_KEY is set: using a random signing key. Sessions and tokens will be invalid after a restart.',
  );
  cached = crypto.randomBytes(32).toString('hex');
  return cached;
}

// solo para los tests
export function resetJwtSecretCache(): void {
  cached = undefined;
}
