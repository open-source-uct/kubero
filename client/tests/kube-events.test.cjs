const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadSource(relative) {
  const filename = resolve(__dirname, '..', relative)
  const loaded = new Module(filename)
  loaded.paths = Module._nodeModulePaths(dirname(filename))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  loaded._compile(outputText, filename)
  return loaded.exports
}

const { eventTimestamp, sortEventsNewestFirst, appResourceMatcher } = loadSource('src/utils/kubeEvents.ts')

const created = (name, at) => ({ name, metadata: { creationTimestamp: at } })

test('orders by the full date, not by the milliseconds of the time', () => {
  // con getMilliseconds() el de las 09:00 (.900) quedaba antes que el de las 10:00 (.250)
  const events = [created('nueve', '2026-11-11T09:00:00.900Z'), created('diez', '2026-11-11T10:00:00.250Z')]
  assert.deepEqual(sortEventsNewestFirst(events).map((e) => e.name), ['diez', 'nueve'])
})

test('a repeated event is placed by its last occurrence', () => {
  const backoff = { name: 'backoff', metadata: { creationTimestamp: '2026-11-10T08:00:00Z' }, lastTimestamp: '2026-11-11T12:00:00Z' }
  const pulled = created('pulled', '2026-11-11T11:00:00Z')
  assert.deepEqual(sortEventsNewestFirst([pulled, backoff]).map((e) => e.name), ['backoff', 'pulled'])
})

test('uses series, lastTimestamp, eventTime and creationTimestamp, in that order', () => {
  assert.equal(
    eventTimestamp({ series: { lastObservedTime: '2026-11-11T12:00:00Z' }, lastTimestamp: '2026-11-11T10:00:00Z', metadata: { creationTimestamp: '2026-11-11T09:00:00Z' } }),
    Date.parse('2026-11-11T12:00:00Z'),
  )
  // las APIs nuevas dejan lastTimestamp en null y usan eventTime
  assert.equal(eventTimestamp({ lastTimestamp: null, eventTime: '2026-11-11T10:30:00.123456Z', metadata: { creationTimestamp: '2026-11-11T09:00:00Z' } }), Date.parse('2026-11-11T10:30:00.123Z'))
  assert.equal(eventTimestamp(created('x', '2026-11-11T09:00:00Z')), Date.parse('2026-11-11T09:00:00Z'))
})

test('events without a valid date go last instead of breaking the list', () => {
  const events = [{ name: 'sin fecha', metadata: {} }, { name: 'mala', lastTimestamp: 'no-es-fecha' }, created('ok', '2026-11-11T09:00:00Z')]
  assert.equal(sortEventsNewestFirst(events)[0].name, 'ok')
  assert.equal(eventTimestamp({ metadata: {} }), 0)
})

test('does not modify the received array', () => {
  const events = [created('a', '2026-11-11T09:00:00Z'), created('b', '2026-11-11T10:00:00Z')]
  sortEventsNewestFirst(events)
  assert.deepEqual(events.map((e) => e.name), ['a', 'b'])
})

// nombres reales de la U (pipeline uct-map y apuntesuct)
const uctMap = {
  'campus-api': { addons: [{ resourceDefinitions: { KuberoAddonPostgres: { metadata: { name: 'campus-api-postgres' } } } }] },
  'incident-api': { addons: [{ resourceDefinitions: { KuberoAddonMongodb: { metadata: { name: 'incident-api-mongodb' } } } }] },
}

test('keeps the resources the operator creates for the app', () => {
  const belongs = appResourceMatcher('campus-api', uctMap['campus-api'])
  for (const name of ['campus-api', 'campus-api-kuberoapp', 'campus-api-kuberoapp-web', 'campus-api-kuberoapp-web-666ccb9db8', 'campus-api-kuberoapp-web-666ccb9db8-qj2v5', 'campus-api-kuberoapp-worker']) {
    assert.equal(belongs(name), true, name)
  }
})

test('keeps the addons of the app: resource, pod and volume', () => {
  const belongs = appResourceMatcher('incident-api', uctMap['incident-api'])
  for (const name of ['incident-api-mongodb', 'incident-api-mongodb-0', 'mongodb-volume-incident-api-mongodb-0']) {
    assert.equal(belongs(name), true, name)
  }
  assert.equal(appResourceMatcher('server', { addons: [{ resourceDefinitions: { KuberoAddonPostgres: { metadata: { name: 'server-postgres' } } } }] })('data-server-postgres-0'), true)
})

test('leaves out other apps of the same pipeline, even with a similar name', () => {
  const api = appResourceMatcher('api', {})
  for (const name of ['api-gateway-kuberoapp-web', 'api-gateway-kuberoapp-web-556b777c84-x88d6', 'apiary-kuberoapp']) {
    assert.equal(api(name), false, name)
  }
  const campus = appResourceMatcher('campus-api', uctMap['campus-api'])
  for (const name of ['identity-api-postgres-0', 'incident-api-mongodb-0', 'schedule-api-kuberoapp-web-bc96bbf68-pbbhk', 'data-identity-api-postgres-0']) {
    assert.equal(campus(name), false, name)
  }
})

test('keeps volumes and cronjobs of the app by their exact name', () => {
  const minio = appResourceMatcher('minio', { extraVolumes: [{ name: 'minio-data' }, { name: 'cache', emptyDir: true }], cronjobs: [{ name: 'backup' }] })
  assert.equal(minio('minio-data'), true)
  assert.equal(minio('cache'), false)
  assert.equal(minio('backup'), true)
  assert.equal(minio('backup-29384756'), true)
  assert.equal(minio('backup-29384756-x7k2p'), true)
  assert.equal(minio('backups-kuberoapp'), false)
})

test('without the app spec it still keeps what the operator creates', () => {
  const belongs = appResourceMatcher('frontend', null)
  assert.equal(belongs('frontend-kuberoapp-web-9d76584cb-p64xl'), true)
  assert.equal(belongs('frontend-postgres-0'), false)
})
