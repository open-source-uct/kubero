const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadSource(relative) {
  const filename = resolve(__dirname, '..', relative)
  const loaded = new Module(filename)
  loaded.paths = Module._nodeModulePaths(dirname(filename))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  loaded._compile(outputText, filename)
  return loaded.exports
}

const options = loadSource('src/utils/podsizeOptions.ts')

const sized = (requests, limits) => ({ requests, limits })

test('parseQuantity reads the notations Kubernetes accepts', () => {
  assert.equal(options.parseQuantity('250m'), 0.25)
  assert.equal(options.parseQuantity('2'), 2)
  assert.equal(options.parseQuantity('0.5Gi'), 512 * 2 ** 20)
  assert.equal(options.parseQuantity('1e3'), 1000)
  assert.equal(options.parseQuantity('mucho'), null)
  assert.equal(options.parseQuantity(''), null)
})

test('existing sizes written by hand are shown as the equivalent option', () => {
  // así están definidos small y medium en la U
  const canonical = options.canonicalResources(sized({ cpu: '1000m', memory: '0.5Gi' }, { cpu: '2000m', memory: '4Gi' }))
  assert.deepEqual(canonical, sized({ cpu: '1', memory: '512Mi' }, { cpu: '2', memory: '4Gi' }))
})

test('a stored value with no equivalent option stays selectable', () => {
  const items = options.memoryOptions('640Mi')
  assert.ok(items.some((item) => item.value === '640Mi' && item.title === '640 MiB'))
  // la lista sigue ordenada de menor a mayor
  const bytes = items.map((item) => options.parseQuantity(item.value))
  assert.deepEqual([...bytes].sort((a, b) => a - b), bytes)
  assert.equal(options.cpuOptions('').length, options.CPU_VALUES.length)
})

test('option titles say how much each value is', () => {
  assert.equal(options.cpuOptions()[2].title, '250m (0.25 cores)')
  assert.equal(options.cpuOptions().find((item) => item.value === '1').title, '1 (1 core)')
  assert.equal(options.memoryOptions().find((item) => item.value === '1536Mi').title, '1.5 GiB')
})

test('a request above its limit is detected, across notations', () => {
  assert.deepEqual(options.requestAboveLimit(sized({ cpu: '1', memory: '512Mi' }, { cpu: '500m', memory: '0.5Gi' })), {
    cpu: true,
    memory: false,
  })
  assert.deepEqual(options.requestAboveLimit(sized({ cpu: '250m', memory: '2Gi' }, { cpu: '250m', memory: '1Gi' })), {
    cpu: false,
    memory: true,
  })
})

test('a size is complete only when the four values are valid quantities', () => {
  assert.equal(options.resourcesComplete(sized({ cpu: '250m', memory: '512Mi' }, { cpu: '500m', memory: '1Gi' })), true)
  assert.equal(options.resourcesComplete(sized({ cpu: '', memory: '512Mi' }, { cpu: '500m', memory: '1Gi' })), false)
})
