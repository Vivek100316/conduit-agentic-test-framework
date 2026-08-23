# Observed Deviations

Where the app behaves differently from what its documentation, its specification, or
ordinary web convention would lead you to expect — **across both the API and the UI**.

Everything here was verified by exercising the running app, never read from a
specification. For the API, the document it disagrees with is
`realworld/api/swagger.json`, which describes the canonical RealWorld API rather than this
fork. For the UI there is no such document — the yardstick is the app's own consistency and
what any user would expect a form to do.

**This file is the reason both guardrail rules exist.** An agent writing a one-off request
inside a test reproduces the spec's version of events; an agent adding a method to
`ConduitClient` has to look at a real response. An agent inventing a selector reproduces
what a login form usually looks like; an agent editing a page object has to open the page.

If you find a new deviation, do **not** simply encode it. Reproduce it, find the cause in
the app's source, propose a classification, and ask — see [§ Policy](#policy--when-the-app-and-the-spec-disagree)
at the end of this file.

---

## API deviations

### Status codes

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

### Payload shapes

#### `bio` and `image` change type depending on how you authenticated

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

#### `POST /articles` never returns the tags you sent

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
spec implies and what this app never does. Pinned by `ART-P0-01`.

---

### Behaviour

#### The slug does not follow the title

RealWorld implementations normally regenerate the slug when the title changes. This one
assigns the new title and leaves `slug` alone (`routes/api/articles.js:169`), so existing
links keep working. Arguably better behaviour than the spec; still a deviation.
Designed but not implemented — see the UI half of this section for the browser-visible
consequence.

Slugs carry a random suffix (`my-title-a1b2c3`), so two articles with identical titles do
not collide — which is what makes parallel article creation safe.

#### Both `Token` and `Bearer` are accepted

`routes/auth.js` accepts either scheme. The RealWorld spec defines `Token`, and the app's
own frontend sends `Token`.

This one is dangerous precisely because it is permissive: an agent guessing `Bearer`
gets a passing test, so the wrong convention silently enters the codebase and nothing ever
signals it. `authHeader()` in `src/api/conduit-client.ts` is the single place that decides,
and it sends `Token`.

---

## UI deviations

A deviation is not only an HTTP contract problem. The browser has its own expectations —
form conventions, what a control does, what feedback an action gives — and this app departs
from several. These were found by driving the running UI and reading the result, the same
way the API rows above were found.

### A tag typed but not committed is silently discarded

Type a tag into the editor's tag field and publish **without pressing Enter**, and the tag
vanishes. No warning, no validation message, and the article publishes successfully with no
tags at all.

```
PROBE uncommitted tag -> tagList = []
```

The tag field commits on `keyup` of Enter (`src/components/Editor.js:140`); nothing reads
the field's residual value at submit time. A user who types a tag and clicks Publish — the
obvious sequence — loses it without being told.

**Classified a defect.** Silent data loss on the happy path is not a defensible design
choice. Worth reporting to the app's owners, not merely testing. Designed as `UI-P1-03` in
[scenarios/articles.md](scenarios/articles.md); unimplemented.

### Enter in a form field does not submit the form

Pressing Enter in the editor's title field does nothing — the page stays put.

```
PROBE after Enter in title, url = http://localhost:4101/editor
```

The Publish control is `type="button"` with a click handler
(`src/components/Editor.js:159`), not a submit inside a form with an `onSubmit`. Implicit
form submission never fires. The login form, by contrast, _is_ a real submit form, so Enter
works there — the app is inconsistent with itself, which is the part likeliest to surprise
a user.

**Classified a defect**, low severity: it costs a keystroke, not data.

### An article's URL keeps the old slug after a rename

Rename an article and its original URL still resolves, now showing the new title:

```
PROBE old slug still resolves = true, h1 = "Totally New Title"
```

This is the UI-visible half of the slug behaviour recorded above. RealWorld implementations
normally regenerate the slug, which breaks every existing link to that article.

**Classified a deliberate difference, and arguably better than the spec.** Stable URLs are a
feature. Recorded so that nobody "fixes" it into spec compliance without noticing what they
would break.

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

The policy below applies to **both halves of this document**. For the API the written
source is the spec; for the UI it is the product's own consistency and ordinary web
convention — a form that ignores Enter, or a field that silently drops input, is a
deviation from what a user is entitled to expect even though no document says so.

|                         | Says                               | Use it for                                                  |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------- |
| The spec, or convention | What the app is **supposed** to do | Designing scenarios — deriving what is worth testing at all |
| The running app         | What the app **currently** does    | Writing assertions — the suite must describe reality        |

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
own request being wrong. Every row in `DEVIATIONS.md` names a file and line.

**3. Classify it.** This is the judgement an agent should surface rather than make:

| Class          | Looks like                                          | Example here                                                                               |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Defect**     | The app is wrong; no one would defend the behaviour | Duplicate registration returns `404 text/html` because `next()` is called with no argument |
| **Stale spec** | The app is right; the document was never updated    | —                                                                                          |
| **Deliberate** | The app knowingly differs, and it is defensible     | Slug does not regenerate on title change, so existing links keep working                   |

**4. Ask.** Present the evidence, the cause, the classification, and the options. Then
wait. Do not write the assertion first and mention it afterwards.

**5. Record whichever way it goes.** A row in `DEVIATIONS.md`, and a comment at the
assertion pointing there.

### What gets written once it is decided

The assertion always describes **current behaviour**, because a suite that fails on known
state is a suite people learn to ignore. What changes is the framing around it.

For a **defect**, the test says so, and the defect gets reported to the app's owners:

```ts
/**
 * DEFECT (see docs/DEVIATIONS.md): the spec requires 422 with a JSON error body.
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
