import { test, expect } from '../fixtures/test-base';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Diálogo Modal de Versión y Diagnóstico', () => {
  test('Debe abrir el modal de versión, verificar los datos del clúster y cerrarse correctamente', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const navDrawer = new NavDrawerPage(page);

    // 1. Abrir diálogo de versión
    await navDrawer.openVersionDialog();

    // 2. Verificar contenido del diagnóstico (versión del clúster y UI)
    const textarea = navDrawer.versionDialog.locator('textarea[name="debug"]');
    await expect(textarea).toBeVisible();
    const debugText = await textarea.inputValue();
    expect(debugText).toContain('Kubero UI Version: dev');
    expect(debugText).toContain('Kubernetes Version: v1.37.0');

    // 3. Cerrar diálogo
    await navDrawer.closeVersionDialog();
  });
});
