# Architecture Decisions

Each decision records what was chosen, what was rejected and why, and the constraint
that would flip it. IDs are stable and referenced from code comments.

---

## D-001 — Guardrails are lint rules, not documentation

**Chosen.** The framework's two structural invariants — locators only in `src/pages/`,
HTTP only in `src/api/` — are enforced by custom ESLint rules that fail the build, with
error messages that name the fix. Style conventions delegate to the Google TypeScript
Style Guide and Playwright's own best practices, enforced via
`@typescript-eslint/naming-convention` and `eslint-plugin-playwright`.

**Rejected: a `CONTRIBUTING.md` describing the conventions.** Prose does not survive
contact with a contributor who has no context, and an AI agent's failure mode is not
ignorance of good practice — it is confident application of practice that is wrong *for
this app*. `getByLabel('Password')` is textbook advice and matches nothing here, because
the app has no labels. Documentation cannot prevent that; a rule can.

**Rejected: a bespoke pre-commit AST analyser.** ESLint already is an AST analyser, with
a mature runner, editor integration, autofix, and a caching story. A second one would be
duplicated machinery with worse ergonomics.

**Would flip if:** the team standardised on a toolchain without ESLint support, or the
rules began producing false positives often enough that contributors reached for
`eslint-disable` — at which point the rule is training people to ignore it and should be
replaced by a narrower one.

---

## D-002 — Assertions encode observed behaviour, never the published spec

**Chosen.** The typed client in `src/api/` validates every response against a Zod schema
written from requests actually issued against the running app. Deviations from the
RealWorld spec are asserted as they are and documented in code.

The app ships `realworld/api/swagger.json`, and it is wrong about this fork in at least
three ways, all verified:

| Case | Spec says | Actually |
| --- | --- | --- |
| `POST /users` success | `201` | `200` |
| `POST /users` duplicate email | `422` JSON | `404`, `text/html`, `error: 404 Not Found /api/users` |
| `bio` / `image` after register vs. login | `string` | `""` from register, `null` from login |

The 404 has a traceable cause: `routes/api/users.js` catches the save error and calls
`next()` with no argument, so the request falls through to the generic 404 handler in
`app.js`. The `""`/`null` split comes from `toAuthJSON` mapping `undefined -> ""`, which
only holds for a freshly constructed model and not one loaded from SQLite.

**Rejected: generating tests from `swagger.json`.** It is the obvious move and it is a
trap — every registration test it produces is wrong twice over. The spec describes the
canonical RealWorld API, not this implementation.

**Rejected: TypeScript types alone.** Types are erased at runtime. A client typed
`{ bio: string }` passes happily when the server sends `null`, and the failure surfaces
later, somewhere else, as something unhelpful.

**Would flip if:** the app served a generated, self-describing schema — an OpenAPI
document produced *from* the implementation rather than aspirationally alongside it. Then
generating the client becomes correct by construction and hand-written schemas become the
thing that drifts.

---

## D-003 — Isolation by unique data, not by resetting state

**Chosen.** Every test builds its own user and data through factories. No shared account,
no database reset, no teardown.

**Rejected: Testcontainers.** It requires a running Docker daemon reachable from the test
process, which is a heavier prerequisite than the reviewer burden we were trying to
avoid, and it buys nothing here: Conduit's database is SQLite — a file, and `:memory:`
under `NODE_ENV=test`. There is no backing service to containerise. The one apparent
route, pointing the app at a containerised Postgres, dies on inspection: `models/index.js`
only selects Postgres when `NODE_ENV=production`, which also forces `ssl: { require: true }`,
demands a `SECRET`, swaps in the production error handler, and serves a static build
instead of the dev server. That is testing a configuration nobody runs.

**Rejected: truncating tables or restoring a SQLite file between tests.** Serialises the
suite, and cleanup that fails halfway leaves worse state than never having cleaned.

**Known limitation.** Uniqueness isolates records, not aggregates. The tag sidebar and
Global Feed are shared, so absolute-count assertions there are racy; the standards
require relative assertions instead.

**Would flip if:** the app gained real external infrastructure, or tests needed
destructive global mutations — admin operations, or assertions on totals that unique data
cannot make deterministic.

---

## D-004 — No CI pipeline; `npm run verify` is the gate

**Chosen.** A single command — typecheck, lint, API suite — run locally before every
push, with its output pasted into the pull request.

**Rejected: a GitHub Actions workflow.** CI is out of assignment scope, and the app under
test needs Node 16, submodule initialisation, and three native-module workarounds
(`docs/APP_SETUP.md`). A pipeline that is fiddly enough to sit red on a public repository
is worse than none.

**Would flip if:** more than one person contributed, at which point local discipline stops
scaling and the setup cost is worth paying once. The workflow would install Node 16,
initialise submodules, apply the documented `--ignore-scripts` and `sqlite3` workarounds,
start both processes, wait on `app:health`, then run `verify`.

---

## D-008 — Coverage is computed, and the gap is the deliverable

**Chosen.** Scenario designs in `docs/scenarios/` carry stable IDs; a test claims one by
putting the ID in its title; `npm run scenarios:coverage` joins the two and prints
implemented against designed, currently **6 of 30**. It fails the build on an *orphan* — a
test claiming an ID no design defines — and never on an unimplemented scenario.

