import { Page, Locator, expect } from '@playwright/test';

export class NavDrawerPage {
  readonly page: Page;
  readonly drawer: Locator;
  readonly themeToggleBtn: Locator;
  readonly versionItemBtn: Locator;
  readonly versionDialog: Locator;
  readonly versionDialogCloseBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator('.v-navigation-drawer');
    this.themeToggleBtn = this.drawer.locator('.v-list-item').filter({
      has: page.locator('.mdi-theme-light-dark'),
    });
    this.versionItemBtn = this.drawer.locator('.mdi-star').first();
    this.versionDialog = page.locator('.v-dialog');
    this.versionDialogCloseBtn = this.versionDialog.getByRole('button', { name: /ok|close/i });
  }

  async navigateTo(href: string) {
    const link = this.drawer.locator(`a[href="${href}"]`);
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async toggleTheme() {
    await expect(this.themeToggleBtn).toBeVisible();
    await this.themeToggleBtn.click();
    // Breve pausa para permitir la transición de tema en Vuetify
    await this.page.waitForTimeout(400);
  }

  async getCurrentTheme(): Promise<'light' | 'dark'> {
    const app = this.page.locator('.v-application').first();
    const classAttr = (await app.getAttribute('class')) || '';
    if (classAttr.includes('v-theme--dark')) return 'dark';
    return 'light';
  }

  async openVersionDialog() {
    await this.versionItemBtn.scrollIntoViewIfNeeded();
    await expect(this.versionItemBtn).toBeVisible({ timeout: 7000 });
    await this.versionItemBtn.click();
    await expect(this.versionDialog).toBeVisible({ timeout: 7000 });
  }

  async closeVersionDialog() {
    if (await this.versionDialogCloseBtn.isVisible()) {
      await this.versionDialogCloseBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(this.versionDialog).not.toBeVisible({ timeout: 5000 });
  }
}
