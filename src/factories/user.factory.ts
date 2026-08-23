import type { RegisterInput } from '../api/conduit-client';
import { unique } from './unique';

/**
 * Every test builds its own user. There is no shared fixture account, no database reset,
 * and no teardown — isolation comes from uniqueness, which is parallel-safe and cannot
 * fail halfway and leave the next test in a worse state.
 *
 * Nothing here is random beyond the uniqueness token. A test that needs to assert on a
 * value passes it in as an override, so no assertion ever depends on generated content.
 * See docs/ENGINEERING_STANDARDS.md.
 */
export function buildUser(overrides: Partial<RegisterInput> = {}): RegisterInput {
  const id = unique();

  return {
    username: `qa_${id}`,
    email: `qa_${id}@example.test`,
    password: 'Passw0rd!QA',
    ...overrides,
  };
}
