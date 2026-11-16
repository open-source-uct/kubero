const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createI18n } = require('vue-i18n')
const { validationEn, validationEs } = require('./helpers/load-source.cjs')('src/locale/validation.ts')
test('every validation message compiles in both locales, including literal email and cron examples', () => {
  const errors = []
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { validation: validationEn }, es: { validation: validationEs } }, onError: error => errors.push(error.message) })
  for (const locale of ['en', 'es']) {
    i18n.global.locale.value = locale
    for (const key of Object.keys(validationEn)) assert.ok(i18n.global.t('validation.' + key, { min: 1, max: 65535 }))
    assert.ok(i18n.global.t('validation.email').includes('@'))
  }
  assert.deepEqual(errors, [])
})
