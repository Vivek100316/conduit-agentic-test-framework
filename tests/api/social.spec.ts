import { test, expect } from '../../src/fixtures/test';

test.describe('Favourites', () => {
  test('favouriting and unfavouriting is reflected for the acting user [SOC-P1-01]', async ({
    api,
    otherUser,
    authoredArticle,
  }) => {
    const favourited = await api.favoriteArticle(otherUser.token, authoredArticle.slug);
    expect(favourited.favorited).toBe(true);
    expect(favourited.favoritesCount).toBe(1);

    const unfavourited = await api.unfavoriteArticle(otherUser.token, authoredArticle.slug);
    expect(unfavourited.favorited).toBe(false);
    expect(unfavourited.favoritesCount).toBe(0);
  });

  test('favourited state is per-user, not global [SOC-P1-02]', async ({
    api,
    registeredUser,
    otherUser,
    authoredArticle,
  }) => {
    await api.favoriteArticle(otherUser.token, authoredArticle.slug);

    // The author never favourited it, so it must not read as favourited for them —
    // while the count, which is shared, does rise.
    const asAuthor = await api.getArticle(authoredArticle.slug, registeredUser.token);
    expect(asAuthor.favorited).toBe(false);
    expect(asAuthor.favoritesCount).toBe(1);

    const asOther = await api.getArticle(authoredArticle.slug, otherUser.token);
    expect(asOther.favorited).toBe(true);
  });
});

test.describe('Comments', () => {
  test('adds a comment and lists it against the article [SOC-P1-03]', async ({
    api,
    otherUser,
    authoredArticle,
  }) => {
    const created = await api.addComment(otherUser.token, authoredArticle.slug, 'Nice article');

    expect(created.body).toBe('Nice article');
    expect(created.author.username).toBe(otherUser.username);

    const comments = await api.listComments(authoredArticle.slug);

    /**
     * Asserted relatively. Comments are scoped to this test's own article so a count
     * would be safe here, but matching by id keeps the assertion honest if the fixture
     * ever seeds more than one.
     */
    expect(comments.map((comment) => comment.id)).toContain(created.id);
  });

  test('deletes a comment [SOC-P1-04]', async ({ api, otherUser, authoredArticle }) => {
    const created = await api.addComment(otherUser.token, authoredArticle.slug, 'To be removed');

    const response = await api.deleteCommentRaw(
      otherUser.token,
      authoredArticle.slug,
      created.id
    );
    expect(response.status()).toBe(204);

    const remaining = await api.listComments(authoredArticle.slug);
    expect(remaining.map((comment) => comment.id)).not.toContain(created.id);
  });
});

test.describe('Follows', () => {
  test('following a user is reflected on their profile [SOC-P1-05]', async ({
    api,
    registeredUser,
    otherUser,
  }) => {
    const followed = await api.followUser(otherUser.token, registeredUser.username);
    expect(followed.following).toBe(true);
    expect(followed.username).toBe(registeredUser.username);

    // Anonymous readers never see a following relationship.
    const anonymous = await api.getProfile(registeredUser.username);
    expect(anonymous.following).toBe(false);

    const unfollowed = await api.unfollowUser(otherUser.token, registeredUser.username);
    expect(unfollowed.following).toBe(false);
  });
});
