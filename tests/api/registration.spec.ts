import { test, expect } from '../../src/fixtures/test';
import { buildUser } from '../../src/factories/user.factory';

test.describe('User registration', () => {
  test('registers a new user and returns a usable token [AUTH-P0-01]', async ({ api }) => {
    const input = buildUser();

    const created = await api.register(input);

    expect(created.username).toBe(input.username);
    expect(created.email).toBe(input.email);

    // The token is only meaningful if it authenticates, so prove that rather than
    // asserting on its shape.
    const me = await api.currentUser(created.token);
    expect(me.email).toBe(input.email);
  });

  test('rejects a duplicate email [AUTH-P1-01]', async ({ api }) => {
    const input = buildUser();
    await api.register(input);

    const response = await api.registerRaw({ ...input, username: `${input.username}_2` });

    /**
     * Documented deviation (D-002). The RealWorld spec — and realworld/api/swagger.json
     * in the app repo — says a validation failure here is `422` with a JSON error body.
     * This fork returns `404` with `text/html`, because routes/api/users.js catches the
     * save error and calls `next()` with no argument, so the request falls through to
     * the generic 404 handler in app.js.
     *
     * We assert the behaviour that exists. Changing this assertion to 422 without
     * changing the app would be asserting a fiction.
     */
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('authenticates a registered user [AUTH-P0-02]', async ({ api, registeredUser }) => {
    const session = await api.login(registeredUser.email, registeredUser.password);

    expect(session.username).toBe(registeredUser.username);
    expect(session.token).not.toHaveLength(0);
  });
});
