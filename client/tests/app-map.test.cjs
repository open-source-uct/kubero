const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildAppMap, classifyPod, describeCron } = require('./helpers/load-source.cjs')('src/utils/appMap.ts')

const container = (extra = {}) => ({ name: 'kuberoapp-web', image: 'ghcr.io/uct/backend:latest', restartCount: 0, ready: true, started: true, ...extra })
const pod = (name, extra = {}, containerExtra = {}) => ({ name, status: 'Running', startTime: '2026-11-19T10:00:00Z', containers: [container(containerExtra)], ...extra })
const spec = (extra = {}) => ({
  deploymentstrategy: 'docker',
  image: { repository: 'ghcr.io/uct/backend', tag: 'latest' },
  web: { replicaCount: 2 },
  worker: { replicaCount: 0 },
  ingress: { enabled: true, hosts: [{ host: 'backend.inf.uct.cl' }], tls: [] },
  addons: [{ id: 'postgresql', kind: 'KuberoAddonPostgres', displayName: 'PostgreSQL', resourceDefinitions: { KuberoAddonPostgres: { metadata: { name: 'backend-postgres' } } } }],
  cronjobs: [{ name: 'limpieza', schedule: '0 3 * * *', command: ['node', 'clean.js'] }],
  ...extra,
})

test('pods are classified by what the student can do about them', () => {
  assert.deepEqual(classifyPod(pod('a')), { status: 'ok', reason: 'ready', rawReason: '' })
  assert.equal(classifyPod(pod('a', {}, { ready: false, waitingReason: 'CrashLoopBackOff', restartCount: 5 })).action, 'logs')
  assert.equal(classifyPod(pod('a', {}, { ready: false, waitingReason: 'ImagePullBackOff' })).reason, 'imagePull')
  assert.equal(classifyPod(pod('a', {}, { ready: false, waitingReason: 'ErrImagePull' })).reason, 'imagePull')
  assert.equal(classifyPod(pod('a', {}, { ready: false, waitingReason: 'CreateContainerConfigError' })).reason, 'configError')
  assert.deepEqual(classifyPod(pod('a', {}, { ready: false, waitingReason: 'ContainerCreating' })), { status: 'progress', reason: 'starting', rawReason: 'ContainerCreating' })
  assert.equal(classifyPod({ name: 'a', status: 'Pending', containers: [] }).reason, 'pending')
  assert.equal(classifyPod(pod('a', {}, { ready: false })).reason, 'notReady')
  const unknown = classifyPod(pod('a', {}, { ready: false, waitingReason: 'RunContainerError' }))
  assert.deepEqual([unknown.status, unknown.reason, unknown.rawReason], ['problem', 'stopped', 'RunContainerError'])
})

test('a healthy app shows every piece working', () => {
  const map = buildAppMap('backend', spec(), [pod('backend-kuberoapp-web-7d9f-abcde'), pod('backend-kuberoapp-web-7d9f-fghij')])
  assert.equal(map.status, 'ok')
  assert.equal(map.problems, 0)
  assert.deepEqual(map.access, { host: 'backend.inf.uct.cl', url: 'http://backend.inf.uct.cl', status: 'ok' })
  assert.equal(map.workloads.length, 1, 'a worker with no replicas is not shown')
  assert.deepEqual([map.workloads[0].ready, map.workloads[0].replicas, map.workloads[0].status], [2, 2, 'ok'])
  assert.equal(map.workloads[0].pods[0].shortName, 'web-7d9f-abcde')
  assert.deepEqual(map.addons, [{ name: 'PostgreSQL', kind: 'KuberoAddonPostgres', host: 'backend-postgres', status: 'neutral' }])
  assert.deepEqual(map.cronjobs, [{ name: 'limpieza', schedule: '0 3 * * *', description: { kind: 'daily', time: '03:00' } }])
  assert.deepEqual(map.source, { type: 'image', label: 'ghcr.io/uct/backend:latest' })
})

test('one crashing pod is a problem, but the app is still reachable', () => {
  const map = buildAppMap('backend', spec(), [
    pod('backend-kuberoapp-web-7d9f-abcde'),
    pod('backend-kuberoapp-web-7d9f-fghij', {}, { ready: false, waitingReason: 'CrashLoopBackOff', restartCount: 5 }),
  ])
  assert.equal(map.status, 'problem')
  assert.equal(map.problems, 1)
  assert.equal(map.workloads[0].status, 'problem')
  assert.equal(map.workloads[0].ready, 1)
  assert.equal(map.access.status, 'ok')
  assert.equal(map.workloads[0].pods[1].restarts, 5)
})

test('with no ready web pod the public access is down', () => {
  const map = buildAppMap('backend', spec({ web: { replicaCount: 1 } }), [
    pod('backend-kuberoapp-web-1-a', {}, { ready: false, waitingReason: 'ImagePullBackOff' }),
  ])
  assert.equal(map.access.status, 'problem')
  const starting = buildAppMap('backend', spec({ web: { replicaCount: 1 } }), [pod('backend-kuberoapp-web-1-a', {}, { ready: false, waitingReason: 'ContainerCreating' })])
  assert.deepEqual([starting.status, starting.access.status], ['progress', 'progress'])
})

