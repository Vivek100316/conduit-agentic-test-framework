import type { Locator, Page } from '@playwright/test';

import type { ArticleInput } from '../api/conduit-client';

/**
 * The article editor. Placeholders are the anchors for the same reason as on the login
 * page — the app provides no labels or test ids.
 */
export class EditorPage {
  private readonly titleField: Locator;
  private readonly descriptionField: Locator;
  private readonly bodyField: Locator;
  private readonly tagsField: Locator;
  private readonly publishButton: Locator;

  constructor(private readonly page: Page) {
    this.titleField = page.getByPlaceholder('Article Title');
    this.descriptionField = page.getByPlaceholder("What's this article about?");
    this.bodyField = page.getByPlaceholder('Write your article (in markdown)');
    this.tagsField = page.getByPlaceholder('Enter tags');
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/editor');
  }

  /**
   * Fills the form and publishes. Tags are committed with Enter — the app listens on
   * `onKeyUp` for the Enter key rather than reading the field on submit
   * (src/components/Editor.js:140), so a tag left sitting in the input is silently
   * discarded.
   */
  async publish(article: ArticleInput): Promise<void> {
    await this.titleField.fill(article.title);
    await this.descriptionField.fill(article.description);
    await this.bodyField.fill(article.body);

    for (const tag of article.tagList) {
      await this.tagsField.fill(tag);
      await this.tagsField.press('Enter');
    }

    await this.publishButton.click();
  }
}
