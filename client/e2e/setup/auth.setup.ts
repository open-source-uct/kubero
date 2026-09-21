import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.resolve(__dirname, '../.auth/user.json');

setup('Autenticar usuario admin y guardar estado de sesion', async ({ page }) => {
  const user = process.env.E2E_USERNAME || 'admin';
  const password = process.env.E2E_PASSWORD || 'Ypoy1lnew/sTRJUpg5I';

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginButton = page.locator('button[type="submit"]').first();

  await expect(usernameInput).toBeVisible({ timeout: 10000 });
  await usernameInput.fill(user);
  await passwordInput.fill(password);
  await loginButton.click();

  // Esperar a que la redirección a / ocurra y la sesión sea válida
  await page.waitForURL('**/', { timeout: 15000 });
  await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });

  // Guardar estado de almacenamiento (cookies, tokens, localStorage)
  await page.context().storageState({ path: authFile });
});
