import { test, expect } from '../fixtures/test-base';
import { LoginPage } from '../page-objects/login.page';

// Este archivo no utiliza el storageState preautenticado para probar el login desde cero de forma aislada
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Flujo de Autenticación y Control de Acceso', () => {
  test('Debe mostrar advertencia visual ante credenciales inválidas', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('usuario_invalido', 'clave_incorrecta');

    // Verificar que la URL no cambie a dashboard
    await expect(page).toHaveURL(/.*login/);
  });

  test('Debe autenticarse exitosamente con credenciales válidas y acceder al sistema', async ({ page }) => {
    const user = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(user!, password!);

    // Esperar a que la autenticación procese y redirija fuera de /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Navegar a /profile donde el NavDrawer está siempre disponible y desacoplado
    await page.goto('/profile');
    await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });

    // Confirmar que el token de sesión se asignó en este contexto
    const cookies = await page.context().cookies();
    const jwtCookie = cookies.find((c) => c.name === 'kubero.JWT_TOKEN');
    expect(jwtCookie, 'La cookie kubero.JWT_TOKEN debe existir tras login').toBeTruthy();
  });
});
