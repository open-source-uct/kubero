const { test } = require('node:test')
const assert = require('node:assert/strict')
const { initialLocale, DEFAULT_LOCALE } = require('./helpers/load-source.cjs')('src/utils/locale.ts')

test('without a saved choice the interface starts in Spanish', () => {
  assert.equal(DEFAULT_LOCALE, 'es')
  for (const saved of [null, undefined, '']) assert.equal(initialLocale(saved), 'es')
})

test('a saved choice is kept, and an unknown one falls back to Spanish', () => {
  assert.equal(initialLocale('en'), 'en')
  assert.equal(initialLocale('es'), 'es')
  for (const saved of ['de', 'EN', 'es-CL', 'cualquiera']) assert.equal(initialLocale(saved), 'es')
})