That asymmetry is the whole point. Failing on unimplemented scenarios would push
contributors to delete inconvenient rows, which converts a record of judgement into a
record of what was easy. Failing on orphans keeps every claimed ID reviewable.

**Rejected: line or branch coverage.** It measures which code the tests happened to
execute, which for a black-box suite against someone else's app is both unobtainable and
beside the point. The question worth answering is not "what did we touch" but "what did we
decide was worth testing, and what did we consciously leave".

**Rejected: leaving the gap implicit.** Six tests with no scenario design reads as thin.
Six tests against thirty designed scenarios, each unimplemented one carrying a reason,
reads as scope control. Same suite, opposite impression — and only one of them is
inspectable.

**Would flip if:** the designs stopped being maintained, at which point the number becomes
a comforting fiction. The failure mode to watch for is scenario files that stop changing
while the suite keeps growing.

---

## D-007 — Sessions are injected per test, not replayed from `storageState`

**Chosen.** `authenticatedPage` registers a fresh user over the API and writes its JWT
straight into `localStorage.jwt` with `addInitScript` — the same key the app writes
(`src/middleware.js:52`) and reads on boot (`src/components/App.js:43`).

**Rejected: Playwright's `storageState`.** It is the standard answer and it is the wrong
one here. `storageState` saves one authenticated session to a file and replays it, which
means every test that uses it shares a user. This framework's isolation comes from every
test owning unique data (D-003), and a shared session quietly reintroduces the coupling
that decision exists to prevent — one test favouriting an article, following an author, or
editing a profile would be visible to every other.

Injecting per test costs one API registration — measured in tens of milliseconds against a
local SQLite app — and keeps the isolation model intact.

**Rejected: signing in through the form in every UI test.** Slow, and it couples every
test's reliability to a screen it is not trying to test. Signing in is proved once, by
`UI-P0-01`, which also covers the part injection would skip: that the session survives a
reload, since it lives in `localStorage` rather than a cookie.

**Would flip if:** login became expensive — a real identity provider, MFA, or a rate
limiter — at which point a `storageState` per worker, with users still unique per worker,
becomes the right trade.

---

## D-006 — Four API tests, deliberately, against a client that covers far more

**Chosen.** The suite covers four critical flows: registration and authentication,
duplicate-email rejection, article publication and read-back, and the authorization
boundary on editing. Each earns its place by covering something the others do not.

`ConduitClient`, by contrast, covers the full API surface — favourites, comments,
follows, tags, delete, unfollow. That gap between framework surface and test coverage is
intentional, not unfinished work.

**Rejected: a test per endpoint.** An earlier revision of this branch had seventeen. They
passed, they were fast, and they were the wrong deliverable: the brief asks for three to
five tests covering critical flows, puts full coverage explicitly out of scope, and says
depth over breadth. Seventeen tests demonstrate that the client works. Four well-chosen
ones plus a scenario design demonstrate judgement about what is worth testing, which is
the harder thing to show and the thing actually being assessed.

**Rejected: trimming the client to match the tests.** The brief constrains test count, not
framework surface, and a client that already speaks the whole API is what makes adding
coverage a test-only change. Every method was verified against live responses when it was
written, and the deviations found in the process are catalogued in
`docs/API_DEVIATIONS.md` — that reconnaissance is preserved regardless of how many
assertions ship.

**Consequence, made visible rather than hidden.** The `design-scenarios` skill produces a
prioritised scenario list per feature, and `scenarios:coverage` reports designed against
implemented. The gap is therefore a number a reviewer can see and interrogate, with an
"explicitly not covered" section giving reasons — rather than an omission they have to
notice.

**Would flip if:** this were a real suite guarding a real deployment, where breadth is the
point and every endpoint deserves a regression test. The framework is built so that
closing the gap is additive: the client, fixtures, factories, and guardrails do not change.

---

## D-005 — The app and the framework run on different Node versions

**Chosen.** The app under test is pinned to Node 16 via nvm; the framework runs on
current Node. The framework owns no part of the app's lifecycle — its only contract is
`npm run app:health`, which fails with the exact command to start whatever is missing.

Node 16 rather than the Node 14 the dependency tree targets, because **there is no
`darwin-arm64` build of Node 14** — nodejs.org ships x64 only, so Apple Silicon gets
`Bad CPU type in executable` without Rosetta. Node 16 is the oldest native arm64 build
and still predates the OpenSSL 3 change that breaks webpack 4.

**Rejected: the framework starting the app itself** via Playwright's `webServer`. It
would couple every test run to a two-process, two-Node-version startup and turn app setup
problems into test failures. An optional `webServer` block gated on an `APP_DIR`
environment variable is a reasonable later addition; making it mandatory is not.

**Rejected: pinning the framework to Node 16 as well.** Nothing is gained, and it would
forfeit current Playwright and TypeScript for the sake of a dependency tree we do not own.

**Would flip if:** the app were containerised or upgraded, at which point a single Node
version becomes possible and `webServer` becomes the obvious one-command experience.
