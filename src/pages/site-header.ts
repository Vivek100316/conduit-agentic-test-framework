import type { Locator, Page } from '@playwright/test';

/**
 * The persistent navigation bar. A component object rather than a page object — it
 * appears on every view, and which links it shows is the app's clearest signal of
 * whether a session is established (src/components/Header.js).
 */
export class SiteHeader {
  private readonly nav: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation');
  }

  /** Only rendered for a signed-in user. */
  newPostLink(): Locator {
    return this.nav.getByRole('link', { name: 'New Post' });
  }

  /** Only rendered for a signed-in user. */
  settingsLink(): Locator {
    return this.nav.getByRole('link', { name: 'Settings' });
  }

  /** Only rendered for an anonymous visitor. */
  signInLink(): Locator {
    return this.nav.getByRole('link', { name: 'Sign in' });
  }

  profileLink(username: string): Locator {
    return this.nav.getByRole('link', { name: username });
  }
}
