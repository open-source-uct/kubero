const { test } = require('node:test')
const assert = require('node:assert/strict')
const { userFields, passwordFields, namedFields } = require('./helpers/load-source.cjs')('src/validation/accounts.ts')
const t = key => key
const valid = fields => fields.every(field => field.active === false || field.rules.every(rule => rule.test(field.value)))
test('account creation checks email and existing password policy without imposing a character-class policy', () => {
  assert.equal(valid(userFields({ username: 'María José', email: 'maria@example.com', password: 'abcdefgh' }, true, false, t)), true)
  assert.equal(valid(userFields({ username: 'user', email: 'wrong', password: '123' }, true, false, t)), false)
  assert.equal(valid(userFields({ username: 'user', email: 'u@example.com' }, false, true, t)), false)
  assert.equal(valid(namedFields({ name: '  ', description: 'Team' }, true, t)), false)
})
test('changing a password validates length and reacts when the original password changes', () => {
  assert.equal(valid(passwordFields('abcdefgh', 'abcdefgh', t)), true)
  assert.equal(valid(passwordFields('abcdefghi', 'abcdefgh', t)), false)
  assert.equal(valid(passwordFields('short', 'short', t)), false)
})
