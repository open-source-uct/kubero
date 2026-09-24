import * as crypto from 'crypto';

/**
 * Verificación de webhooks de los proveedores git.
 *
 * - La comparación es en tiempo constante (timingSafeEqual).
 * - Sin secreto configurado NO se verifica nada como válido: antes, con
 *   KUBERO_WEBHOOK_SECRET sin definir, el webhook de GitLab comparaba
 *   `undefined === undefined` y lo daba por bueno.
 * - Nunca se registra el secreto ni la firma esperada.
 */

export function webhookSecret(): string | undefined {
  const secret = process.env.KUBERO_WEBHOOK_SECRET;
  return secret && secret.length > 0 ? secret : undefined;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// HMAC-SHA256 del cuerpo. `prefix` es 'sha256=' en GitHub, Gitea y Bitbucket.
export function verifyHmacSha256(
  payload: string | Buffer,
  signature: string | undefined,
  secret: string | undefined,
  prefix: string = '',
): boolean {
  if (!secret || !signature || typeof signature !== 'string') {
    return false;
  }
  const expected =
    prefix + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return safeEqual(expected, signature);
}

// GitLab no firma: envía el secreto tal cual en X-Gitlab-Token.
export function verifySharedToken(
  token: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !token || typeof token !== 'string') {
    return false;
  }
  return safeEqual(token, secret);
}
