import * as fs from 'fs';
import * as path from 'path';
import 'reflect-metadata';

/**
 * Contrato de autorización de la API.
 *
 * Recorre TODOS los controllers y comprueba que cada endpoint exige sesión
 * (JwtAuthGuard) y, salvo los que se listan explícitamente, un permiso
 * (@Permissions). Existe porque una auditoría encontró endpoints sin ningún
 * guard (notifications) y otros que solo pedían sesión (deployments, metrics,
 * kubernetes, repo...). Si agregas un endpoint público o "solo con sesión" tiene
 * que quedar escrito aquí, con su justificación.
 */

const GUARDS_METADATA = '__guards__';
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const PERMISSIONS_KEY = 'permissions';
const PERMISSIONS_ALL_KEY = 'permissions_all';

// Endpoints que deben ser públicos (sin sesión).
const PUBLIC: string[] = [
  'AuthController.login', // aún no hay sesión
  'AuthController.logout', // solo borra la cookie
  'AuthController.getMethods', // el login lo necesita para dibujarse
  'AuthController.github', // flujo OAuth (no se usa, pero lo maneja passport)
  'AuthController.githubCallback',
  'AuthController.oauth2',
  'AuthController.oauth2Callback',
  'RepoController.repositoryWebhook', // lo llama el proveedor git; se verifica por firma
  'StatusController.index', // health check
];

// Endpoints que solo exigen sesión, porque operan sobre el propio usuario o
// son datos que todo usuario logueado necesita para que la UI funcione.
const SESSION_ONLY: string[] = [
  'AuthController.session',
  'UsersController.getProfile',
  'UsersController.updateProfile',
  'UsersController.updateMyPassword',
  'UsersController.updateProfileAvatar',
  'ConfigController.getBanner',
];

function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...controllerFiles(full));
    } else if (/\.controller\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface Endpoint {
  id: string;
  guards: string[];
  hasPermissions: boolean;
}

function collect(): Endpoint[] {
  const endpoints: Endpoint[] = [];
  for (const file of controllerFiles(path.join(__dirname, '..'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file);
    for (const exported of Object.values<any>(mod)) {
      if (
        typeof exported !== 'function' ||
        !Reflect.getMetadata(PATH_METADATA, exported)
      ) {
        continue;
      }
      const classGuards: any[] =
        Reflect.getMetadata(GUARDS_METADATA, exported) ?? [];
      for (const name of Object.getOwnPropertyNames(exported.prototype)) {
        const handler = exported.prototype[name];
        if (
          name === 'constructor' ||
          typeof handler !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, handler) === undefined
        ) {
          continue;
        }
        const methodGuards: any[] =
          Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        const guards = [...classGuards, ...methodGuards].map((g) => g.name);
        const hasPermissions =
          !!(
            Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
            Reflect.getMetadata(PERMISSIONS_KEY, exported)
          )?.length ||
          !!(
            Reflect.getMetadata(PERMISSIONS_ALL_KEY, handler) ??
            Reflect.getMetadata(PERMISSIONS_ALL_KEY, exported)
          )?.length;
        endpoints.push({
          id: `${exported.name}.${name}`,
          guards,
          hasPermissions,
        });
      }
    }
  }
  return endpoints;
}

describe('API authorization contract', () => {
  const endpoints = collect();

  it('discovers the controllers', () => {
    // si esto falla, el test dejó de encontrar los endpoints y no protege nada
    expect(endpoints.length).toBeGreaterThan(60);
  });

  it('every non-public endpoint requires a session (JwtAuthGuard)', () => {
    const open = endpoints
      .filter((e) => !PUBLIC.includes(e.id))
      .filter((e) => !e.guards.includes('JwtAuthGuard'))
      .map((e) => e.id);
    expect(open).toEqual([]);
  });

  it('every non-public endpoint that needs authorization has a permission', () => {
    const noPermission = endpoints
      .filter((e) => !PUBLIC.includes(e.id) && !SESSION_ONLY.includes(e.id))
      .filter(
        (e) => !e.hasPermissions || !e.guards.includes('PermissionsGuard'),
      )
      .map((e) => e.id);
    expect(noPermission).toEqual([]);
  });

  it('the public and session-only lists only reference real endpoints', () => {
    const ids = endpoints.map((e) => e.id);
    const stale = [...PUBLIC, ...SESSION_ONLY].filter(
      (id) => !ids.includes(id),
    );
    expect(stale).toEqual([]);
  });
});
