import { test, expect, field } from './fixtures'

test('addon dialogs validate prefixed names and passwords independently of the app form', async ({ page, writes }) => {
  const addon = {
    id: 'postgres', kind: 'KuberoAddonPostgres', displayName: 'Postgres', version: 'v1', env: [], icon: '', enabled: true,
    formfields: {
      'KuberoAddonPostgres.metadata.name': { name: 'metadata.name', label: 'Database name', type: 'text', default: 'db', required: true },
      'KuberoAddonPostgres.spec.postgres.auth.postgresPassword': { name: 'spec.postgres.auth.postgresPassword', label: 'Postgres password', type: 'text', default: '', required: false },
    },
    resourceDefinitions: { KuberoAddonPostgres: { metadata: { name: 'db' }, spec: { postgres: { auth: { enablePostgresUser: true } } } } },
  }
  await page.route('**/api/addons', route => route.fulfill({ json: [addon] }))
  await page.goto('/pipeline/course/production/apps/new')
  await field(page, 'name').fill('course-app')
  await page.getByText('Add addon', { exact: true }).click()
  await page.locator('.v-select').filter({ has: field(page, 'addon') }).locator('.v-field').click()
  await page.getByRole('option', { name: 'Postgres', exact: true }).click()
  const submit = page.getByRole('dialog').locator('button[type="submit"]')
  await expect(submit).toBeDisabled()
  await field(page, 'addon-spec.postgres.auth.postgresPassword').fill('synthetic-fixture')
  await field(page, 'addon-metadata.name').fill('a'.repeat(60))
  await expect(submit).toBeDisabled()
  await field(page, 'addon-metadata.name').fill('db')
  await submit.click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.locator('form form')).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('template installation requires an available pipeline and enabled phase', async ({ page, writes }) => {
  await page.route('**/api/config/templates', route => route.fulfill({ json: { enabled: true, catalogs: [{ name: 'Fixture', index: { url: 'http://127.0.0.1:5174/fixture-catalog.json' } }] } }))
  await page.route('**/fixture-catalog.json', route => route.fulfill({ json: { services: [{ name: 'Course WordPress', dirname: 'wordpress', description: 'Fixture template', enabled: false, categories: ['Course'], screenshots: [], template: 'https://example.test/template.yaml', icon: '', addons: [], language: 'PHP' }], categories: {} } }))
  await page.goto('/templates')
  await page.getByRole('button', { name: 'Install', exact: true }).click()
  const install = page.getByRole('dialog').getByRole('button', { name: 'Install', exact: true })
  await expect(install).toBeDisabled()
  await page.locator('.v-select').filter({ has: field(page, 'pipeline') }).locator('.v-field').click()
  await page.getByRole('option', { name: 'course', exact: true }).click()
  await expect(install).toBeDisabled()
  await page.locator('.v-select').filter({ has: field(page, 'phase') }).locator('.v-field').click()
  await page.getByRole('option', { name: 'production', exact: true }).click()
  await expect(install).toBeEnabled()
  expect(writes).toHaveLength(0)
})

test('role editing preserves the fixed role name and existing permissions', async ({ page, writes }) => {
  await page.goto('/accounts/roles')
  await page.getByRole('button', { name: 'Edit profesor', exact: true }).click()
  await expect(field(page, 'name')).toBeDisabled()
  await page.getByRole('dialog').locator('button[type="submit"]').click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].body.name).toBe('profesor')
  expect(writes[0].body.permissions).toEqual(expect.arrayContaining([expect.objectContaining({ resource: 'app', action: 'none' })]))
})
