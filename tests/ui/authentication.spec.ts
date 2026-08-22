import { LoginPage } from '../../src/pages/login.page';
import { SiteHeader } from '../../src/pages/site-header';
import { test, expect } from '../../src/fixtures/test';

test.describe('Signing in', () => {
  test('signs in through the form and keeps the session across a reload [UI-P0-01]', async ({
    page,
    registeredUser,
  }) => {
    const loginPage = new LoginPage(page);
    const header = new SiteHeader(page);

    await loginPage.goto();
    await loginPage.signIn(registeredUser.email, registeredUser.password);

    // The navigation is the app's clearest signal that a session exists: these two links
    // are rendered only for a signed-in user.
    await expect(header.newPostLink()).toBeVisible();
    await expect(header.settingsLink()).toBeVisible();
    await expect(header.signInLink()).toBeHidden();

    /**
     * The session lives in `localStorage.jwt` rather than a cookie, so surviving a reload
     * is a real behaviour worth pinning — an in-memory-only session would pass every
     * assertion above and still drop the user on refresh.
     */
    await page.reload();
    await expect(header.newPostLink()).toBeVisible();
  });
});
