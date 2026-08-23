import { z } from 'zod';

/**
 * Shapes below describe what the app ACTUALLY returns, verified against the running
 * backend. They deliberately do not match realworld/api/swagger.json, which documents
 * the canonical RealWorld API rather than this fork. See DECISIONS.md (D-002).
 */

/**
 * `bio` and `image` are `string | null`, and which one you get depends on the code path:
 * POST /users returns `""` because `toAuthJSON` maps `undefined -> ""` on a freshly
 * constructed model, while POST /users/login returns `null` because a record loaded
 * from SQLite has an actual null column. Same field, same endpoint family, two types.
 * See models/user.js:82 in the app under test.
 */
/**
 * `.strict()` — an unrecognised field fails rather than being silently dropped. Rationale
 * and flip condition are in article.schema.ts, where the same choice is made.
 */
export const authUserSchema = z
  .object({
    username: z.string(),
    email: z.string(),
    token: z.string().min(1),
    bio: z.string().nullable(),
    image: z.string().nullable(),
  })
  .strict();

export const authUserResponseSchema = z
  .object({
    user: authUserSchema,
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
