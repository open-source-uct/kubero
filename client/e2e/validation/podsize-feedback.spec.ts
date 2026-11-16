import { test, expect, field } from './fixtures'

for (const variant of [
  { theme: 'light', locale: 'en', width: 1280, height: 900 },
  { theme: 'dark', locale: 'es', width: 390, height: 844 },
]) {
  test(`pod resource selectors omit extra requirements in ${variant.theme}/${variant.locale}`, async ({ page, writes }, testInfo) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('kubero.locale', locale) }, variant)
    await page.goto('/podsizes')
    await page.getByRole('button', { name: /Create|Crear/i }).first().click()
    await field(page, 'name').fill('Course pod')
    await field(page, 'description').fill('For course apps')
    const dialog = page.getByRole('dialog')
    const submit = dialog.locator('button[type="submit"]')
    for (const id of ['requests-cpu', 'limits-cpu', 'requests-memory', 'limits-memory']) {
      const input = field(page, id)
      await input.focus()
      await input.press('Tab')
      await expect(input).toHaveAttribute('aria-required', 'true')
    }
    await expect(dialog.locator('.podsize-resources .validation-requirements')).toHaveCount(0)
    await expect(dialog.getByText(/Enter a valid Kubernetes quantity|Ingresa una cantidad Kubernetes válida/)).toHaveCount(0)
    await expect(submit).toBeDisabled()
    await dialog.screenshot({ path: testInfo.outputPath(`podsize-${variant.theme}.png`) })
    for (const id of ['requests-cpu', 'limits-cpu', 'requests-memory', 'limits-memory']) {
      await page.locator('.v-select').filter({ has: field(page, id) }).locator('.v-field').click()
      const menuId = await field(page, id).getAttribute('aria-controls')
      await page.locator(`[id="${menuId}"]`).getByRole('option').first().click()
    }
    await expect(submit).toBeEnabled()
    // The reserve/limit relationship still matters even with fixed choices.
    for (const id of ['requests-cpu', 'limits-cpu']) {
      await page.locator('.v-select').filter({ has: field(page, id) }).locator('.v-field').click()
      const menuId = await field(page, id).getAttribute('aria-controls')
      await page.locator(`[id="${menuId}"]`).getByRole('option', { name: '1 (1 core)', exact: true }).click()
      if (id === 'requests-cpu') {
        await expect(submit).toBeDisabled()
        expect(writes).toHaveLength(0)
      }
    }
    await expect(dialog.locator('.podsize-resources .validation-requirements')).toHaveCount(0)
    await submit.click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0].body.resources).toEqual({ requests: { cpu: '1', memory: '64Mi' }, limits: { cpu: '1', memory: '64Mi' } })
  })
}
