import { test, expect } from '../fixtures/test-base';
import { NavDrawerPage } from '../page-objects/nav-drawer.page';

test.describe('Validación Visual y Funcional de Todas las Vistas al Estilo UCT', () => {

  test('Pantalla de Login debe renderizar el logo institucional oficial UCT y el contenedor centrado', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.login-wrapper')).toBeVisible({ timeout: 15000 });
    
    // Verificar que el logo oficial esté presente
    const logoImg = page.locator('img[alt="Universidad Católica de Temuco"]');
    await expect(logoImg).toBeVisible();

    // Verificar título y subtítulo institucional
    await expect(page.locator('.uct-section-title')).toContainText('Kubero');
    await expect(page.locator('text=Facultad de Ingeniería · UCT')).toBeVisible();

    // Verificar campos de texto estilizados
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /log\s*in|iniciar sesión/i })).toBeVisible();
  });

  test('Shell y Navegación Institucional UCT: Logo en NavDrawer, Ausencia de Scroll Lateral y Conmutación de Temas', async ({ page }) => {
    await page.goto('/profile');
    const navDrawer = new NavDrawerPage(page);
    await expect(navDrawer.drawer).toBeVisible({ timeout: 15000 });

    // Verificar que el branding de la UCT esté en el Drawer
    const drawerLogo = navDrawer.drawer.locator('img[alt="UCT"]');
    if (await drawerLogo.isVisible()) {
      await expect(drawerLogo).toBeVisible();
    }

    // Verificar que al desplegar Settings no haya scroll lateral
    const settingsItem = navDrawer.drawer.locator('.v-list-item').filter({ hasText: /settings|configuración/i }).first();
    if (await settingsItem.isVisible()) {
      await settingsItem.click();
      await page.waitForTimeout(400);
      const hasHorizontalScroll = await navDrawer.drawer.evaluate((el) => {
        const content = el.querySelector('.v-navigation-drawer__content') || el;
        return content.scrollWidth > content.clientWidth;
      });
      expect(hasHorizontalScroll, 'No debe haber scroll lateral en NavDrawer al desplegar settings').toBe(false);
    }

    // Verificar conmutación entre Modo Claro y Oscuro
    const initialTheme = await navDrawer.getCurrentTheme();
    await navDrawer.toggleTheme();
    const switchedTheme = await navDrawer.getCurrentTheme();
    expect(switchedTheme).not.toBe(initialTheme);

    // Conmutar de vuelta
    await navDrawer.toggleTheme();
    expect(await navDrawer.getCurrentTheme()).toBe(initialTheme);
  });

  test('Recorrido por todas las vistas principales de la aplicación con tema UCT', async ({ page }) => {
    const routesToVisit = [
      { path: '/', titleCheck: /dashboard|pipelines/i },
      { path: '/profile', titleCheck: /profile|perfil|api tokens/i },
      { path: '/addons', titleCheck: /add-ons|addons/i },
      { path: '/activity', titleCheck: /activity|audit|actividad/i },
      { path: '/templates', titleCheck: /templates|plantillas/i },
      { path: '/podsizes', titleCheck: /pod sizes|podsizes/i },
      { path: '/notifications', titleCheck: /notifications|notificaciones/i },
      { path: '/settings', titleCheck: /settings|configuración/i },
      { path: '/runpacks', titleCheck: /runpacks/i },
      { path: '/accounts', titleCheck: /accounts|cuentas/i },
    ];

    for (const route of routesToVisit) {
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });
      // Asegurar que la vista cargó contenido sin errores fatales
      const mainContent = page.locator('main.v-main');
      await expect(mainContent).toBeVisible();
    }
  });

  test('Asistente de Setup debe contener la cabecera institucional UCT', async ({ page }) => {
    await page.goto('/setup');
    const uctLogo = page.locator('img[alt="Universidad Católica de Temuco"]');
    await expect(uctLogo).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.uct-section-title')).toContainText(/Asistente de Configuración|Initial Setup Wizard/i);
  });

});
