import { test as baseTest, expect } from '@playwright/test';

type TestFixtures = {
  consoleErrors: string[];
  serverErrors: string[];
};

export const test = baseTest.extend<TestFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignorar warnings menores de red que no representen fallos de la app
        if (!text.includes('favicon.ico') && !text.includes('net::ERR_FAILED')) {
          errors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`Excepción no controlada: ${err.message}`);
    });

    await use(errors);

    // Verificación estricta: Si está activado E2E_FAIL_ON_CONSOLE_ERROR, fallar ante errores críticos
    if (process.env.E2E_FAIL_ON_CONSOLE_ERROR === 'true' && errors.length > 0) {
      // Excluir errores benignos si los hubiera
      const criticalErrors = errors.filter(e => !e.includes('Socket connection'));
      if (criticalErrors.length > 0) {
        throw new Error(`Se detectaron errores en la consola del navegador:\n${criticalErrors.join('\n')}`);
      }
    }
  },

  serverErrors: async ({ page }, use) => {
    const serverFailures: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 500) {
        serverFailures.push(`[${status}] en ${url}`);
      }
    });

    await use(serverFailures);

    if (serverFailures.length > 0) {
      throw new Error(`Se detectaron errores 5xx del servidor:\n${serverFailures.join('\n')}`);
    }
  },
});

export { expect };
