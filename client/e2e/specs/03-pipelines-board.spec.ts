import { test, expect } from '../fixtures/test-base';
import { PipelineBoardPage } from '../page-objects/pipeline-board.page';

test.describe('Tablero de Pipelines y Estado del Clúster Kubernetes', () => {
  test('Debe confirmar conexión activa al clúster y cargar el tablero sin alertas de desconexión', async ({ page }) => {
    const pipelinePage = new PipelineBoardPage(page);
    await pipelinePage.goto();
    await pipelinePage.expectLoaded();

    // Confirmar que no hay errores de conexión a Kubernetes
    const disconnectedBanner = page.locator('.v-alert--type-error').filter({
      hasText: /cluster disconnected|cannot connect/i,
    });
    await expect(disconnectedBanner).not.toBeVisible();

    // Verificar que el botón primario de acción o banner de bienvenida se renderice
    await expect(pipelinePage.welcomeCard).toBeVisible({ timeout: 10000 });
  });
});
