import { test, expect } from '../fixtures/test-base';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Diálogo Modal de Versión y Diagnóstico', () => {
  test('Debe abrir el modal de versión, verificar los datos del clúster y cerrarse correctamente', async ({ page }) => {
    await page.goto('/profile');
    const navDrawer = new NavDrawerPage(page);
    await expect(navDrawer.drawer).toBeVisible({ timeout: 15000 });

    // 1. Abrir diálogo de versión
    await navDrawer.openVersionDialog();

    // 2. Verificar contenido del diagnóstico (versión del clúster y UI)
    const textarea = navDrawer.versionDialog.locator('textarea[name="debug"]');
    await expect(textarea).toBeVisible();
    const debugText = await textarea.inputValue();
    expect(debugText).toContain('Kubero UI Version: dev');
    expect(debugText).toMatch(/Kubernetes Version: (v1\.|unknown)/);

    // 3. Cerrar diálogo
    await navDrawer.closeVersionDialog();
  });
});
