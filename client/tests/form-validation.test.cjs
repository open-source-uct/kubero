const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('./helpers/load-source.cjs')
const { rules, dnsRules, envRules, validCron } = load('src/utils/validationRules.ts')
const { createFormValidation, updateModelPath, validationRowId } = load('src/composables/useFormValidation.ts')
const { reactive } = require('vue')

test('nested setting edits are immutable and keep the edited row identity', () => {
  const model = { catalogs: [{ name: 'Before' }], other: { enabled: true } }
  const id = validationRowId(model.catalogs[0])
  const next = updateModelPath(model, 'catalogs.0.name', 'After')
  assert.equal(model.catalogs[0].name, 'Before')
  assert.equal(next.catalogs[0].name, 'After')
  assert.equal(next.other, model.other)
  assert.equal(validationRowId(next.catalogs[0]), id)
  assert.equal(updateModelPath(model, '__proto__.polluted', true), model)
})

test('required preserves zero and false but rejects blanks and empty selections', () => {
  for (const value of [0, false, 'value', ['a']]) assert.equal(rules.required.test(value), true)
  for (const value of [null, undefined, '', '   ', []]) assert.equal(rules.required.test(value), false)
})

test('mandatory labels remove legacy markers from fields and summaries without changing definitions', () => {
  for (const label of ['Password*', 'Password * ', 'Password * *']) {
    const definition = { id: 'password', label, value: '', rules: [rules.required] }
    const form = createFormValidation(() => [definition,
      { id: 'optional', label: 'Wildcard *', value: '', rules: [] },
    ])
    assert.equal(form.field('password').label, 'Password')
    assert.equal(form.field('password').required, true)
    assert.equal(form.issues[0].label, 'Password')
    assert.equal(form.field('optional').label, 'Wildcard *')
    assert.equal(definition.label, label)
    assert.equal(form.valid, false)
  }
})
test('ports reject partial numbers, fractions and out-of-range values', () => {
  const rule = rules.integer(1, 65535)
  for (const value of [1, '65535', 8080]) assert.equal(rule.test(value), true)
  for (const value of [0, 65536, '1.5', '8080x', NaN, Infinity, false, '1e3']) assert.equal(rule.test(value), false)
})
test('formats distinguish URLs, domains, infrastructure names and human names', () => {
  assert.equal(rules.url.test('https://localhost:2000/callback'), true)
  for (const url of ['javascript:alert(1)', 'ftp://host/path', 'https://bad host', 'host/path']) assert.equal(rules.url.test(url), false)
  assert.equal(rules.domain.test('app.example.com'), true)
  assert.equal(rules.domain.test('localhost'), true)
  assert.equal(rules.domain.test('https://app.example.com'), false)
  for (const name of ['UPPER', 'under_score', '-start', 'end-']) assert.equal(dnsRules().every(rule => rule.test(name)), false)
  assert.equal(dnsRules().every(rule => rule.test('app-123')), true)
  assert.equal(rules.required.test('María José'), true)
})
test('environment conflicts and Kubernetes quantities are checked without exposing values', () => {
  assert.equal(envRules(['API', 'API'], 'API').every(rule => rule.test('API')), false)
  assert.equal(envRules(['PORT'], 'PORT').every(rule => rule.test('PORT')), false)
  for (const quantity of ['250m', '512Mi', '0.5Gi', '1e3']) assert.equal(rules.quantity().test(quantity), true)
  assert.equal(rules.quantity().test('many'), false)
  assert.equal(rules.quantity(true).test('0'), false)
})
test('cron validates the entire expression and numeric ranges', () => {
  for (const cron of ['*/5 * * * *', '0 9 * jan mon-fri', '@daily', '0,30 8-17/2 * * *']) assert.equal(validCron(cron), true, cron)
  for (const cron of ['text * * * * * suffix', '60 * * * *', '* 24 * * *', '*/0 * * * *', '* * * * * *', '']) assert.equal(validCron(cron), false, cron)
})
test('validity is independent of touched state and inactive fields, and reset keeps values', () => {
  const model = reactive({ name: '', enabled: true, port: 'wrong' })
  const form = createFormValidation(() => [
    { id: 'name', label: 'Name', value: model.name, rules: [rules.required] },
    { id: 'port', label: 'Port', value: model.port, rules: [rules.required, rules.integer(1, 65535)], active: model.enabled },
  ])
  assert.equal(form.valid, false)
  assert.equal(form.field('name').touched, false)
  assert.equal(form.validate(), false)
  assert.equal(form.field('name').touched, true)
  model.name = 'valid'
  model.enabled = false
  assert.equal(form.valid, true)
  model.enabled = true
  assert.equal(form.valid, false)
  model.port = '8080'
  assert.equal(form.valid, true)
  form.reset()
  assert.equal(form.field('port').touched, false)
  assert.equal(model.port, '8080')
})
