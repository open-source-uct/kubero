const { test } = require('node:test')
const assert = require('node:assert/strict')
const { auditDescription, normalizeAction } = require('./helpers/load-source.cjs')('src/utils/auditText.ts')
const load = require('./helpers/load-source.cjs')

test('participles from the server are treated as the same action', () => {
  assert.deepEqual(['created', 'deleted', 'updated', 'restart', ''].map(normalizeAction), ['create', 'delete', 'update', 'restart', ''])
})

test('known entries get a translated description with their names', () => {
  assert.deepEqual(auditDescription({ action: 'update', resource: 'app', app: 'backend', pipeline: 'taller' }),
    { key: 'activity.describe.app.update', params: { app: 'backend', pipeline: 'taller' } })
  assert.equal(auditDescription({ action: 'created', resource: 'pipeline', pipeline: 'taller' }).key, 'activity.describe.pipeline.create')
  assert.equal(auditDescription({ action: 'update', resource: 'config' }).key, 'activity.describe.config.update')
})

test('unknown resources or missing names keep the server message', () => {
  assert.equal(auditDescription({ action: 'update', resource: 'security', message: 'Password reset' }), null)
  assert.equal(auditDescription({ action: 'update', resource: 'app', message: 'Updated app' }), null)
  assert.equal(auditDescription({}), null)
})

test('every described case exists in both languages', () => {
  for (const lang of ['es', 'en']) {
    const messages = load(`src/locale/${lang}.ts`).default
    const describe = messages.activity.describe
    for (const [resource, actions] of Object.entries(describe)) {
      for (const action of Object.keys(actions)) {
        assert.ok(messages.activity.actions[action], `${lang}: falta activity.actions.${action}`)
        assert.ok(messages.activity.resources[resource], `${lang}: falta activity.resources.${resource}`)
      }
    }
    assert.deepEqual(Object.keys(describe).sort(), ['app', 'build', 'config', 'pipeline'])
  }
})
