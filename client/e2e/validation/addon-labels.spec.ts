import { test, expect, field } from './fixtures'

for (const variant of [
  { theme: 'light', locale: 'en', width: 1280, height: 900, color: 'rgb(185, 28, 28)' },
  { theme: 'dark', locale: 'es', width: 390, height: 844, color: 'rgb(252, 165, 165)' },
]) {
  test(`legacy addon labels have a single red marker in ${variant.theme}/${variant.locale}`, async ({ page, writes }, testInfo) => {
    const fields = [
      { name: 'metadata.name', label: 'PostgreSQL Instance Name', type: 'text', default: 'postgresql', required: true },
      { name: 'spec.postgresql.image.tag', label: 'Version/Tag *', type: 'combobox', default: '16', required: true, options: ['16', '17'] },
      { name: 'spec.postgresql.auth.postgresPassword', label: 'Postgres admin Password*', type: 'text', default: '', required: true },
      { name: 'spec.postgresql.auth.username', label: 'Username*', type: 'text', default: '', required: true },
      { name: 'spec.postgresql.auth.password', label: 'User Password * *', type: 'text', default: '', required: true },
      { name: 'spec.postgresql.auth.database', label: 'Database*', type: 'text', default: 'postgresql', required: true },
    ]
    await page.route('**/api/addons', route => route.fulfill({ json: [{
      id: 'postgres', kind: 'KuberoPostgresql', displayName: 'Postgresql (Bitnami)', version: 'v1', env: [], icon: '', enabled: true,
      formfields: Object.fromEntries(fields.map(definition => ['KuberoPostgresql.' + definition.name, definition])),
      resourceDefinitions: { KuberoPostgresql: { metadata: { name: 'postgresql' }, spec: { postgresql: { auth: {} } } } },
    }] }))
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('kubero.locale', locale) }, variant)
    await page.goto('/pipeline/course/production/apps/new')
    await field(page, 'name').fill('course-app')
    await page.getByText(/Add addon|Agregar addon/, { exact: true }).click()
    await page.locator('.v-select').filter({ has: field(page, 'addon') }).locator('.v-field').click()
    await page.getByRole('option', { name: 'Postgresql (Bitnami)', exact: true }).click()
    for (const definition of fields) {
      const input = field(page, 'addon-' + definition.name)
      const labels = page.locator('.validated-field').filter({ has: input }).locator('.v-field-label')
      await expect(labels.first()).toContainText(definition.label.split('*')[0].trim())
      for (const text of await labels.allTextContents()) expect(text.match(/\*/g)).toHaveLength(1)
      await expect(labels.first().locator('span.validation-error')).toHaveCSS('color', variant.color)
      await expect(input).toHaveAttribute('aria-required', 'true')
      await expect(input).toHaveAccessibleName(definition.label.split('*')[0].trim())
    }
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.validation-summary button').filter({ hasText: 'Username' })).toHaveText('Username')
    await expect(dialog.locator('button[type="submit"]')).toBeDisabled()
    await field(page, 'addon-spec.postgresql.auth.username').press('Enter')
    expect(writes).toHaveLength(0)
    await dialog.screenshot({ path: testInfo.outputPath(`addon-${variant.theme}.png`) })
    for (const name of ['postgresPassword', 'username', 'password']) {
      await field(page, 'addon-spec.postgresql.auth.' + name).fill('synthetic-fixture')
    }
    await expect(dialog.locator('button[type="submit"]')).toBeEnabled()
  })
}
