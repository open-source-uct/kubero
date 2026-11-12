import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppValidationDto } from './app-validation.dto';
import { flattenValidationErrors } from '../../common/utils/validation.util';

const run = async (app: object) =>
  flattenValidationErrors(
    await validate(plainToInstance(AppValidationDto, app)),
  );

const postgres = (name: string, auth: object, resources?: object) => ({
  kind: 'KuberoAddonPostgres',
  resourceDefinitions: {
    KuberoAddonPostgres: {
      metadata: { name },
      spec: { postgres: { auth, resources } },
    },
  },
});

describe('AppValidationDto envVars', () => {
  it('accepts an app without envVars or with unique, non-reserved names', async () => {
    expect(await run({})).toEqual([]);
    expect(
      await run({
        envVars: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'DATABASE_URL', value: 'x' },
        ],
      }),
    ).toEqual([]);
  });

  it('rejects PORT, which Kubero derives from the container port', async () => {
    const errors = await run({ envVars: [{ name: 'PORT', value: '8080' }] });
    expect(errors.join(' ')).toContain('PORT');
  });

  it.each([
    'PROC_TYPE',
    'GIT_REPOSITORY',
    'GIT_BRANCH',
    'GIT_REF',
    'KUBERO_BUILDPACK_DEFAULT_BUILD_CMD',
    'KUBERO_BUILDPACK_DEFAULT_RUN_CMD',
  ])('rejects the reserved variable %s', async (name) => {
    const errors = await run({ envVars: [{ name, value: 'x' }] });
    expect(errors.join(' ')).toContain(name);
  });

  it('rejects a duplicated variable and names it', async () => {
    const errors = await run({
      envVars: [
        { name: 'USER_APPROVAL_REQUIRED', value: 'a' },
        { name: 'USER_APPROVAL_REQUIRED', value: 'b' },
      ],
    });
    expect(errors).toEqual([
      'La variable USER_APPROVAL_REQUIRED está repetida',
    ]);
  });
});

describe('AppValidationDto addons', () => {
  const okAuth = {
    enablePostgresUser: true,
    postgresPassword: 'p1',
    username: 'todo_user',
    database: 'todo_db',
    password: 'p2',
  };

  it('accepts an app without addons and a well-formed postgres addon', async () => {
    expect(await run({ addons: [] })).toEqual([]);
    expect(
      await run({ addons: [postgres('server-postgres', okAuth)] }),
    ).toEqual([]);
  });

  it('accepts addons of other kinds without auth checks', async () => {
    expect(
      await run({
        addons: [
          {
            kind: 'KuberoAddonRedis',
            resourceDefinitions: {
              KuberoAddonRedis: { metadata: { name: 'app-redis' }, spec: {} },
            },
          },
        ],
      }),
    ).toEqual([]);
  });

  it.each([
    'nosexd-server-postgres nosexd-server',
    'Server-Postgres',
    'server_postgres',
    '-server',
    'a'.repeat(64),
  ])('rejects the invalid addon name %j', async (name) => {
    const errors = await run({ addons: [postgres(name, okAuth)] });
    expect(errors.join(' ')).toContain('no es válido');
  });

  it('requires the postgres password when the postgres user is enabled', async () => {
    const errors = await run({
      addons: [postgres('db', { ...okAuth, postgresPassword: '' })],
    });
    expect(errors.join(' ')).toContain('usuario postgres');
  });

  it('does not require the postgres password when that user is disabled', async () => {
    expect(
      await run({
        addons: [
          postgres('db', {
            ...okAuth,
            enablePostgresUser: false,
            postgresPassword: '',
          }),
        ],
      }),
    ).toEqual([]);
  });

  it('requires a password when an extra user and database are created', async () => {
    const errors = await run({
      addons: [postgres('db', { ...okAuth, password: '' })],
    });
    expect(errors.join(' ')).toContain('todo_user');
  });

  it('does not require a user password when no extra user is created', async () => {
    expect(
      await run({
        addons: [postgres('db', { ...okAuth, username: '', password: '' })],
      }),
    ).toEqual([]);
  });

  describe('recursos del addon de PostgreSQL (#224)', () => {
    const resources = (
      requests: Record<string, string>,
      limits: Record<string, string>,
    ) => ({ requests, limits });

    it('accepts the default resources and an addon without resources', async () => {
      expect(
        await run({
          addons: [
            postgres(
              'db',
              okAuth,
              resources(
                { cpu: '50m', memory: '128Mi' },
                { cpu: '500m', memory: '512Mi' },
              ),
            ),
          ],
        }),
      ).toEqual([]);
      // los addons creados antes del cambio no traen resources
      expect(await run({ addons: [postgres('db', okAuth)] })).toEqual([]);
      expect(await run({ addons: [postgres('db', okAuth, {})] })).toEqual([]);
    });

    it('accepts equivalent notations (request equal to the limit)', async () => {
      expect(
        await run({
          addons: [
            postgres(
              'db',
              okAuth,
              resources(
                { cpu: '0.5', memory: '0.5Gi' },
                { cpu: '500m', memory: '512Mi' },
              ),
            ),
          ],
        }),
      ).toEqual([]);
    });

    it('rejects a value Kubernetes does not understand', async () => {
      const errors = await run({
        addons: [
          postgres(
            'db',
            okAuth,
            resources(
              { cpu: 'mucho', memory: '128Mi' },
              { cpu: '500m', memory: '512 MB' },
            ),
          ),
        ],
      });
      expect(errors.join(' ')).toContain('"mucho"');
      expect(errors.join(' ')).toContain('"512 MB"');
    });

    it('rejects a request above its limit', async () => {
      const errors = await run({
        addons: [
          postgres(
            'db',
            okAuth,
            resources(
              { cpu: '1', memory: '1Gi' },
              { cpu: '500m', memory: '512Mi' },
            ),
          ),
        ],
      });
      expect(errors.join(' ')).toContain('reserva de cpu');
      expect(errors.join(' ')).toContain('reserva de memory');
    });
  });
});
