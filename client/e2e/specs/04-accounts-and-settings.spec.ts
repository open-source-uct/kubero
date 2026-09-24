import { test, expect } from '../fixtures/test-base';
import { SettingsPage } from '../page-objects/settings.page';

test.describe('Vistas de Administración: Cuentas y Configuración de Recursos', () => {
  test('Debe listar las cuentas del clúster incluyendo admin y system en /accounts', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.gotoAccounts();
    await settings.expectUsersList();
  });

  test('Debe listar los perfiles de recursos small, medium y large en /podsizes', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.gotoPodsizes();
    await settings.expectPodsizes();
  });
});
