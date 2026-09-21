import { test, expect } from '../fixtures/test-base';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Conmutación de Temas Institucionales UCT (Light / Dark)', () => {
  test('Debe alternar entre Modo Claro y Modo Oscuro actualizando las clases de Vuetify y manteniendo la interactividad', async ({ page }) => {
    await page.goto('/');
    const navDrawer = new NavDrawerPage(page);
    await expect(navDrawer.drawer).toBeVisible({ timeout: 15000 });
    const initialTheme = await navDrawer.getCurrentTheme();

    // 1. Conmutar al tema opuesto
    await navDrawer.toggleTheme();
    const secondTheme = await navDrawer.getCurrentTheme();
    expect(secondTheme).not.toBe(initialTheme);

    // 2. Verificar que los botones primarios sigan visibles y con texto legible
    const actionBtn = page.getByRole('button', { name: /new|create your first pipeline/i }).first();
    if (await actionBtn.isVisible()) {
      await expect(actionBtn).toBeEnabled();
    }

    // 3. Conmutar de regreso al tema inicial
    await navDrawer.toggleTheme();
    const finalTheme = await navDrawer.getCurrentTheme();
    expect(finalTheme).toBe(initialTheme);
  });
});
