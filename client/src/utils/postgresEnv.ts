// Lee de las variables de entorno de una app los datos con que se conecta a
// PostgreSQL, para rellenar el addon con esos mismos datos y para avisar cuando
// las variables y el addon no coinciden. Las variables las sigue escribiendo el
// estudiante (normalmente vienen de su .env local); esto solo las compara.

export type EnvVar = { name: string; value: string }

type ConnectionData = {
  host?: string
  port?: string
  user?: string
  password?: string
  database?: string
}

export type PostgresConnection = ConnectionData & {
  // variables de donde salieron los datos, para nombrarlas en los avisos
  vars: string[]
}

export type PostgresAuth = {
  enablePostgresUser?: boolean
  postgresPassword?: string
  username?: string
  password?: string
  database?: string
}

export type PostgresEnvWarning = {
  key:
    | 'postgresHostLocal'
    | 'postgresHostUnknown'
    | 'postgresPort'
    | 'postgresUserUnknown'
    | 'postgresPasswordMismatch'
    | 'postgresDatabaseMissing'
  params: Record<string, string>
}

const FIELD_NAMES: Record<keyof ConnectionData, string[]> = {
  host: ['POSTGRES_HOST', 'POSTGRESQL_HOST', 'PG_HOST', 'PGHOST', 'DB_HOST', 'DATABASE_HOST'],
  port: ['POSTGRES_PORT', 'POSTGRESQL_PORT', 'PG_PORT', 'PGPORT', 'DB_PORT', 'DATABASE_PORT'],
  user: [
    'POSTGRES_USER', 'POSTGRES_USERNAME', 'POSTGRESQL_USER', 'POSTGRESQL_USERNAME',
    'PG_USER', 'PGUSER', 'DB_USER', 'DB_USERNAME', 'DATABASE_USER', 'DATABASE_USERNAME',
  ],
  password: [
    'POSTGRES_PASSWORD', 'POSTGRESQL_PASSWORD', 'PG_PASSWORD', 'PGPASSWORD',
    'DB_PASSWORD', 'DB_PASS', 'DATABASE_PASSWORD',
  ],
  database: [
    'POSTGRES_DB', 'POSTGRES_DATABASE', 'POSTGRESQL_DATABASE', 'PG_DATABASE', 'PGDATABASE',
    'DB_NAME', 'DB_DATABASE', 'DATABASE_NAME',
  ],
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0', 'host.docker.internal']

export const POSTGRES_ADDON_KIND = 'KuberoAddonPostgres'
export const POSTGRES_PORT = '5432'

// Variables pensadas para el computador del estudiante (LOCAL_DATABASE_URL,
// DATABASE_URL_LOCAL...): en Kubero no se usan, así que no se comparan
const isLocalOnly = (name: string) => /(^|_)LOCAL(_|$)/i.test(name)

const decode = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

export function parsePostgresUrl(value: string): ConnectionData | null {
  const text = value.trim()
  if (!/^postgres(ql)?:\/\//i.test(text)) {
    return null
  }
  try {
    const url = new URL(text)
    const database = url.pathname.replace(/^\//, '')
    return {
      host: url.hostname || undefined,
      port: url.port || undefined,
      user: url.username ? decode(url.username) : undefined,
      password: url.password ? decode(url.password) : undefined,
      database: database ? decode(database) : undefined,
    }
  } catch {
    return null
  }
}

// Una conexión por cada URL postgres:// y otra con los datos sueltos
// (POSTGRES_USER, DB_HOST...), que se leen juntos
export function postgresConnections(envVars: EnvVar[]): PostgresConnection[] {
  const vars = (envVars || []).filter(
    (env) =>
      typeof env?.name === 'string' &&
      typeof env?.value === 'string' &&
      env.value.trim() !== '' &&
      // un valor que arma la URL con otras variables (${...}) no se puede leer
      !env.value.includes('${') &&
      !isLocalOnly(env.name),
  )
  const connections: PostgresConnection[] = []

  const loose: PostgresConnection = { vars: [] }
  for (const [field, names] of Object.entries(FIELD_NAMES) as [keyof ConnectionData, string[]][]) {
    const found = vars.find((env) => names.includes(env.name.trim().toUpperCase()))
    if (found) {
      loose[field] = found.value.trim()
      loose.vars.push(found.name.trim())
    }
  }
  if (loose.vars.length > 0) {
    connections.push(loose)
  }

  for (const env of vars) {
    const parsed = parsePostgresUrl(env.value)
    if (parsed) {
      connections.push({ vars: [env.name.trim()], ...parsed })
    }
  }
  return connections
}

// Datos para rellenar un addon de Postgres nuevo con lo que la app ya usa.
// `name` es el nombre corto del addon (sin el prefijo de la app), y solo se
// propone si el host de las variables ya es "<app>-<nombre>".
export function addonPrefill(
  envVars: EnvVar[],
  appname: string,
): { name?: string, auth: PostgresAuth, vars: string[] } | null {
  const connection = postgresConnections(envVars).find(
    (c) => c.user || c.password || c.database,
  )
  if (!connection) {
    return null
  }

  const auth: PostgresAuth = {}
  if (!connection.user || connection.user === 'postgres') {
    auth.enablePostgresUser = true
    if (connection.password) {
      auth.postgresPassword = connection.password
    }
  } else {
    auth.username = connection.user
    if (connection.password) {
      auth.password = connection.password
    }
  }
  if (connection.database && connection.database !== 'postgres') {
    auth.database = connection.database
  }

  let name: string | undefined
  const host = connection.host?.toLowerCase()
  if (appname && host?.startsWith(`${appname}-`)) {
    const short = host.slice(appname.length + 1)
    if (/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(short)) {
      name = short
    }
  }
  return { name, auth, vars: connection.vars }
}

type PostgresAddon = { name: string, auth: PostgresAuth }

function postgresAddons(addons: any[]): PostgresAddon[] {
  return (addons || [])
    .filter((addon) => addon?.kind === POSTGRES_ADDON_KIND)
    .map((addon) => {
      const definition = addon.resourceDefinitions?.[POSTGRES_ADDON_KIND]
      return {
        name: definition?.metadata?.name as string,
        auth: (definition?.spec?.postgres?.auth ?? {}) as PostgresAuth,
      }
    })
    .filter((addon) => !!addon.name)
}

// Compara las variables de la app con sus addons de Postgres. No bloquea nada:
// cada aviso dice qué variable no calza y qué valor espera el addon.
export function postgresEnvWarnings(envVars: EnvVar[], addons: any[]): PostgresEnvWarning[] {
  const pgAddons = postgresAddons(addons)
  if (pgAddons.length === 0) {
    return []
  }
  const addonNames = pgAddons.map((addon) => addon.name).join(', ')
  const warnings: PostgresEnvWarning[] = []

  for (const connection of postgresConnections(envVars)) {
    const vars = connection.vars.join(', ')
    let addon = connection.host
      ? pgAddons.find((a) => a.name === connection.host?.toLowerCase())
      : undefined

    if (connection.host && !addon) {
      const local = LOCAL_HOSTS.includes(connection.host.toLowerCase())
      warnings.push({
        key: local ? 'postgresHostLocal' : 'postgresHostUnknown',
        params: { vars, host: connection.host, expected: addonNames },
      })
    }
    if (connection.port && connection.port !== POSTGRES_PORT) {
      warnings.push({ key: 'postgresPort', params: { vars, port: connection.port } })
    }

    // sin un host que lo identifique, se compara con el addon si hay uno solo
    addon ??= pgAddons.length === 1 ? pgAddons[0] : undefined
    if (!addon) {
      continue
    }

    const users: string[] = []
    if (addon.auth.enablePostgresUser !== false) {
      users.push('postgres')
    }
    if (addon.auth.username) {
      users.push(addon.auth.username)
    }
    if (connection.user && !users.includes(connection.user)) {
      warnings.push({
        key: 'postgresUserUnknown',
        params: { vars, user: connection.user, addon: addon.name, expected: users.join(', ') || '-' },
      })
    } else if (connection.user && connection.password !== undefined) {
      const expected = connection.user === 'postgres'
        ? addon.auth.postgresPassword
        : addon.auth.password
      if (expected && connection.password !== expected) {
        warnings.push({
          key: 'postgresPasswordMismatch',
          params: { vars, user: connection.user, addon: addon.name },
        })
      }
    }

    const databases = ['postgres']
    if (addon.auth.database) {
      databases.push(addon.auth.database)
    }
    if (connection.database && !databases.includes(connection.database)) {
      warnings.push({
        key: 'postgresDatabaseMissing',
        params: {
          vars,
          database: connection.database,
          addon: addon.name,
          expected: databases.join(', '),
        },
      })
    }
  }
  return warnings
}
