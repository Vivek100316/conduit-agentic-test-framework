import { buildArticle } from '../../src/factories/article.factory';
import { test, expect } from '../../src/fixtures/test';

test.describe('Articles', () => {
  test('publishes an article and reads it back [ART-P0-01]', async ({ api, registeredUser }) => {
    const input = buildArticle();

    const created = await api.createArticle(registeredUser.token, input);
    expect(created.title).toBe(input.title);
    expect(created.body).toBe(input.body);
    expect(created.author.username).toBe(registeredUser.username);

    /**
     * DEFECT — deviation classified per docs/DEVIATIONS.md § Policy. This is why the
     * assertion below looks wrong at first glance.
     *
     * `setArticleTags` (routes/api/articles.js:5) does not return its inner
     * `Tag.findAll(...).then(...)` chain, so `Promise.all` resolves and the article is
     * serialised before the tag association is written. The create response therefore
     * never echoes tags — deterministically, verified over five repeated runs — while an
     * immediate read shows them.
     *
     * Classified a defect rather than an intentional difference: it is an unreturned
     * promise, which is a mistake in every reading, and it makes the create response an
     * unreliable description of what was just created.
     *
     * The natural assertion is `expect(created.tagList).toEqual(input.tagList)` — what the
     * spec implies and what this app never does. Asserting `[]` pins current behaviour;
     * when the promise chain is fixed this test fails and names the change.
     */
    expect(
      created.tagList,
      'create response omitted tags (known DEFECT). If this now RETURNS tags, the app was ' +
        'fixed — update this assertion and the row in docs/DEVIATIONS.md rather than ' +
        'treating it as a regression.'
    ).toEqual([]);

    const fetched = await api.getArticle(created.slug);
    expect(fetched.title).toBe(input.title);
    expect(fetched.tagList).toEqual(input.tagList);
  });

  test('prevents a non-author from modifying an article [AUTHZ-P0-01]', async ({
    api,
    otherUser,
    authoredArticle,
  }) => {
    const response = await api.updateArticleRaw(otherUser.token, authoredArticle.slug, {
      title: 'Hijacked',
    });

    expect(response.status()).toBe(403);

    /**
     * A status code proves the request was refused. It does not prove the write failed
     * to land, so read the article back and confirm it is genuinely untouched.
     */
    const unchanged = await api.getArticle(authoredArticle.slug);
    expect(unchanged.title).toBe(authoredArticle.title);
  });
});
