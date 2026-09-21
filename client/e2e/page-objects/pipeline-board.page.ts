import { Page, Locator, expect } from '@playwright/test';

export class PipelineBoardPage {
  readonly page: Page;
  readonly welcomeCard: Locator;
  readonly newPipelineBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeCard = page.locator('h1, .v-card, .v-sheet, main').filter({
      hasText: /welcome to kubero|your pipelines/i,
    }).first();
    this.newPipelineBtn = page.getByRole('button', {
      name: /new|create your first pipeline/i,
    });
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.page.locator('.v-application')).toBeVisible();
    await expect(this.page.locator('.v-navigation-drawer')).toBeVisible();
  }
}
