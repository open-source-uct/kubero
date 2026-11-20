const { test } = require('node:test')
const assert = require('node:assert/strict')
const { pipelineFields } = require('./helpers/load-source.cjs')('src/validation/pipelines.ts')
const model = () => ({ name: 'pipeline', creating: true, domain: '', teams: [], admin: true, supervised: false, contexts: ['local'], phases: [{ name: 'production', enabled: true, context: 'local', domain: '', defaultEnvvars: [] }] })
const valid = value => pipelineFields(value, key => key).every(field => field.active === false || field.rules.every(rule => rule.test(field.value)))
test('pipelines require enabled-phase contexts, valid namespaces and role-appropriate teams', () => {
  assert.equal(valid(model()), true)
  assert.equal(valid({ ...model(), name: 'new' }), false)
  assert.equal(valid({ ...model(), name: 'a'.repeat(53) }), false)
  assert.equal(valid({ ...model(), admin: false }), false)
  assert.equal(pipelineFields({ ...model(), admin: false }, key => key).find(field => field.id === 'teams').rules.some(rule => rule.required), true)
  assert.equal(valid({ ...model(), supervised: true, teams: ['personal-user'] }), false)
  assert.equal(valid({ ...model(), phases: [{ ...model().phases[0], context: '' }] }), false)
  assert.equal(valid({ ...model(), phases: [{ ...model().phases[0], enabled: false, context: '' }] }), true)
})

test('phase fields are labelled with the translated phase name, not the internal one', () => {
  const t = key => ({ 'pipeline.phases.production': 'Producción', 'pipeline.form.label.cluster': 'Clúster' })[key] || key
  const fields = pipelineFields({ name: 'web', creating: true, domain: '', teams: ['curso'], admin: true, supervised: false, contexts: ['c'],
    phases: [{ name: 'production', enabled: true, context: 'c', domain: '', defaultEnvvars: [] }] }, t)
  assert.equal(fields.find(field => field.id === 'context-production').label, 'Producción: Clúster')
})
