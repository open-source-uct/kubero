const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const ts = require('typescript')

// Load the real TypeScript helper; it has no imports to mock.
function load(relative) {
  const filename = resolve(__dirname, '..', relative)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loaded = { exports: {} }
  new Function('module', 'exports', 'require', outputText)(loaded, loaded.exports, require)
  return loaded.exports
}

const { isSessionExpiry } = load('src/utils/sessionExpiry.ts')
const active = { status: 401, url: '/api/pipelines', hadSession: true, routeName: 'Pipelines', redirectInProgress: false }

test('a 401 while a session is active is reported as an expired session', () => {
  assert.equal(isSessionExpiry(active), true)
})

test('the first visit without a session does not report an expired session', () => {
  assert.equal(isSessionExpiry({ ...active, url: '/api/auth/session', hadSession: false, routeName: undefined }), false)
})

test('other statuses, the login request, the login page and a redirect in progress are not reported', () => {
  assert.equal(isSessionExpiry({ ...active, status: 403 }), false)
  assert.equal(isSessionExpiry({ ...active, url: '/api/auth/login' }), false)
  assert.equal(isSessionExpiry({ ...active, routeName: 'Login' }), false)
  assert.equal(isSessionExpiry({ ...active, redirectInProgress: true }), false)
})