test('worker pods, https, git apps and other apps in the namespace', () => {
  const map = buildAppMap('backend', spec({
    worker: { replicaCount: 1 },
    ingress: { enabled: true, hosts: [{ host: 'backend.inf.uct.cl' }], tls: [{ hosts: ['backend.inf.uct.cl'] }] },
    deploymentstrategy: 'git', gitrepo: { clone_url: 'https://github.com/uct/proyecto-final.git' }, branch: 'main',
  }), [
    pod('backend-kuberoapp-web-1-a'),
    pod('backend-kuberoapp-worker-2-b'),
    pod('frontend-kuberoapp-web-3-c'),
  ])
  assert.deepEqual(map.workloads.map((w) => [w.kind, w.pods.length]), [['web', 1], ['worker', 1]])
  assert.equal(map.access.url, 'https://backend.inf.uct.cl')
  assert.deepEqual(map.source, { type: 'git', label: 'uct/proyecto-final · main' })
})

test('a pod that cannot be scheduled says why', () => {
  const pending = (message) => classifyPod({ name: 'a', status: 'Pending', containers: [], unschedulable: message })
  assert.deepEqual([pending('0/1 nodes are available: 1 Insufficient memory.').reason, pending('0/1 nodes are available: 1 Insufficient cpu.').reason],
    ['noResources', 'noResources'])
  assert.equal(pending('pod has unbound immediate PersistentVolumeClaims').reason, 'volumePending')
  assert.equal(pending('0/1 nodes are available: 1 Insufficient memory. preemption: 0/1 nodes are available: 1 No preemption victims found.').rawReason,
    '0/1 nodes are available: 1 Insufficient memory.')
  const other = pending('0/1 nodes are available: 1 node(s) had untolerated taint')
  assert.deepEqual([other.status, other.reason, other.action], ['problem', 'unschedulable', 'events'])
})

test('add-on status comes from its pods, and stays neutral when it could not be loaded', () => {
  const pg = (pods) => [{ name: 'backend-postgres', kind: 'KuberoAddonPostgres', pods }]
  const healthy = [pod('backend-kuberoapp-web-1-a'), pod('backend-kuberoapp-web-1-b')]
  assert.equal(buildAppMap('backend', spec(), healthy).addons[0].status, 'neutral')
  assert.equal(buildAppMap('backend', spec(), healthy, pg([pod('backend-postgres-0')])).addons[0].status, 'ok')
  const none = buildAppMap('backend', spec(), healthy, pg([]))
  assert.deepEqual([none.addons[0].status, none.addons[0].reason, none.status], ['progress', 'noPods', 'progress'])
  const stuck = buildAppMap('backend', spec(), healthy, pg([{ name: 'backend-postgres-0', status: 'Pending', containers: [], unschedulable: 'pod has unbound immediate PersistentVolumeClaims' }]))
  assert.deepEqual([stuck.addons[0].status, stuck.addons[0].reason, stuck.addons[0].action], ['problem', 'volumePending', 'events'])
  assert.deepEqual([stuck.status, stuck.problems, stuck.access.status], ['problem', 1, 'ok'])
})

test('cron schedules are described in words when they are a common case', () => {
  assert.deepEqual(describeCron('0 3 * * *'), { kind: 'daily', time: '03:00' })
  assert.deepEqual(describeCron('*/15 * * * *'), { kind: 'everyMinutes', n: 15 })
  assert.deepEqual(describeCron('* * * * *'), { kind: 'everyMinute' })
  assert.deepEqual(describeCron('5 * * * *'), { kind: 'hourly', minute: '05' })
  assert.deepEqual(describeCron('30 */6 * * *'), { kind: 'everyHours', n: 6, minute: '30' })
  assert.deepEqual(describeCron('0 8 * * 1-5'), { kind: 'weekly', days: [1, 2, 3, 4, 5], time: '08:00' })
  assert.deepEqual(describeCron('0 0 * * 0,7'), { kind: 'weekly', days: [0], time: '00:00' })
  assert.deepEqual(describeCron('15 2 1 * *'), { kind: 'monthly', day: 1, time: '02:15' })
  assert.deepEqual(describeCron('@daily'), { kind: 'daily', time: '00:00' })
  for (const raw of ['0 3 * 1 *', '0 3 1 * 1', 'cada día', '61 3 * * *', '0 3 * * MON']) assert.equal(describeCron(raw), null, raw)
  assert.deepEqual(buildAppMap('backend', spec(), []).cronjobs[0].description, { kind: 'daily', time: '03:00' })
})

test('an app without ingress, addons or cronjobs, and with missing fields, still builds', () => {
  const map = buildAppMap('backend', { ingress: { enabled: false, hosts: [{ host: 'x' }] } }, [])
  assert.equal(map.access, null)
  assert.deepEqual([map.addons, map.cronjobs], [[], []])
  assert.deepEqual([map.workloads[0].kind, map.workloads[0].status], ['web', 'progress'])
  assert.equal(buildAppMap('backend', undefined, []).workloads.length, 1)
})
