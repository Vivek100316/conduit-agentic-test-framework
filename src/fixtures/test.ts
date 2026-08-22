import { test as base, type Page } from '@playwright/test';

import { ConduitClient } from '../api/conduit-client';
import type { Article } from '../api/schemas/article.schema';
import type { AuthUser } from '../api/schemas/user.schema';
import { buildArticle } from '../factories/article.factory';
import { buildUser } from '../factories/user.factory';

/** A user that exists in the app, with the plaintext password so tests can log in as them. */
export interface RegisteredUser extends AuthUser {
  password: string;
}

export interface ConduitFixtures {
  /** Typed API client bound to this test's request context. */
  api: ConduitClient;
  /** A freshly registered, unique user. Created over the API — never through the UI. */
  registeredUser: RegisteredUser;
  /**
   * A second, unrelated user. Exists so authorization boundaries can be tested with a
   * genuine stranger rather than by mangling the first user's token — a forged token
   * proves the JWT middleware works, not that ownership checks do.
   */
  otherUser: RegisteredUser;
  /** An article authored by `registeredUser`, created over the API. */
  authoredArticle: Article;
  /**
   * A page that is already signed in as `registeredUser`.
   *
   * The session is injected straight into `localStorage.jwt`, which is where the app
   * keeps it (src/middleware.js:52) and what it reads on boot (src/components/App.js:43).
   *
   * Deliberately not Playwright's `storageState`: that saves one session to a file and
   * replays it across tests, which means a shared user — and this framework's isolation
   * comes from every test owning unique data. `addInitScript` gives the same "skip the
   * login form" speed while keeping one fresh user per test.
   *
   * Signing in through the form is itself covered once, by UI-P0-01. Every other UI test
   * takes this fast path, because re-proving login on the way to testing something else
   * only buys extra ways to fail.
   */
  authenticatedPage: Page;
}

/**
 * Fixtures are composed with `test.extend` rather than inherited from a base class.
 * A test declares what it needs in its destructured argument and gets exactly that;
 * nothing is set up for tests that did not ask for it.
 */
export const test = base.extend<ConduitFixtures>({
  api: async ({ request }, use) => {
    await use(new ConduitClient(request));
  },

  registeredUser: async ({ api }, use) => {
    await use(await registerFresh(api));
  },

  otherUser: async ({ api }, use) => {
    await use(await registerFresh(api));
  },

  authoredArticle: async ({ api, registeredUser }, use) => {
    await use(await api.createArticle(registeredUser.token, buildArticle()));
  },

  authenticatedPage: async ({ page, registeredUser }, use) => {
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('jwt', token);
    }, registeredUser.token);
    await use(page);
  },
});

async function registerFresh(api: ConduitClient): Promise<RegisteredUser> {
  const input = buildUser();
  const user = await api.register(input);
  return { ...user, password: input.password };
}

export { expect } from '@playwright/test';
