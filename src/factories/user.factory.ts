import { faker } from '@faker-js/faker';

import type { RegisterInput } from '../api/conduit-client';

/**
 * Every test builds its own user. There is no shared fixture account, no database
 * reset, and no teardown — isolation comes from uniqueness, which is parallel-safe and
 * cannot fail halfway through and leave the next test in a worse state.
 *
 * Usernames and emails carry a timestamp plus a random suffix because Conduit enforces
 * uniqueness on both, and Playwright workers run concurrently.
 */
export function buildUser(overrides: Partial<RegisterInput> = {}): RegisterInput {
  const unique = `${Date.now()}${faker.string.alphanumeric(6).toLowerCase()}`;

  return {
    username: `qa_${unique}`,
    email: `qa_${unique}@example.test`,
    password: faker.internet.password({ length: 12 }),
    ...overrides,
  };
}
