const { test } = require('node:test')
const assert = require('node:assert/strict')
const { tokenFields, avatarFields } = require('./helpers/load-source.cjs')('src/validation/access.ts')
const valid = fields => fields.every(field => field.rules.every(rule => rule.test(field.value)))
test('tokens reject incomplete dates and impossible calendar dates', () => {
  for (const expiresAt of ['', '2027-02-29T12:00', '2026-02-31T12:00', '2026-13-01T00:00', '2026-01-01T24:01']) assert.equal(valid(tokenFields({ name: 'Token', expiresAt }, key => key)), false, expiresAt)
  assert.equal(valid(tokenFields({ name: 'Token', expiresAt: '2028-02-29T12:00' }, key => key)), true)
})
test('avatar checks the existing 100 KiB limit and image file type before upload', () => {
  assert.equal(valid(avatarFields(new File([new Uint8Array(102400)], 'avatar.png', { type: 'image/png' }), key => key)), true)
  assert.equal(valid(avatarFields(new File([new Uint8Array(102401)], 'avatar.png', { type: 'image/png' }), key => key)), false)
  assert.equal(valid(avatarFields(new File(['text'], 'file.txt', { type: 'text/plain' }), key => key)), false)
})
