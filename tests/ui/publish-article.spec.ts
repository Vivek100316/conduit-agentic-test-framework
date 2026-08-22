import { buildArticle } from '../../src/factories/article.factory';
import { ArticlePage } from '../../src/pages/article.page';
import { EditorPage } from '../../src/pages/editor.page';
import { test, expect } from '../../src/fixtures/test';

test.describe('Publishing an article', () => {
  test('publishes from the editor and renders it for readers [UI-P0-02]', async ({
    authenticatedPage,
  }) => {
    const editor = new EditorPage(authenticatedPage);
    const articlePage = new ArticlePage(authenticatedPage);

    // A fixed body keeps the assertion readable; the title and tag stay unique so this
    // test cannot collide with anything running in parallel.
    const input = buildArticle({ body: 'Published through the editor.' });

    await editor.goto();
    await editor.publish(input);

    // Publishing redirects to the article view. The web-first assertions below wait for
    // that navigation on their own — there is nothing to sleep on.
    await expect(articlePage.title()).toHaveText(input.title);
    await expect(articlePage.body()).toContainText('Published through the editor.');

    const [tag] = input.tagList;
    await expect(articlePage.tag(String(tag))).toBeVisible();
  });
});
