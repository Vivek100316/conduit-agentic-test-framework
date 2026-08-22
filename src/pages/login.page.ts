import type { Locator, Page } from '@playwright/test';

/**
 * The app has no `data-testid` attributes and its inputs have no `id`, `name`, or
 * `<label>` — `getByLabel` matches nothing anywhere in this app (verified: 0 hits).
 * The placeholder is the only distinguishing attribute, so it is the anchor.
 *
 * `getByRole('textbox', { name: 'Password' })` does also work, because Chromium exposes
 * password inputs as textboxes and derives the accessible name from the placeholder.
 * We prefer `getByPlaceholder` anyway: it is explicit about what the selector is really
 * coupled to, and it does not depend on role mapping that the HTML-AAM spec says should
 * not exist. See AI_USAGE.md §7.
 */
export class LoginPage {
  private readonly emailField: Locator;
  private readonly passwordField: Locator;
  private readonly submitButton: Locator;
  private readonly errorList: Locator;

  constructor(private readonly page: Page) {
    this.emailField = page.getByPlaceholder('Email');
    this.passwordField = page.getByPlaceholder('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    // `.error-messages` is the app's own container (src/components/ListErrors.js).
    this.errorList = page.locator('.error-messages li');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.submitButton.click();
  }

  /** Validation messages rendered by the app, e.g. "email or password is invalid". */
  errors(): Locator {
    return this.errorList;
  }
}
