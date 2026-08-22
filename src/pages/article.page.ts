import type { Locator, Page } from '@playwright/test';

/** The published-article view. */
export class ArticlePage {
  private readonly bannerTitle: Locator;
  private readonly articleBody: Locator;
  private readonly tags: Locator;

  constructor(private readonly page: Page) {
    // The title is the only h1 on this view (src/components/Article/index.js:47).
    this.bannerTitle = page.getByRole('heading', { level: 1 });
    this.articleBody = page.locator('.article-content');
    this.tags = page.locator('.tag-list .tag-default');
  }

  title(): Locator {
    return this.bannerTitle;
  }

  body(): Locator {
    return this.articleBody;
  }

  tag(name: string): Locator {
    return this.tags.filter({ hasText: name });
  }
}
