import { test as base } from '@playwright/test';

import { ConduitClient } from '../api/conduit-client';
import type { AuthUser } from '../api/schemas/user.schema';
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
    const input = buildUser();
    const user = await api.register(input);
    await use({ ...user, password: input.password });
  },
});

export { expect } from '@playwright/test';
