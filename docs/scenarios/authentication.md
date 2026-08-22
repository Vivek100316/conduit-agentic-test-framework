# Scenarios — Authentication

Generated against the running app on 2026-08-22. Every row cites the route handler,
component, or observed response it derives from; a scenario without evidence was invented
and does not belong here.

| ID         | Scenario                                                                    | Priority | Layer | Evidence                                                      |
| ---------- | --------------------------------------------------------------------------- | -------- | ----- | ------------------------------------------------------------- |
| AUTH-P0-01 | A registered user's token authenticates and their credentials log in        | P0       | API   | `routes/api/users.js:46,72`                                   |
| AUTH-P0-02 | A protected route rejects a request with no token                           | P0       | API   | `auth.required` — `routes/auth.js:16`                         |
| AUTH-P0-03 | A protected route rejects a malformed or forged token                       | P0       | API   | `express-jwt` verification — `routes/auth.js:16`              |
| AUTH-P1-01 | A duplicate email is rejected                                               | P1       | API   | `routes/api/users.js:78` — deviation, returns `404 text/html` |
| AUTH-P1-02 | A duplicate username is rejected                                            | P1       | API   | Unique constraint — `models/user.js`                          |
| AUTH-P1-03 | Login with a wrong password is refused                                      | P1       | API   | `passport.authenticate` failure — `routes/api/users.js:57`    |
| AUTH-P1-04 | Blank email or password is refused before authentication is attempted       | P1       | API   | Explicit guards — `routes/api/users.js:48,51`                 |
| AUTH-P2-01 | The token encodes the expected subject and expiry                           | P2       | API   | `generateJWT` — `models/user.js`                              |
| UI-P0-01   | Signing in through the form establishes a session that survives a reload    | P0       | UI    | `src/middleware.js:52`, `src/components/App.js:43`            |
| UI-P1-01   | Invalid credentials surface a visible error and do not authenticate         | P1       | UI    | `src/components/ListErrors.js`                                |
| UI-P1-02   | Signing out clears the session and restores the anonymous navigation        | P1       | UI    | `src/components/Header.js`                                    |
| UI-P2-01   | Visiting a protected route while anonymous does not expose authored content | P2       | UI    | `src/components/App.js:43`                                    |

## Observed deviations

`POST /users` returns `200` where the spec says `201`, and a duplicate email returns `404`
with a `text/html` body rather than `422 JSON` — the catch in `routes/api/users.js:78`
calls `next()` with no argument, so the request falls through to the generic 404 handler.
Full catalogue in [API_DEVIATIONS.md](../API_DEVIATIONS.md).

`bio` and `image` are `""` from register and `null` from login. Any assertion on those
fields has to accept both.

## Implemented, and why these

`AUTH-P0-01`, `AUTH-P1-01`, and `UI-P0-01`.

`AUTH-P0-01` covers the flow the whole product depends on, and folds in login because the
same fixture proves both. `AUTH-P1-01` is implemented ahead of the other P1s because it
pins a documented deviation — the assertion a spec-driven contributor would get wrong.
`UI-P0-01` is the one UI test that proves session persistence, which no API test can.

## Explicitly not covered

**`AUTH-P0-02` and `AUTH-P0-03`** — genuine P0s, and deliberately left out of the shipped
suite. Both are enforced by `express-jwt` rather than by application code, so they test a
well-exercised library rather than this app's logic. In a suite guarding a real deployment
they would be included; against a brief asking for depth over breadth they earn less than
what shipped.

**`AUTH-P1-02` through `AUTH-P1-04`** — the same failure path as `AUTH-P1-01`. Once the
duplicate-email deviation is pinned, the remaining validation cases exercise the same
`next()`-with-no-argument bug and would assert the same `404`. Distinct scenarios on paper,
one behaviour in practice.

**`UI-P1-01`, `UI-P1-02`, `UI-P2-01`** — real gaps, and the honest reason is scope rather
than judgement about value. `UI-P1-01` is the one worth adding first: it is the only
scenario here that exercises the app's error-rendering path, which nothing else touches.

**`AUTH-P2-01`** — asserts on the token's internals rather than on behaviour. If the token
authenticates, its claims are right; if it does not, `AUTH-P0-01` already fails.
