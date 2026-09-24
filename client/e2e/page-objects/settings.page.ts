import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoAccounts() {
    await this.page.goto('/accounts');
    await expect(this.page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });
  }

  async expectUsersList() {
    // Esperar reactivamente a que la tabla de usuarios cargue con admin y system
    const userRow = this.page.locator('tr, .v-list-item, div').filter({ hasText: 'admin' }).first();
    await expect(userRow).toBeVisible({ timeout: 10000 });
    const systemRow = this.page.locator('tr, .v-list-item, div').filter({ hasText: 'system' }).first();
    await expect(systemRow).toBeVisible({ timeout: 10000 });
  }

  async gotoPodsizes() {
    await this.page.goto('/podsizes');
    await expect(this.page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });
  }

  async expectPodsizes() {
    // Validar las definiciones de podsizes
    await expect(this.page.locator('body').filter({ hasText: 'small' }).first()).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator('body').filter({ hasText: 'medium' }).first()).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator('body').filter({ hasText: 'large' }).first()).toBeVisible({ timeout: 10000 });
  }
}
