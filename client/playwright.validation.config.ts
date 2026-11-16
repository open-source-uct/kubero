import { defineConfig, devices } from '@playwright/test'

// No real login, credentials or backend: every API request is handled by the fixture.
export default defineConfig({
  testDir: './e2e/validation',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm run run --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 60000 },
})
