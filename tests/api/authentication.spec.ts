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
     * Documented deviation. The RealWorld spec — and realworld/api/swagger.json in the
     * app repo — says this is `422` with a JSON error body. This fork returns `404` with
     * `text/html`, because routes/api/users.js catches the save error and calls `next()`
     * with no argument, so the request falls through to the generic 404 handler.
     *
     * We assert the behaviour that exists. See docs/API_DEVIATIONS.md.
     */
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
  });
});
