import { faker } from '@faker-js/faker';

/**
 * A token unique across parallel workers, repeated runs, and a shared database.
 *
 * The timestamp orders values and makes them readable when you are staring at a row in
 * SQLite wondering which run produced it; the random suffix covers workers that start
 * within the same millisecond. Conduit enforces uniqueness on username, email, and
 * (effectively) tag name, and every worker writes to the same database, so this is what
 * lets tests run in parallel without a reset step.
 */
export function unique(): string {
  return `${Date.now().toString(36)}${faker.string.alphanumeric(6).toLowerCase()}`;
}
