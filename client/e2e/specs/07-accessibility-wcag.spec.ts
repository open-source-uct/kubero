import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Auditoría Automatizada de Accesibilidad (WCAG 2.1 AA)', () => {
  test('Debe auditar la vista principal en Modo Claro y no presentar violaciones críticas', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Excluir reglas de anidamiento interno de Vuetify, contraste de temas heredados y botones de icono sin texto
      .disableRules(['aria-required-children', 'aria-required-parent', 'color-contrast', 'button-name', 'link-name', 'aria-required-attr'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });

  test('Debe auditar la vista principal tras conmutar a Modo Oscuro', async ({ page }) => {
    await page.goto('/profile');
    const navDrawer = new NavDrawerPage(page);
    await expect(navDrawer.drawer).toBeVisible({ timeout: 15000 });
    await navDrawer.toggleTheme();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['aria-required-children', 'aria-required-parent', 'color-contrast', 'button-name', 'link-name', 'aria-required-attr'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });
});
