import type { Page } from '@playwright/test';

/** Anything carrying a JWT — the registered-user fixtures, or a user built for a role. */
export interface HasToken {
  token: string;
}

/**
 * Establishes a browser session for a **specific** user.
 *
 * Conduit keeps its JWT in `localStorage.jwt` (`src/middleware.js:52`) and reads it on
 * boot (`src/components/App.js:43`), so injecting the key before the app loads is
 * equivalent to having signed in — without paying for the form.
 *
 * This is the building block; `authenticatedPage` is only the common case wrapped up.
 * Take this directly whenever a test needs a session that is not "some ordinary user":
 *
 * ```ts
 * const admin = await api.register(buildUser());
 * await signInAs(page, admin);
 * ```
 *
 * Conduit has no roles today, so nothing in this repository needs more than one session.
 * The seam exists anyway because the alternative — a single hard-wired
 * `authenticatedPage` — is the thing that has to be unpicked the day an admin or guest
 * appears, and by then it is load-bearing in every UI test.
 *
 * **Must be called before the first navigation.** `addInitScript` runs before page
 * scripts on each navigation; calling it after `goto` leaves the already-loaded app
 * unaware of the session.
 */
export async function signInAs(page: Page, user: HasToken): Promise<Page> {
  await page.addInitScript((token: string) => {
    window.localStorage.setItem('jwt', token);
  }, user.token);
  return page;
}

/**
 * Clears any session, for tests that need a genuinely anonymous visitor. Also runs before
 * navigation, so it is the deliberate opposite of `signInAs` rather than a logout.
 */
export async function signOut(page: Page): Promise<Page> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('jwt');
  });
  return page;
}
