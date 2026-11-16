const { test } = require('node:test')
const assert = require('node:assert/strict')
const { settingsFields, setupFields, notificationFields, kubeconfigContexts } = require('./helpers/load-source.cjs')('src/validation/settings.ts')
const valid = fields => fields.every(field => field.active === false || field.rules.every(rule => rule.test(field.value)))
const t = key => key
test('disabled integrations stay optional and malformed optional URLs block settings', () => {
  assert.equal(valid(settingsFields({}, t, {}, () => {})), true)
  assert.equal(valid(settingsFields({ secrets: { GITEA_BASEURL: 'wrong-url' } }, t, {}, () => {})), false)
})
test('setup rejects malformed YAML or an unavailable context before contacting the backend', () => {
  assert.deepEqual(kubeconfigContexts('invalid: ['), [])
  assert.equal(valid(setupFields('1', 'contexts: [{name: local}]', 'local', {})), true)
  assert.equal(valid(setupFields('1', 'contexts: [{name: local}]', 'elsewhere', {})), false)
  assert.equal(valid(setupFields('2', '', '', { KUBERO_NAMESPACE: 'UpperCase' })), false)
})
test('notifications require a supported type and a complete HTTP URL even when disabled', () => {
  assert.equal(valid(notificationFields({ name: 'Deployments', type: 'webhook', config: { url: 'https://example.com/hook' } }, t)), true)
  assert.equal(valid(notificationFields({ name: 'Deployments', type: 'webhook', config: { url: 'javascript:alert(1)' } }, t)), false)
})
