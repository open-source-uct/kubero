import { test, expect, field } from './fixtures'

for (const variant of [
  { theme: 'light', locale: 'en', width: 1280, height: 900, from: 'From', to: 'To' },
  { theme: 'dark', locale: 'es', width: 390, height: 844, from: 'Desde', to: 'Hasta' },
]) {
  test(`activity date labels stay with their inputs in ${variant.theme}/${variant.locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('kubero.locale', locale) }, variant)
    await page.goto('/activity')
    const from = field(page, 'from')
    const to = field(page, 'to')
    await expect(from).toHaveAccessibleName(variant.from)
    await expect(to).toHaveAccessibleName(variant.to)
    const fromControl = page.locator('.v-input').filter({ has: from }).locator('.v-field')
    const toControl = page.locator('.v-input').filter({ has: to }).locator('.v-field')
    const fromBox = (await fromControl.boundingBox())!
    const toBox = (await toControl.boundingBox())!
    for (const [control, text] of [[fromControl, variant.from], [toControl, variant.to]] as const) {
      const label = control.locator('.v-field-label--floating')
      await expect(label).toHaveText(text)
      const labelBox = (await label.boundingBox())!
      const inputBox = (await control.boundingBox())!
      expect(labelBox.x).toBeGreaterThanOrEqual(inputBox.x)
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(inputBox.x + inputBox.width)
      expect(Math.abs(labelBox.y - inputBox.y)).toBeLessThan(12)
    }
    if (variant.width > 1100) {
      expect(Math.abs(fromBox.y - toBox.y)).toBeLessThan(1)
      expect(toBox.x).toBeGreaterThan(fromBox.x + fromBox.width)
      const otherFilters = page.locator('.activity-toolbar > .v-combobox .v-field')
      for (const control of await otherFilters.all()) {
        expect(Math.abs((await control.boundingBox())!.y - fromBox.y)).toBeLessThan(1)
      }
    } else {
      expect(Math.abs(fromBox.x - toBox.x)).toBeLessThan(1)
      expect(toBox.y).toBeGreaterThanOrEqual(fromBox.y + fromBox.height)
    }
    await page.locator('.activity-toolbar').screenshot({ path: testInfo.outputPath(`activity-${variant.theme}.png`) })
  })
}
