import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ZodSchema } from 'zod';

import { apiUrl } from '../config/env';
import { authUserResponseSchema, type AuthUser } from './schemas/user.schema';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

/**
 * The only place in this repository that speaks HTTP to the app under test.
 *
 * Every method returns a value validated against a schema, so a server response that
 * has drifted fails here — at the call site, naming the endpoint — rather than three
 * assertions later with an unhelpful `undefined is not a string`.
 *
 * Negative tests that need to observe a non-JSON or error response use the `*Raw`
 * variants, which return the untouched APIResponse. This is deliberate: the app has
 * error paths that return `text/html`, and forcing those through a schema would be
 * dishonest about what the server does.
 */
export class ConduitClient {
  constructor(private readonly request: APIRequestContext) {}

  async register(input: RegisterInput): Promise<AuthUser> {
    const response = await this.registerRaw(input);
    return (await parse(response, authUserResponseSchema, 'POST /users')).user;
  }

  async registerRaw(input: RegisterInput): Promise<APIResponse> {
    return this.request.post(apiUrl('/users'), { data: { user: input } });
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await this.loginRaw(email, password);
    return (await parse(response, authUserResponseSchema, 'POST /users/login')).user;
  }

  async loginRaw(email: string, password: string): Promise<APIResponse> {
    return this.request.post(apiUrl('/users/login'), { data: { user: { email, password } } });
  }

  async currentUser(token: string): Promise<AuthUser> {
    const response = await this.currentUserRaw(token);
    return (await parse(response, authUserResponseSchema, 'GET /user')).user;
  }

  async currentUserRaw(token: string): Promise<APIResponse> {
    return this.request.get(apiUrl('/user'), { headers: authHeader(token) });
  }
}

/**
 * The app accepts both `Token <jwt>` and `Bearer <jwt>` (routes/auth.js). We send
 * `Token` because that is what the RealWorld spec defines and what the app's own
 * frontend sends; the fact that `Bearer` also works is exactly why this belongs in one
 * place rather than being guessed per call site.
 */
export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Token ${token}` };
}

async function parse<T>(response: APIResponse, schema: ZodSchema<T>, route: string): Promise<T> {
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `${route} expected a successful response but got ${response.status()} ` +
        `${response.statusText()}.\nBody: ${body.slice(0, 500)}`
    );
  }

  const raw: unknown = await response.json();
  const result = schema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `${route} returned a body that does not match its schema.\n${problems}\n\n` +
        `Either the app changed or the schema is wrong. Check the response against ` +
        `src/api/schemas/ before loosening anything.\n` +
        `Received: ${JSON.stringify(raw).slice(0, 500)}`
    );
  }

  return result.data;
}
