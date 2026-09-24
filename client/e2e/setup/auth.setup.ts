import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.resolve(__dirname, '../.auth/user.json');

setup('Autenticar usuario admin y guardar estado de sesion', async ({ page }) => {
  const user = process.env.E2E_USERNAME || 'admin';
  const password = process.env.E2E_PASSWORD || 'Ypoy1lnew/sTRJUpg5I';

  // Asegurar que el directorio de almacenamiento de sesión existe
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/login');

  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginButton = page.locator('button[type="submit"]').first();

  // Espera basada en visibilidad reactiva de inputs (auto-waiting)
  await expect(usernameInput).toBeVisible({ timeout: 15000 });
  await usernameInput.fill(user);
  await passwordInput.fill(password);
  await loginButton.click();

  // Esperar a que la autenticación procese y redirija fuera de /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.goto('/profile');
  await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });

  // Validar que la cookie de sesión JWT exista antes de persistir el estado
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find((c) => c.name === 'kubero.JWT_TOKEN');
  expect(tokenCookie, 'La cookie kubero.JWT_TOKEN debe existir tras el login').toBeTruthy();

  // Guardar estado de almacenamiento (cookies, tokens, localStorage)
  await page.context().storageState({ path: authFile });
});
