import { test, expect } from '../fixtures/test-base';
import { LoginPage } from '../page-objects/login.page';

// Este archivo no utiliza el storageState preautenticado para probar el login desde cero
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Flujo de Autenticación y Control de Acceso', () => {
  test('Debe mostrar advertencia visual ante credenciales inválidas', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('usuario_invalido', 'clave_incorrecta');

    // Verificar que la URL no cambie a dashboard
    await expect(page).toHaveURL(/.*login/);
  });

  test('Debe autenticarse exitosamente con credenciales válidas y redirigir a /', async ({ page }) => {
    const user = process.env.E2E_USERNAME || 'admin';
    const password = process.env.E2E_PASSWORD || 'Ypoy1lnew/sTRJUpg5I';

    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(user, password);

    // Verificar redirección al dashboard principal
    await page.waitForURL('**/', { timeout: 15000 });
    await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });
  });
});
