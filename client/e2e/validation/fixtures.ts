import { test as base, expect, type Page } from '@playwright/test'

export const stage = () => ({ repository: 'node', tag: '22', command: '', readOnlyAppStorage: false, securityContext: { runAsUser: 0, runAsGroup: 0, runAsNonRoot: false, readOnlyRootFilesystem: false, allowPrivilegeEscalation: false, capabilities: { add: [], drop: [] } } })
export const resources = () => ({ requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '1', memory: '512Mi' } })
export const pipeline = () => ({ name: 'course', pipelineName: 'course', domain: 'example.test', access: { teams: ['course'] }, deploymentstrategy: 'docker', buildstrategy: 'plain', phases: ['review', 'test', 'stage', 'production'].map(name => ({ name, enabled: name === 'production', context: 'local', domain: '', defaultEnvvars: [] })) })
export const settings = () => ({
  secrets: { GITHUB_BASEURL: 'https://api.github.com', GITEA_BASEURL: '', GOGS_BASEURL: '', GITLAB_BASEURL: '', GITHUB_CLIENT_SECRET: 'synthetic-fixture', OAUTH2_CLIENT_SECRET: '', KUBERO_WEBHOOK_SECRET: 'synthetic-fixture' },
  settings: { kubero: { namespace: 'kubero', webhook_url: 'https://example.test/hooks', auth: { github: { enabled: false, id: '', org: '', callbackUrl: '' }, oauth2: { enabled: false, name: '', id: '', authUrl: '', tokenUrl: '', callbackUrl: '', scopes: '' } },
    auditLogs: { enabled: false, limit: '1000', size: '1Gi', storageClassName: '' },
    config: { podSizeList: [], buildPacks: [], templates: { enabled: true, catalogs: [] }, kubero: { readonly: false, admin: { disabled: false }, console: { enabled: false }, banner: { show: false, message: '', bgcolor: 'azure', fontcolor: 'black' } } },
  } },
})
export interface CapturedRequest { method: string; path: string; body: Record<string, unknown> }
export const test = base.extend<{ writes: CapturedRequest[] }>({
  writes: [async ({ page }, use) => {
    const writes: CapturedRequest[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => { localStorage.setItem('kubero.locale', 'en'); localStorage.setItem('kubero.theme', 'light') })
    await page.route('**/socket.io/**', route => route.abort())
    await page.route('**/api/**', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const method = request.method()
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        // Every mutation is fulfilled here; no request can reach a database or cluster.
        let body: Record<string, unknown> = {}
        if (request.headers()['content-type']?.includes('application/json')) body = request.postDataJSON() as Record<string, unknown>
        writes.push({ method, path, body })
        await new Promise(resolve => setTimeout(resolve, 80))
        return route.fulfill({ status: method === 'POST' ? 201 : 200, json: { id: 'fixture', valid: true, status: 'ok', name: body.name, token: 'synthetic-fixture' } })
      }
      let json: unknown = []
      if (path === '/api/auth/session') json = { session: true, version: 'test', user: { userId: 'fixture-admin', username: 'fixture-admin', role: 'admin', userGroups: ['course'], personalTeam: 'course', permissions: ['app:read', 'app:write', 'pipeline:read', 'pipeline:write', 'user:read', 'user:write', 'config:read', 'config:write', 'token:ok', 'token:write', 'audit:read'] } }
      else if (path === '/api/auth/methods') json = { local: true, github: false, oauth2: false }
      else if (path === '/api/users/profile') json = { id: 'fixture-admin', username: 'fixture-admin', firstName: 'Test', lastName: 'User', email: 'test@example.test', role: { name: 'admin' }, userGroups: [] }
      else if (path === '/api/config') json = settings()
      else if (path === '/api/config/banner') json = { show: false }
      else if (path === '/api/pipelines') json = { items: [pipeline()] }
      else if (path === '/api/pipelines/course') json = pipeline()
      else if (path === '/api/pipelines/course/apps') json = { ...pipeline(), phases: pipeline().phases.map(phase => ({ ...phase, apps: [] })), git: { provider: '', repository: { ssh_url: '' } } }
      else if (path === '/api/kubernetes/contexts') json = [{ name: 'local' }]
      else if (path === '/api/config/clusterissuer') json = { clusterissuer: 'letsencrypt' }
      else if (path === '/api/config/podsizes') json = [{ id: 'small', name: 'Small', description: 'Small pod', resources: resources() }]
      else if (path === '/api/config/runpacks') json = [{ id: 'node', name: 'Node', language: 'JavaScript', fetch: stage(), build: stage(), run: stage() }]
      else if (path === '/api/groups') json = [{ id: 'course', name: 'course', description: 'Course' }]
      else if (path === '/api/roles') json = [{ id: 'role', name: 'profesor', description: '', permissions: [] }]
      else if (path === '/api/users') json = [{ id: 'user', username: 'student', email: 'student@example.test', isActive: true, userGroups: [], role: { id: 'role', name: 'profesor' } }]
      else if (path === '/api/audit') json = { audit: [], count: 0, enabled: true }
      else if (path === '/api/config/templates') json = { enabled: true, catalogs: [] }
      return route.fulfill({ json })
    })
    await use(writes)
    expect(errors).toEqual([])
  }, { auto: true }],
})
export { expect }
export const field = (page: Page, id: string) => page.locator(`input[id$="-${id}"], textarea[id$="-${id}"]`).first()
