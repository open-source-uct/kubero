import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Carga variables de entorno desde client/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:2000';
const isHeadless = process.env.E2E_HEADLESS !== 'false';
const authFile = path.resolve(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  /* Ejecución secuencial para no sobrecargar el servidor en vivo ni generar condiciones de carrera */
  fullyParallel: false,
  workers: 1,
  /* Reintentos en CI */
  retries: process.env.CI ? 1 : 0,
  /* Timeout por prueba de 30 segundos */
  timeout: 30000,
  expect: {
    timeout: 7000,
  },
  /* Reporter estructurado en consola y reporte HTML interactivo */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: isHeadless,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
});
