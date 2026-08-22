import { z } from 'zod';

/**
 * Verified against the running app. Where these disagree with the RealWorld spec, the
 * app wins and the difference is catalogued in docs/API_DEVIATIONS.md.
 */

/**
 * Author as embedded in an article or comment. Note `image` is never null here — unlike
 * the user payload from /users, `toProfileJSONFor` substitutes a default avatar URL
 * (models/user.js:96). Same conceptual field, different nullability by endpoint.
 */
export const profileSchema = z.object({
  username: z.string(),
  bio: z.string().nullable(),
  image: z.string(),
  following: z.boolean(),
});

export const articleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tagList: z.array(z.string()),
  favorited: z.boolean(),
  favoritesCount: z.number(),
  author: profileSchema,
});

export const commentSchema = z.object({
  id: z.number(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: profileSchema,
});

export const articleResponseSchema = z.object({ article: articleSchema });
export const commentResponseSchema = z.object({ comment: commentSchema });
export const commentsResponseSchema = z.object({ comments: z.array(commentSchema) });
export const profileResponseSchema = z.object({ profile: profileSchema });
export const tagsResponseSchema = z.object({ tags: z.array(z.string()) });

export type Profile = z.infer<typeof profileSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Comment = z.infer<typeof commentSchema>;
