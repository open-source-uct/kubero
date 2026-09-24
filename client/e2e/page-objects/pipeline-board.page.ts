import { Page, Locator, expect } from '@playwright/test';

export class PipelineBoardPage {
  readonly page: Page;
  readonly newPipelineBtn: Locator;
  readonly boardContent: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPipelineBtn = page.locator('a, button').filter({
      hasText: /new|create your first pipeline/i,
    }).first();
    this.boardContent = page.locator('.row, h1, .v-alert').first();
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 15000 });
  }

  async expectLoaded() {
    await expect(this.page.locator('.v-application')).toBeVisible();
    await expect(this.page.locator('.v-navigation-drawer')).toBeVisible();
  }
}
