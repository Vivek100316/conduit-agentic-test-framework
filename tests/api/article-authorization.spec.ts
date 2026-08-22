import { buildArticle } from '../../src/factories/article.factory';
import { test, expect } from '../../src/fixtures/test';

/**
 * Authorization scenarios are P0 regardless of how routine they look. A permission hole
 * is a trust failure rather than a bug, and these are the assertions most likely to be
 * quietly weakened by someone trying to make a red suite green.
 */
test.describe('Article authorization', () => {
  test('rejects an update from a user who is not the author [AUTHZ-P0-01]', async ({
    api,
    otherUser,
    authoredArticle,
  }) => {
    const response = await api.updateArticleRaw(otherUser.token, authoredArticle.slug, {
      title: 'Hijacked',
    });

    expect(response.status()).toBe(403);

    // The article is genuinely untouched, not merely reported as forbidden.
    const unchanged = await api.getArticle(authoredArticle.slug);
    expect(unchanged.title).toBe(authoredArticle.title);
  });

  test('rejects a delete from a user who is not the author [AUTHZ-P0-02]', async ({
    api,
    otherUser,
    authoredArticle,
  }) => {
    const response = await api.deleteArticleRaw(otherUser.token, authoredArticle.slug);

    expect(response.status()).toBe(403);

    const stillThere = await api.getArticleRaw(authoredArticle.slug);
    expect(stillThere.status()).toBe(200);
  });

  test('rejects article creation without a token [AUTHZ-P0-03]', async ({ api }) => {
    const response = await api.createArticleRaw('', buildArticle());

    expect(response.status()).toBe(401);
  });

  test('rejects a request bearing a malformed token [AUTHZ-P0-04]', async ({ api }) => {
    const response = await api.createArticleRaw('not-a-real-jwt', buildArticle());

    expect(response.status()).toBe(401);
  });
});
