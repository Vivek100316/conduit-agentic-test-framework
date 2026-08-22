import { z } from 'zod';

/**
 * Environment is validated once, at import time, so a misconfigured run fails with a
 * readable message instead of a stack of undefined-URL errors deep inside a test.
 */
const envSchema = z.object({
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  UI_BASE_URL: z.string().url().default('http://localhost:4101'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration:\n${problems}\n\n` +
      `Set these in .env or your shell. See docs/APP_SETUP.md.`
  );
}

/** Path the Conduit backend mounts its API under. Hardcoded in the app's config/index.js. */
export const API_PATH = '/api';

export const env = parsed.data;

/** Absolute URL for an API route, e.g. apiUrl('/users') -> http://localhost:3000/api/users */
export function apiUrl(route: string): string {
  return `${env.API_BASE_URL}${API_PATH}${route}`;
}
