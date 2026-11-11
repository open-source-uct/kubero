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

const { eventTimestamp, sortEventsNewestFirst } = loadSource('src/utils/kubeEvents.ts')

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
