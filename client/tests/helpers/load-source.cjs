const { readFileSync, existsSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const cache = new Map()
module.exports = function loadSource(relative) {
  const filename = resolve(__dirname, '../..', relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = new Module(filename)
  loaded.paths = Module._nodeModulePaths(dirname(filename))
  const originalRequire = loaded.require.bind(loaded)
  loaded.require = name => name.startsWith('.') && existsSync(resolve(dirname(filename), name + '.ts'))
    ? module.exports(resolve(dirname(filename), name + '.ts')) : originalRequire(name)
  cache.set(filename, loaded)
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
  return loaded.exports
}
