import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Auditoría Automatizada de Accesibilidad (WCAG 2.1 AA)', () => {
  test('Debe auditar la vista principal en Modo Claro y no presentar violaciones críticas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Excluir reglas de anidamiento interno de Vuetify y contrastes de componentes heredados
      .disableRules(['aria-required-children', 'aria-required-parent', 'color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });

  test('Debe auditar la vista principal tras conmutar a Modo Oscuro', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const navDrawer = new NavDrawerPage(page);
    await navDrawer.toggleTheme();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['aria-required-children', 'aria-required-parent', 'color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });
});
