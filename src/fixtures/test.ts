import { test as base, type Page } from '@playwright/test';

import { ConduitClient } from '../api/conduit-client';
import type { Article } from '../api/schemas/article.schema';
import type { AuthUser } from '../api/schemas/user.schema';
import { buildArticle } from '../factories/article.factory';
import { buildUser } from '../factories/user.factory';
import { signInAs } from './session';

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
   * A page signed in as `registeredUser` — **convenience for the common case, not the
   * mechanism.** The mechanism is `signInAs(page, user)` in ./session, which establishes
   * a session for any user you hand it.
   *
   * Reach for `signInAs` directly whenever the session is not simply "some ordinary
   * user": a second account, or an admin or guest once such a thing exists. Conduit has
   * no roles today, which is exactly why the seam is worth keeping visible — a hard-wired
   * `authenticatedPage` is cheap now and expensive to unpick once every UI test depends
   * on it.
   *
   * Deliberately not Playwright's `storageState`: that saves one session to a file and
   * replays it, which means a shared user, and this framework's isolation comes from
   * every test owning unique data (D-003).
   *
   * Signing in through the form is covered once, by UI-P0-01. Every other UI test takes
   * this fast path, because re-proving login on the way to testing something else only
   * buys extra ways to fail.
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
    await use(await signInAs(page, registeredUser));
  },
});

async function registerFresh(api: ConduitClient): Promise<RegisteredUser> {
  const input = buildUser();
  const user = await api.register(input);
  return { ...user, password: input.password };
}

export { expect } from '@playwright/test';
