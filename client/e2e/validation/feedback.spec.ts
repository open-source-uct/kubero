import { test, expect, field } from './fixtures'

for (const variant of [
  { theme: 'light', locale: 'en', width: 1280, height: 900, name: 'Name', description: 'Description' },
  { theme: 'dark', locale: 'es', width: 390, height: 844, name: 'Nombre', description: 'Descripción' },
]) {
  test(`mandatory fields use one marker without repeated messages in ${variant.theme}/${variant.locale}`, async ({ page, writes }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('kubero.locale', locale) }, variant)
    await page.goto('/pipeline/new')
    const name = field(page, 'name')
    await name.waitFor({ state: 'visible' })
    const id = await name.getAttribute('id')
    const label = page.locator(`label[for="${id}"]`)
    await expect(label.locator('span.validation-error')).toHaveText('*')
    await expect(label.locator('span.validation-error')).toHaveCount(1)
    await expect(name).toHaveAttribute('aria-required', 'true')
    await name.focus()
    await name.press('Tab')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(/This field is required|Este campo es obligatorio/)).toHaveCount(0)
    await expect(page.locator('.validation-summary button').first()).toHaveText(variant.name)
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
    await name.press('Enter')
    expect(writes).toHaveLength(0)
    // Formatting requirements still react while typing, including after blur.
    await name.fill('Upper_Name')
    await expect(page.locator('.v-input').filter({ has: name }).locator('.validation-requirements li.validation-error')).not.toHaveCount(0)
    await name.fill('course-pipeline')
    await expect(page.locator('button[type="submit"]')).toBeEnabled()

    // A field with only the mandatory rule needs no requirement list or error text.
    await page.goto('/accounts/teams')
    await expect(page.locator('.account-data-table')).toBeVisible()
    await page.getByRole('button', { name: /Create|Crear/i }).first().click()
    await field(page, 'name').fill('Curso de Ingeniería')
    const description = field(page, 'description')
    await description.focus()
    await description.press('Tab')
    await expect(description).toHaveAttribute('aria-invalid', 'true')
    await expect(description).toHaveAttribute('aria-required', 'true')
    await expect(page.locator('.v-input').filter({ has: description }).locator('.validation-requirements, .v-messages__message')).toHaveCount(0)
    const summaryLink = page.getByRole('dialog').locator('.validation-summary button')
    await expect(summaryLink).toHaveText(variant.description)
    await summaryLink.click()
    await expect(description).toBeFocused()
    await description.fill('Equipo docente')
    await expect(description).not.toHaveAttribute('aria-invalid', 'true')
    await page.getByRole('dialog').locator('button[type="submit"]').click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0].path).toBe('/api/groups')
  })
}
