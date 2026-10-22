import * as crypto from 'crypto';

// Kubero no usa sesiones de servidor (autenticación 100% JWT), así que el
// store por defecto de passport-oauth2 para el parámetro "state" (que
// necesita req.session) no sirve acá. Este store firma el state con HMAC y
// lo valida sin guardar nada en el servidor: evita CSRF en el callback de
// OAuth sin necesitar sesiones.
export class StatelessOauthStateStore {
  private readonly ttlMs = 5 * 60 * 1000; // tiempo máximo para completar el login

  private sign(payload: string): string {
    const secret =
      process.env.KUBERO_SESSION_KEY ||
      process.env.JWT_SECRET ||
      'kubero-oauth-state';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // Dos firmas (con y sin "meta") para calzar con la interfaz StateStore de
  // @types/passport-oauth2 — passport-oauth2 decide cuál usar mirando
  // `.length`, que acá sigue siendo 2 porque los parámetros extra son
  // opcionales (no cuentan para la arity).
  store(
    _req: unknown,
    callback: (err: Error | null, state?: string) => void,
  ): void;
  store(
    _req: unknown,
    meta: unknown,
    callback: (err: Error | null, state?: string) => void,
  ): void;
  store(
    _req: unknown,
    metaOrCallback: unknown,
    maybeCallback?: (err: Error | null, state?: string) => void,
  ) {
    const callback =
      maybeCallback ??
      (metaOrCallback as (err: Error | null, state?: string) => void);
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${nonce}.${Date.now()}`;
    callback(null, `${payload}.${this.sign(payload)}`);
  }

  verify(
    _req: unknown,
    state: string,
    callback: (err: Error | null, ok?: boolean, info?: string) => void,
  ): void;
  verify(
    _req: unknown,
    state: string,
    meta: unknown,
    callback: (err: Error | null, ok?: boolean, info?: string) => void,
  ): void;
  verify(
    _req: unknown,
    state: string,
    metaOrCallback: unknown,
    maybeCallback?: (err: Error | null, ok?: boolean, info?: string) => void,
  ) {
    const callback =
      maybeCallback ??
      (metaOrCallback as (
        err: Error | null,
        ok?: boolean,
        info?: string,
      ) => void);
    const parts = typeof state === 'string' ? state.split('.') : [];
    if (parts.length !== 3) {
      return callback(null, false, 'Invalid state');
    }
    const [nonce, issuedAtRaw, signature] = parts;
    const payload = `${nonce}.${issuedAtRaw}`;
    if (signature !== this.sign(payload)) {
      return callback(null, false, 'Invalid state signature');
    }
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > this.ttlMs) {
      return callback(null, false, 'Expired state');
    }
    callback(null, true);
  }
}
