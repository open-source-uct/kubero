const { test } = require('node:test')
const assert = require('node:assert/strict')
const { advancedAppFields } = require('./helpers/load-source.cjs')('src/validation/advancedApps.ts')
const model = () => ({ basicAuth: { enabled: false, realm: '', accounts: [] }, security: { runAsUser: 0, runAsGroup: 0, runAsNonRoot: false }, autoscale: false, webreplicas: 1, workerreplicas: 0, webreplicasrange: [1, 3], workerreplicasrange: [0, 0], healthcheck: { enabled: false, path: '', startupSeconds: 0, timeoutSeconds: 0, periodSeconds: 0 }, extraVolumes: [], cronjobs: [], customIngressAnnotations: [], sAAnnotations: [] })
const valid = value => advancedAppFields(value, key => key, () => {}).every(field => field.active === false || field.rules.every(rule => rule.test(field.value)))
test('disabled features do not block apps and enabling them immediately activates their requirements', () => {
  assert.equal(valid(model()), true)
  assert.equal(valid({ ...model(), basicAuth: { enabled: true, realm: 'Members', accounts: [] } }), false)
  assert.equal(valid({ ...model(), healthcheck: { ...model().healthcheck, enabled: true } }), false)
  assert.equal(valid({ ...model(), security: { runAsNonRoot: true, runAsUser: 0, runAsGroup: 0 } }), false)
})
test('advanced model validation catches closed-panel and cross-field errors', () => {
  assert.equal(valid({ ...model(), autoscale: true, webreplicasrange: [4, 2] }), false)
  assert.equal(valid({ ...model(), extraVolumes: [{ name: 'data', size: 'many', mountPath: '/data', accessModes: ['ReadWriteOnce'] }] }), false)
  assert.equal(valid({ ...model(), customIngressAnnotations: [{ annotation: '', value: 'partial' }] }), false)
  assert.equal(valid({ ...model(), customIngressAnnotations: [{ annotation: '', value: '' }] }), true)
})
test('network settings validate IP ranges, buffer sizes and enabled CORS values', () => {
  const annotations = { 'nginx.ingress.kubernetes.io/whitelist-source-range': '10.0.0.0/8,::1/128', 'nginx.ingress.kubernetes.io/proxy-buffer-size': '8k' }
  assert.equal(valid({ ...model(), annotations }), true)
  annotations['nginx.ingress.kubernetes.io/whitelist-source-range'] = '999.0.0.1/99'
  assert.equal(valid({ ...model(), annotations }), false)
  assert.equal(valid({ ...model(), annotations: { 'nginx.ingress.kubernetes.io/enable-cors': 'true', 'nginx.ingress.kubernetes.io/cors-max-age': '-1' } }), false)
})
