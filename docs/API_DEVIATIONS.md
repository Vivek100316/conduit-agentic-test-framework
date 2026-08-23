# Observed API Deviations

Every row was verified by issuing the request against the running app, not read from a
specification. `realworld/api/swagger.json` in the app repository describes the canonical
RealWorld API; this fork differs from it in the ways below.

**This file is the reason `no-raw-http-outside-api-client` exists.** An agent writing a
one-off request inside a test reproduces the spec's version of events. An agent adding a
method to `ConduitClient` has to look at a real response.

If you find a new deviation: assert what the app does, add a row here with the route file
and line that causes it, and reference it from the test.

---

## Status codes

| Endpoint                                        | Spec       | Actual                                                     | Cause                                                                                                                                                             |
| ----------------------------------------------- | ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /users` (success)                         | `201`      | `200`                                                      | `res.json()` without an explicit status — `routes/api/users.js:72`                                                                                                |
| `POST /users` (duplicate email)                 | `422` JSON | `404`, `text/html`, body `error: 404 Not Found /api/users` | The catch calls `next()` with **no argument**, so the request is not an error and falls through to the generic 404 handler in `app.js` — `routes/api/users.js:78` |
| `POST /articles` (success)                      | `201`      | `200`                                                      | Same pattern — `routes/api/articles.js:132`                                                                                                                       |
| `PUT`/`DELETE /articles/:slug` (not the author) | `403` JSON | `403`, `text/plain`, body `Forbidden`                      | `res.sendStatus(403)` sends a bare status text — `routes/api/articles.js:193`                                                                                     |
| `GET /articles/:slug` (unknown slug)            | `404` JSON | `404`, `text/plain`, body `Not Found`                      | `res.sendStatus(404)` in the `router.param` preloader — `routes/api/articles.js:27`                                                                               |
| Any `auth.required` route without a token       | `401` JSON | `401`, **`text/html`** — a full HTML error page            | The dev `errorhandler` middleware renders `UnauthorizedError` as HTML — `app.js`                                                                                  |

Only the first two rows are surprising in kind; the rest are surprising in _content type_.
Any helper that assumes an error response is JSON will throw while parsing, which is why
`ConduitClient` exposes `*Raw` variants for every negative path.

---

## Payload shapes

### `bio` and `image` change type depending on how you authenticated

| Call                            | `bio`  | `image`                                                       |
| ------------------------------- | ------ | ------------------------------------------------------------- |
| `POST /users` (register)        | `""`   | `""`                                                          |
| `POST /users/login`             | `null` | `null`                                                        |
| `author` embedded in an article | `null` | `"https://static.productionready.io/images/smiley-cyrus.jpg"` |

`toAuthJSON` maps `undefined -> ""` (`models/user.js:87`), which only holds for a
model instance that was just constructed in memory. A record loaded from SQLite has a
genuine `null` column, so it passes straight through. Separately,
`toProfileJSONFor` substitutes a default avatar URL (`models/user.js:96`), so the embedded
author's `image` is never null even when the user's own payload says it is.

Schemas therefore use `z.string().nullable()` for `bio` in both places and `z.string()`
for the embedded author's `image`. TypeScript alone would not have caught this — types are
erased at runtime, so a client typed `{ bio: string }` accepts `null` silently and fails
later, somewhere else.

### `POST /articles` never returns the tags you sent

Deterministic, verified over repeated runs: the create response always carries
`tagList: []`, and an immediate read of the same article returns the tags.

```
run 1: create=[]  get=['alpha…', 'beta…']
run 2: create=[]  get=['alpha…', 'beta…']
run 3: create=[]  get=['alpha…', 'beta…']
```

`setArticleTags` (`routes/api/articles.js:5`) does not return its inner
`Tag.findAll(...).then(...)` chain, so the outer `Promise.all` resolves and the article is
serialised before the tag association is written.

The natural assertion — `expect(created.tagList).toEqual(input.tagList)` — is what the
spec implies and what this app never does. Covered by `ART-P1-01`.

---

## Behaviour

### The slug does not follow the title

RealWorld implementations normally regenerate the slug when the title changes. This one
assigns the new title and leaves `slug` alone (`routes/api/articles.js:169`), so existing
links keep working. Arguably better behaviour than the spec; still a deviation. Covered by
`ART-P1-02`.

Slugs carry a random suffix (`my-title-a1b2c3`), so two articles with identical titles do
not collide — which is what makes parallel article creation safe.

### Both `Token` and `Bearer` are accepted

`routes/auth.js` accepts either scheme. The RealWorld spec defines `Token`, and the app's
own frontend sends `Token`.

This one is dangerous precisely because it is permissive: an agent guessing `Bearer`
gets a passing test, so the wrong convention silently enters the codebase and nothing ever
signals it. `authHeader()` in `src/api/conduit-client.ts` is the single place that decides,
and it sends `Token`.

---

## Not deviations, but worth knowing

- `GET /tags` returns the **global** tag list, and the home feed is global too. Neither is
  scoped to a user, so absolute-count assertions against them are racy under parallel
  execution. Factories generate unique tag names for this reason.
- Under `NODE_ENV=test` the database is SQLite `:memory:` (`models/index.js`), so state
  does not survive a restart of the app.
- `DELETE` returns `204` with a genuinely empty body — there is no typed client variant
  because there is nothing to parse.

---

## Policy — when the app and the spec disagree

What to do when the app and its specification disagree.

### The two sources, and what each is good for

|                              | Says                               | Use it for                                                  |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `realworld/api/swagger.json` | What the app is **supposed** to do | Designing scenarios — deriving what is worth testing at all |
| The running app              | What the app **currently** does    | Writing assertions — the suite must describe reality        |

Both matter, and conflating them is where suites go wrong in one of two directions.

Assert only from the spec, and the suite is red about things nobody is going to change,
so people stop reading it. Assert only from the app, and every defect gets quietly
promoted to expected behaviour — the suite passes forever and protects nothing.

### The rule

**The specification is the source of truth about intent. The app is the source of truth
about current state. A gap between them is a finding, and a finding needs a human
decision — not an assertion written on autopilot.**

When they disagree, an agent must **stop and ask**, not choose. The right resolution
depends on facts an agent does not have: whether the spec is stale, whether the behaviour
was a deliberate product choice, whether a defect is known and accepted.

### Procedure

**1. Establish it is real.** Reproduce the request. Once is an observation; deterministic
across runs is a finding. The `tagList` deviation was confirmed over five runs before it
was written down.

**2. Find the cause in the app's source.** A deviation you cannot explain might be your
own request being wrong. Every row in `API_DEVIATIONS.md` names a file and line.

**3. Classify it.** This is the judgement an agent should surface rather than make:

| Class          | Looks like                                          | Example here                                                                               |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Defect**     | The app is wrong; no one would defend the behaviour | Duplicate registration returns `404 text/html` because `next()` is called with no argument |
| **Stale spec** | The app is right; the document was never updated    | —                                                                                          |
| **Deliberate** | The app knowingly differs, and it is defensible     | Slug does not regenerate on title change, so existing links keep working                   |

**4. Ask.** Present the evidence, the cause, the classification, and the options. Then
wait. Do not write the assertion first and mention it afterwards.

**5. Record whichever way it goes.** A row in `API_DEVIATIONS.md`, and a comment at the
assertion pointing there.

### What gets written once it is decided

The assertion always describes **current behaviour**, because a suite that fails on known
state is a suite people learn to ignore. What changes is the framing around it.

For a **defect**, the test says so, and the defect gets reported to the app's owners:

```ts
/**
 * DEFECT (see docs/API_DEVIATIONS.md): the spec requires 422 with a JSON error body.
 * The app returns 404 text/html because routes/api/users.js catches the save error and
 * calls next() with no argument. Asserted as-is so the suite describes reality; this is
 * pinned to the *current* behaviour and should be updated when the app is fixed.
 */
expect(response.status()).toBe(404);
```

That comment is the difference between documenting a bug and endorsing one. It also means
the day someone fixes the app, this test fails loudly and points straight at why.

For a **deliberate** difference, the comment says that instead, and no defect is raised.

### Never

- **Never widen a schema or loosen an assertion to make a failure disappear.** That is how
  validation stops validating. Establish what changed first.
- **Never treat a deterministic app behaviour as flake.** No retries, no waits.
- **Never decide the classification alone.** Steps 1–3 are an agent's job; step 4 is not.
