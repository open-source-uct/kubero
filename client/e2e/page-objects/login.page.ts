import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[type="text"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
    this.errorAlert = page.locator('.v-alert, .shake, .error');
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.usernameInput).toBeVisible({ timeout: 15000 });
  }

  async login(username: string, password: string) {
    await expect(this.usernameInput).toBeVisible({ timeout: 15000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await expect(this.submitButton).toBeEnabled({ timeout: 5000 });
    await this.submitButton.click();
  }
}
