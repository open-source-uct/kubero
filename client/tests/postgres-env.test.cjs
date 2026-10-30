const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadSource(relative) {
  const filename = resolve(__dirname, '..', relative)
  const loaded = new Module(filename)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  loaded._compile(outputText, filename)
  return loaded.exports
}

const {
  parsePostgresUrl,
  postgresConnections,
  addonPrefill,
  postgresEnvWarnings,
} = loadSource('src/utils/postgresEnv.ts')

const env = (vars) => Object.entries(vars).map(([name, value]) => ({ name, value }))
const pgAddon = (name, auth) => ({
  kind: 'KuberoAddonPostgres',
  resourceDefinitions: {
    KuberoAddonPostgres: { metadata: { name }, spec: { postgres: { auth } } },
  },
})
const keys = (warnings) => warnings.map((w) => w.key)

test('reads every part of a postgres URL, decoding special characters', () => {
  assert.deepEqual(parsePostgresUrl('postgresql://app%40uct:p%23ss@server-postgres:5432/notas'), {
    host: 'server-postgres',
    port: '5432',
    user: 'app@uct',
    password: 'p#ss',
    database: 'notas',
  })
  assert.equal(parsePostgresUrl('mysql://u:p@db/x'), null)
  assert.equal(parsePostgresUrl('no es una url'), null)
})

test('groups loose variables in one connection and each URL in its own', () => {
  const connections = postgresConnections(env({
    POSTGRES_USER: 'app',
    POSTGRES_PASSWORD: 'secreto',
    POSTGRES_DB: 'notas',
    POSTGRES_HOST: 'server-postgres',
    DATABASE_URL: 'postgres://app:secreto@server-postgres/notas',
    JWT_SECRET: 'x',
  }))
  assert.equal(connections.length, 2)
  assert.deepEqual(connections[0].vars, ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'])
  assert.deepEqual(connections[1].vars, ['DATABASE_URL'])
})

test('ignores variables meant for the local computer and URLs built from other variables', () => {
  const connections = postgresConnections(env({
    LOCAL_POSTGRES_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/dev',
    DATABASE_URL: 'postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db/app',
  }))
  assert.deepEqual(connections, [])
})

test('prefills a new addon with the user, password and database the app already uses', () => {
  const prefill = addonPrefill(env({
    DATABASE_URL: 'postgresql://apuntes:clave123@server-postgres:5432/apuntesuct-db',
  }), 'server')
  assert.deepEqual(prefill, {
    name: 'postgres',
    auth: { username: 'apuntes', password: 'clave123', database: 'apuntesuct-db' },
    vars: ['DATABASE_URL'],
  })
})

test('uses the postgres user password when the app connects as postgres', () => {
  const prefill = addonPrefill(env({ POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'pw', POSTGRES_DB: 'postgres' }), 'api')
  assert.deepEqual(prefill.auth, { enablePostgresUser: true, postgresPassword: 'pw' })
  assert.equal(prefill.name, undefined)
})

test('does not prefill anything when the app has no database variables', () => {
  assert.equal(addonPrefill(env({ JWT_SECRET: 'x', PORT: '3000' }), 'api'), null)
})

test('no warnings when the variables match the addon', () => {
  const warnings = postgresEnvWarnings(
    env({ DATABASE_URL: 'postgresql://app:pw@server-postgres:5432/notas' }),
    [pgAddon('server-postgres', { enablePostgresUser: true, postgresPassword: 'root', username: 'app', password: 'pw', database: 'notas' })],
  )
  assert.deepEqual(warnings, [])
})

test('warns about the case seen in class: unknown user and a database the addon never created', () => {
  const warnings = postgresEnvWarnings(
    env({ DATABASE_URL: 'postgresql://apuntes:clave@server-postgres:5432/apuntesuct-db' }),
    [pgAddon('server-postgres', { enablePostgresUser: true, postgresPassword: 'root' })],
  )
  assert.deepEqual(keys(warnings), ['postgresUserUnknown', 'postgresDatabaseMissing'])
  assert.equal(warnings[0].params.expected, 'postgres')
  assert.equal(warnings[1].params.database, 'apuntesuct-db')
})

test('tells the student which host to use when the .env still points to localhost', () => {
  const warnings = postgresEnvWarnings(
    env({ POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5433', POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'root' }),
    [pgAddon('server-postgres', { enablePostgresUser: true, postgresPassword: 'root' })],
  )
  assert.deepEqual(keys(warnings), ['postgresHostLocal', 'postgresPort'])
  assert.equal(warnings[0].params.expected, 'server-postgres')
})

test('warns about a wrong password without showing it', () => {
  const warnings = postgresEnvWarnings(
    env({ POSTGRES_USER: 'app', POSTGRES_PASSWORD: 'otra', POSTGRES_HOST: 'server-postgres' }),
    [pgAddon('server-postgres', { username: 'app', password: 'pw' })],
  )
  assert.deepEqual(keys(warnings), ['postgresPasswordMismatch'])
  assert.ok(!JSON.stringify(warnings).includes('otra'))
  assert.ok(!JSON.stringify(warnings).includes('"pw"'))
})

test('a host that is not an addon of the app is reported, and nothing is compared without knowing the addon', () => {
  const warnings = postgresEnvWarnings(
    env({ DATABASE_URL: 'postgresql://app:pw@db:5432/notas' }),
    [pgAddon('server-postgres', {}), pgAddon('server-reportes', {})],
  )
  assert.deepEqual(keys(warnings), ['postgresHostUnknown'])
  assert.equal(warnings[0].params.expected, 'server-postgres, server-reportes')
})

test('apps without a postgres addon get no warnings', () => {
  assert.deepEqual(postgresEnvWarnings(env({ DATABASE_URL: 'postgresql://a:b@localhost/x' }), []), [])
})
