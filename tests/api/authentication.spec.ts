import { buildUser } from '../../src/factories/user.factory';
import { test, expect } from '../../src/fixtures/test';

test.describe('Authentication', () => {
  test('registers a user whose credentials and token both work [AUTH-P0-01]', async ({ api }) => {
    const input = buildUser();

    const registered = await api.register(input);
    expect(registered.username).toBe(input.username);
    expect(registered.email).toBe(input.email);

    // A token is only meaningful if it authenticates, so prove that rather than
    // asserting on its shape.
    const me = await api.currentUser(registered.token);
    expect(me.email).toBe(input.email);

    // And the credentials work independently of the registration response.
    const session = await api.login(input.email, input.password);
    expect(session.username).toBe(input.username);
  });

  test('rejects a duplicate email [AUTH-P1-01]', async ({ api }) => {
    const input = buildUser();
    await api.register(input);

    const response = await api.registerRaw({ ...input, username: `${input.username}_2` });

    /**
     * DEFECT — deviation classified per docs/DEVIATIONS.md § Policy.
     *
     * The spec (realworld/api/swagger.json) requires `422` with a JSON error body. The
     * app returns `404` with `text/html`, because routes/api/users.js catches the save
     * error and calls `next()` with **no argument** — so Express does not treat it as an
     * error and the request falls through to the generic 404 handler.
     *
     * Classified a defect rather than an intentional difference: no one would design a
     * validation failure to report "not found", and the cause is a visible mistake rather
     * than a choice.
     *
     * Asserted as-is so the suite describes reality. This pins **current** behaviour: if
     * the app is fixed to return 422, this test fails loudly and points straight here,
     * which is the intended signal — not a regression.
     */
    expect(
      response.status(),
      'duplicate email returned the known DEFECT status. If this is now 422, the app was ' +
        'fixed — update this assertion and docs/DEVIATIONS.md rather than treating it as ' +
        'a regression.'
    ).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
  });
});
