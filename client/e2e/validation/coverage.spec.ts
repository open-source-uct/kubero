import AxeBuilder from '@axe-core/playwright'
import { test, expect, field } from './fixtures'

test('advanced app errors stay active when advanced settings are hidden', async ({ page, writes }) => {
  await page.goto('/pipeline/course/production/apps/new')
  await field(page, 'name').fill('course-app')
  await page.getByRole('checkbox', { name: 'Advanced App Configuration' }).check()
  await page.getByRole('button', { name: 'Security', exact: true }).click()
  await field(page, 'uid').fill('-1')
  await page.getByRole('checkbox', { name: 'Advanced App Configuration' }).uncheck()
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
  await page.locator('.validation-summary button').filter({ hasText: 'Run as User' }).click()
  await expect(field(page, 'uid')).toBeFocused()
  await field(page, 'uid').fill('0')
  await expect(page.locator('button[type="submit"]')).toBeEnabled()
  expect(writes).toHaveLength(0)
})

test('avatar files are checked before upload', async ({ page, writes }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Edit Avatar', exact: true }).click()
  const input = page.locator('input[type="file"]')
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(102401) })
  await expect(page.getByRole('dialog').locator('button[type="submit"]')).toBeDisabled()
  await input.setInputFiles({ name: 'small.png', mimeType: 'image/png', buffer: Buffer.alloc(32) })
  await page.getByRole('dialog').locator('button[type="submit"]').click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].path).toBe('/api/users/profile/avatar')
})

test('login keeps its original fields without validation feedback or input-based blocking', async ({ page, writes }) => {
  await page.route('**/api/auth/login', async route => {
    writes.push({ method: 'POST', path: '/api/auth/login', body: route.request().postDataJSON() })
    await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
  })
  await page.goto('/login')
  const username = page.locator('input[name="username"]')
  const password = page.locator('input[name="password"]')
  await username.waitFor({ state: 'visible' })
  await expect(page.locator('button[type="submit"]')).toBeEnabled()
  await username.fill(' ')
  await username.press('Tab')
  await password.fill('old')
  await password.press('Tab')
  await expect(page.locator('.validated-field, .validation-summary, .validation-requirements')).toHaveCount(0)
  await expect(page.locator('button[type="submit"]')).toBeEnabled()
  await password.press('Enter')
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].body).toEqual({ username: ' ', password: 'old' })
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong username or password' })).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeEnabled()
})

test('reset still requires eight matching characters', async ({ page, writes }) => {
  await page.goto('/reset-password?token=fixture-token')
  await field(page, 'password').fill('short')
  await field(page, 'confirmation').fill('short')
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
  await field(page, 'password').fill('abcdefgh')
  await field(page, 'confirmation').fill('abcdefgh')
  await page.locator('button[type="submit"]').click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].path).toBe('/api/auth/reset-password')
})

test('team forms require a description and preserve human names', async ({ page, writes }) => {
  await page.goto('/accounts/teams')
  await expect(page.locator('.account-data-table')).toBeVisible()
  await page.getByRole('button', { name: /Create/i }).first().click()
  await field(page, 'name').fill('Curso de Ingeniería')
  await expect(page.getByRole('dialog').locator('button[type="submit"]')).toBeDisabled()
  await field(page, 'description').fill('Equipo docente')
  await page.getByRole('dialog').locator('button[type="submit"]').click()
  await expect.poll(() => writes.length).toBe(1)
})

test('invalid activity date ranges prevent another audit request', async ({ page, writes }) => {
  let requests = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/audit') requests++ })
  await page.goto('/activity')
  await field(page, 'from').waitFor({ state: 'visible' })
  await expect.poll(() => requests).toBe(1)
  await field(page, 'from').fill('2026-11-16')
  await field(page, 'to').fill('2026-11-15')
  await field(page, 'to').press('Tab')
  await page.getByRole('heading', { name: 'Activity', exact: true }).click()
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
  await expect(field(page, 'to')).toHaveAttribute('aria-invalid', 'true')
  expect(requests).toBe(1)
  expect(writes).toHaveLength(0)
})

test('configured OAuth secrets can be kept without being re-entered', async ({ page, writes }) => {
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: 'Github', exact: true }).check()
  await field(page, 'github-id').fill('fixture-client')
  await field(page, 'github-callbackUrl').fill('https://example.test/callback')
  await field(page, 'GITHUB_CLIENT_SECRET').fill('')
  await page.locator('button[type="submit"]').click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].body.secrets).toHaveProperty('GITHUB_CLIENT_SECRET', 'synthetic-fixture')
})

for (const variant of [
  { theme: 'light', locale: 'en', width: 1280, height: 900 },
  { theme: 'dark', locale: 'es', width: 390, height: 844 },
]) {
  test(`validation is accessible in ${variant.theme}/${variant.locale} at ${variant.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('kubero.locale', locale) }, variant)
    await page.goto('/pipeline/course/production/apps/new')
    await field(page, 'name').fill('course-app')
    await field(page, 'port').fill('0')
    await field(page, 'port').press('Tab')
    await expect(field(page, 'port')).toHaveAttribute('aria-invalid', 'true')
    const result = await new AxeBuilder({ page }).include('.app-form').analyze()
    expect(result.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`app-${variant.theme}.png`), fullPage: true })
    await page.goto('/pipeline/new')
    await field(page, 'name').fill('Upper_Name')
    await field(page, 'name').press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
    const pipelineResult = await new AxeBuilder({ page }).include('.pipeline-form').analyze()
    expect(pipelineResult.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`pipeline-${variant.theme}.png`), fullPage: true })
  })
}
