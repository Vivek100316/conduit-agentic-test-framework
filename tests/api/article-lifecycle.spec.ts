import { buildArticle } from '../../src/factories/article.factory';
import { test, expect } from '../../src/fixtures/test';

test.describe('Article lifecycle', () => {
  test('creates an article and reads it back [ART-P0-01]', async ({ api, registeredUser }) => {
    const input = buildArticle();

    const created = await api.createArticle(registeredUser.token, input);

    expect(created.title).toBe(input.title);
    expect(created.description).toBe(input.description);
    expect(created.body).toBe(input.body);
    expect(created.author.username).toBe(registeredUser.username);
    expect(created.slug).toContain('qa-article-');

    const fetched = await api.getArticle(created.slug);
    expect(fetched.title).toBe(input.title);
    expect(fetched.author.username).toBe(registeredUser.username);
  });

  test('updates an article in place [ART-P0-02]', async ({
    api,
    registeredUser,
    authoredArticle,
  }) => {
    const updated = await api.updateArticle(registeredUser.token, authoredArticle.slug, {
      title: `${authoredArticle.title} (edited)`,
      body: 'rewritten body',
    });

    expect(updated.title).toBe(`${authoredArticle.title} (edited)`);
    expect(updated.body).toBe('rewritten body');
    // Untouched fields survive a partial update.
    expect(updated.description).toBe(authoredArticle.description);
  });

  test('deletes an article and it becomes unreachable [ART-P0-03]', async ({
    api,
    registeredUser,
    authoredArticle,
  }) => {
    const deleteResponse = await api.deleteArticleRaw(registeredUser.token, authoredArticle.slug);
    expect(deleteResponse.status()).toBe(204);

    const afterDelete = await api.getArticleRaw(authoredArticle.slug);
    expect(afterDelete.status()).toBe(404);
  });

  test('omits tags from the create response but persists them [ART-P1-01]', async ({
    api,
    registeredUser,
  }) => {
    const input = buildArticle();

    const created = await api.createArticle(registeredUser.token, input);

    /**
     * Documented deviation. `setArticleTags` in routes/api/articles.js:5 does not return
     * its inner `Tag.findAll(...).then(...)` chain, so `Promise.all` resolves and the
     * article is serialised before the tag association is written. The create response
     * therefore never echoes tags — deterministically, verified over repeated runs — but
     * a subsequent read shows them.
     *
     * The naive assertion here is `expect(created.tagList).toEqual(input.tagList)`, which
     * is what the spec implies and what this app never does. See docs/API_DEVIATIONS.md.
     */
    expect(created.tagList).toEqual([]);

    const fetched = await api.getArticle(created.slug);
    expect(fetched.tagList).toEqual(input.tagList);
  });

  test('keeps the original slug after the title changes [ART-P1-02]', async ({
    api,
    registeredUser,
    authoredArticle,
  }) => {
    const updated = await api.updateArticle(registeredUser.token, authoredArticle.slug, {
      title: 'A Completely Different Title',
    });

    /**
     * Documented deviation. RealWorld implementations normally regenerate the slug from
     * the title; this app does not — `routes/api/articles.js:169` assigns the new title
     * without touching `slug`. Existing links keep working, which is arguably better
     * behaviour, but it is not what the spec describes.
     */
    expect(updated.slug).toBe(authoredArticle.slug);
    expect(updated.title).toBe('A Completely Different Title');
  });
});
