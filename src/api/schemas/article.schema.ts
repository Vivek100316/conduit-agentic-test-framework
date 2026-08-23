import { z } from 'zod';

/**
 * Verified against the running app. Where these disagree with the RealWorld spec, the
 * app wins and the difference is catalogued in docs/DEVIATIONS.md.
 */

/**
 * Author as embedded in an article or comment. Note `image` is never null here — unlike
 * the user payload from /users, `toProfileJSONFor` substitutes a default avatar URL
 * (models/user.js:96). Same conceptual field, different nullability by endpoint.
 */
/**
 * Every object below is `.strict()`: a field the app adds that we do not know about is a
 * failure, not a shrug.
 *
 * The trade-off is real and went the other way for a reason. The tolerant-reader habit —
 * ignore what you do not recognise — is right for a production client, which should keep
 * working when a server adds a field. This is not a production client; it is a suite whose
 * job is to notice that the contract moved. An unexpected field means someone changed the
 * API, and that is information, delivered here with the route name attached and a ten-second
 * fix (add the field, note it in DEVIATIONS.md).
 *
 * Flip condition: a fast-moving API where additive change is routine. There, strict schemas
 * produce noise, and noise teaches people to loosen schemas reflexively — the exact habit
 * the deviation policy forbids. In that world: tolerant schemas plus a scheduled drift audit.
 */
export const profileSchema = z
  .object({
    username: z.string(),
    bio: z.string().nullable(),
    image: z.string(),
    following: z.boolean(),
  })
  .strict();

export const articleSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    body: z.string(),
    // ISO 8601 with milliseconds and a Z offset — verified: 2026-08-23T12:59:53.877Z
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tagList: z.array(z.string()),
    favorited: z.boolean(),
    favoritesCount: z.number(),
    author: profileSchema,
  })
  .strict();

export const commentSchema = z
  .object({
    id: z.number(),
    body: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    author: profileSchema,
  })
  .strict();

export const articleResponseSchema = z.object({ article: articleSchema });
export const commentResponseSchema = z.object({ comment: commentSchema });
export const commentsResponseSchema = z.object({ comments: z.array(commentSchema) });
export const profileResponseSchema = z.object({ profile: profileSchema });
export const tagsResponseSchema = z.object({ tags: z.array(z.string()) });

export type Profile = z.infer<typeof profileSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Comment = z.infer<typeof commentSchema>;
