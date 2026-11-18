const { test } = require('node:test')
const assert = require('node:assert/strict')
const { podsizeFields, runpackFields } = require('./helpers/load-source.cjs')('src/validation/resources.ts')
const valid = fields => fields.every(field => field.rules.every(rule => rule.test(field.value)))
test('pod sizes require description and compare equivalent resource units', () => {
  const model = { name: 'Small', description: 'Course app', resources: { requests: { cpu: '250m', memory: '0.5Gi' }, limits: { cpu: '1', memory: '512Mi' } } }
  assert.equal(valid(podsizeFields(model, key => key)), true)
  assert.equal(valid(podsizeFields({ ...model, description: ' ' }, key => key)), false)
  model.resources.requests.memory = '1Gi'
  assert.equal(valid(podsizeFields(model, key => key)), false)
})
test('all three runpack stages must have a repository, tag and numeric identity', () => {
  const stage = { repository: 'node', tag: '22', securityContext: { runAsUser: 0, runAsGroup: 0 } }
  const model = { name: 'Node', language: 'JavaScript', fetch: stage, build: stage, run: stage }
  assert.equal(valid(runpackFields(model, key => key)), true)
  assert.equal(valid(runpackFields({ ...model, build: { ...stage, tag: '' } }, key => key)), false)
})
