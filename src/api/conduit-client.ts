import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ZodSchema } from 'zod';

import { apiUrl } from '../config/env';
import {
  articleResponseSchema,
  commentResponseSchema,
  commentsResponseSchema,
  profileResponseSchema,
  tagsResponseSchema,
  type Article,
  type Comment,
  type Profile,
} from './schemas/article.schema';
import { authUserResponseSchema, type AuthUser } from './schemas/user.schema';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface ArticleInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
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

  // --- Articles ---------------------------------------------------------------

  /**
   * Note: the returned article's `tagList` is always empty, even when tags were sent.
   * That is the app's behaviour, not a bug in this client — read the article back to
   * see its tags. See docs/API_DEVIATIONS.md.
   */
  async createArticle(token: string, input: ArticleInput): Promise<Article> {
    const response = await this.createArticleRaw(token, input);
    return (await parse(response, articleResponseSchema, 'POST /articles')).article;
  }

  async createArticleRaw(token: string, input: ArticleInput): Promise<APIResponse> {
    return this.request.post(apiUrl('/articles'), {
      headers: authHeader(token),
      data: { article: input },
    });
  }

  async getArticle(slug: string, token?: string): Promise<Article> {
    const response = await this.getArticleRaw(slug, token);
    return (await parse(response, articleResponseSchema, `GET /articles/${slug}`)).article;
  }

  async getArticleRaw(slug: string, token?: string): Promise<APIResponse> {
    return this.request.get(apiUrl(`/articles/${slug}`), {
      headers: token === undefined ? {} : authHeader(token),
    });
  }

  async updateArticle(
    token: string,
    slug: string,
    patch: Partial<ArticleInput>
  ): Promise<Article> {
    const response = await this.updateArticleRaw(token, slug, patch);
    return (await parse(response, articleResponseSchema, `PUT /articles/${slug}`)).article;
  }

  async updateArticleRaw(
    token: string,
    slug: string,
    patch: Partial<ArticleInput>
  ): Promise<APIResponse> {
    return this.request.put(apiUrl(`/articles/${slug}`), {
      headers: authHeader(token),
      data: { article: patch },
    });
  }

  /** Returns 204 with an empty body on success, so there is no typed variant. */
  async deleteArticleRaw(token: string, slug: string): Promise<APIResponse> {
    return this.request.delete(apiUrl(`/articles/${slug}`), { headers: authHeader(token) });
  }

  async favoriteArticle(token: string, slug: string): Promise<Article> {
    const response = await this.request.post(apiUrl(`/articles/${slug}/favorite`), {
      headers: authHeader(token),
    });
    return (await parse(response, articleResponseSchema, `POST /articles/${slug}/favorite`))
      .article;
  }

  async unfavoriteArticle(token: string, slug: string): Promise<Article> {
    const response = await this.request.delete(apiUrl(`/articles/${slug}/favorite`), {
      headers: authHeader(token),
    });
    return (await parse(response, articleResponseSchema, `DELETE /articles/${slug}/favorite`))
      .article;
  }

  // --- Comments ---------------------------------------------------------------

  async addComment(token: string, slug: string, body: string): Promise<Comment> {
    const response = await this.request.post(apiUrl(`/articles/${slug}/comments`), {
      headers: authHeader(token),
      data: { comment: { body } },
    });
    return (await parse(response, commentResponseSchema, `POST /articles/${slug}/comments`))
      .comment;
  }

  async listComments(slug: string, token?: string): Promise<Comment[]> {
    const response = await this.request.get(apiUrl(`/articles/${slug}/comments`), {
      headers: token === undefined ? {} : authHeader(token),
    });
    return (await parse(response, commentsResponseSchema, `GET /articles/${slug}/comments`))
      .comments;
  }

  async deleteCommentRaw(token: string, slug: string, commentId: number): Promise<APIResponse> {
    return this.request.delete(apiUrl(`/articles/${slug}/comments/${commentId}`), {
      headers: authHeader(token),
    });
  }

  // --- Profiles and tags ------------------------------------------------------

  async getProfile(username: string, token?: string): Promise<Profile> {
    const response = await this.request.get(apiUrl(`/profiles/${username}`), {
      headers: token === undefined ? {} : authHeader(token),
    });
    return (await parse(response, profileResponseSchema, `GET /profiles/${username}`)).profile;
  }

  async followUser(token: string, username: string): Promise<Profile> {
    const response = await this.request.post(apiUrl(`/profiles/${username}/follow`), {
      headers: authHeader(token),
    });
    return (await parse(response, profileResponseSchema, `POST /profiles/${username}/follow`))
      .profile;
  }

  async unfollowUser(token: string, username: string): Promise<Profile> {
    const response = await this.request.delete(apiUrl(`/profiles/${username}/follow`), {
      headers: authHeader(token),
    });
    return (await parse(response, profileResponseSchema, `DELETE /profiles/${username}/follow`))
      .profile;
  }

  async listTags(): Promise<string[]> {
    const response = await this.request.get(apiUrl('/tags'));
    return (await parse(response, tagsResponseSchema, 'GET /tags')).tags;
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
