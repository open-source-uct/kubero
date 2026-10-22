const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { createPinia, setActivePinia } = require('pinia')
const axios = require('axios')

// Load the actual TypeScript stores with only network/socket boundaries mocked.
function loadSource(relative, mocks = {}) {
  const filename = resolve(__dirname, '..', relative)
  const loaded = new Module(filename)
  loaded.paths = Module._nodeModulePaths(dirname(filename))
  const originalRequire = loaded.require.bind(loaded)
  loaded.require = (id) => mocks[id] ?? originalRequire(id)
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  loaded._compile(outputText, filename)
  return loaded.exports
}

test('session hydration uses the server identity and reset clears all credentials and socket state', async () => {
  setActivePinia(createPinia())
  let disconnected = false
  const storage = new Map([['kubero.JWT_TOKEN', 'old-browser-token']])
  global.localStorage = { removeItem: (key) => storage.delete(key) }
  const kubero = loadSource('src/stores/kubero.ts')
  const { useAuthStore } = loadSource('src/stores/auth.ts', {
    '../socket.io': { disconnectSocketIO: () => { disconnected = true } },
    './kubero': kubero,
  })
  const originalGet = axios.get
  let calls = 0
  axios.get = async (url) => {
    assert.equal(url, '/api/auth/session')
    calls++
    return { data: { user: {
      userId: 'u1', username: 'ana', role: 'member', userGroups: ['Taller1'],
      permissions: ['logs:ok'], scopeToOwnTeam: true, priority: 10,
    } } }
  }
  try {
    const auth = useAuthStore()
    await auth.initialize()
    await auth.initialize()
    assert.equal(calls, 1)
    assert.equal(auth.userId, 'u1')
    assert.equal(auth.hasPermission('logs:ok'), true)
    assert.equal('token' in auth.$state, false)
    axios.defaults.headers.common.Authorization = 'Bearer old-browser-token'
    const state = kubero.useKuberoStore().kubero
    state.socket = { connected: true }
    state.isAuthenticated = true
    state.nextGenSession = { username: 'ana', token: 'old-browser-token' }
    auth.reset()
    assert.equal(axios.defaults.headers.common.Authorization, undefined)
    assert.equal(storage.has('kubero.JWT_TOKEN'), false)
    assert.equal(disconnected, true)
    assert.equal(state.socket, null)
    assert.equal(state.isAuthenticated, false)
    assert.deepEqual(state.nextGenSession, { username: '', token: '' })
    assert.equal(auth.userId, '')
    assert.deepEqual([...auth.permissions], [])
  } finally {
    axios.get = originalGet
    delete axios.defaults.headers.common.Authorization
    delete global.localStorage
  }
})

test('layouts share one cookie-authenticated socket and logout discards its listeners and auth data', () => {
  const connections = []
  const { useSocketIO, disconnectSocketIO } = loadSource('src/socket.io.ts', {
    'socket.io-client': { io: (options) => {
      assert.deepEqual(options, { withCredentials: true })
      const socket = {
        auth: { token: 'stale' }, connected: true, listeners: true,
        disconnect() { this.connected = false },
        removeAllListeners() { this.listeners = false },
      }
      connections.push(socket)
      return socket
    } },
  })
  const first = useSocketIO().socket
  assert.equal(useSocketIO().socket, first)
  assert.equal(connections.length, 1)
  disconnectSocketIO()
  assert.deepEqual(first.auth, {})
  assert.equal(first.connected, false)
  assert.equal(first.listeners, false)
  assert.notEqual(useSocketIO().socket, first)
  disconnectSocketIO()
})
