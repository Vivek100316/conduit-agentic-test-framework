# Architecture Decisions

Five decisions, each recording what was chosen, what was rejected and why, and the
constraint that would flip it. IDs are stable and referenced from code comments.

---

## D-001 — Guardrails are lint rules, not documentation

**Chosen.** The framework's two structural invariants — locators only in `src/pages/`,
HTTP only in `src/api/` — are enforced by custom ESLint rules that fail the build, with
error messages that name the fix. Style delegates to the Google TypeScript Style Guide and
Playwright's own best practices via `@typescript-eslint/naming-convention` and
`eslint-plugin-playwright`; formatting is Prettier's, checked in `verify`. A `PostToolUse`
hook runs both on every file the moment it is written, so a violation comes back within the
same train of thought rather than at commit time.

**Rejected: a `CONTRIBUTING.md` describing the conventions.** Prose does not survive
contact with a contributor who has no context, and an AI agent's failure mode is not
ignorance of good practice — it is confident application of practice that is wrong _for
this app_. `getByLabel('Password')` is textbook advice and matches nothing here, because
the app has no labels. Documentation cannot prevent that; a rule can.

**Rejected: a bespoke pre-commit AST analyser.** ESLint already is an AST analyser, with a
mature runner, editor integration, autofix, and caching. A second one would be duplicated
machinery with worse ergonomics.

**Would flip if:** the team standardised on a toolchain without ESLint, or the rules began
producing false positives often enough that contributors reached for `eslint-disable` — at
which point the rule is training people to ignore it and should be narrowed.

---

## D-002 — Assertions encode observed behaviour, never the published spec

**Chosen.** The typed client in `src/api/` validates every response against a Zod schema
written from requests actually issued against the running app. Deviations are asserted as
they are and catalogued in `docs/API_DEVIATIONS.md`.

The app ships `realworld/api/swagger.json`, and it is wrong about this fork in four
verified ways:

| Case                          | Spec says        | Actually                                 |
| ----------------------------- | ---------------- | ---------------------------------------- |
| `POST /users` success         | `201`            | `200`                                    |
| `POST /users` duplicate email | `422` JSON       | `404`, `text/html`                       |
| `bio` / `image`               | `string`         | `""` from register, `null` from login    |
| `POST /articles` response     | echoes `tagList` | always `[]`; a later read shows the tags |

Each has a traceable cause. The `404` comes from `routes/api/users.js` catching the save
error and calling `next()` with no argument, so the request falls through to the generic
404 handler. The empty `tagList` comes from `setArticleTags` not returning its inner
promise chain, so the article serialises before the association is written.

**Rejected: generating tests from `swagger.json`.** It is the obvious move and it is a
trap — every registration test it produces is wrong twice over.

**Rejected: TypeScript types alone.** Types are erased at runtime. A client typed
`{ bio: string }` passes happily when the server sends `null`, and the failure surfaces
later, elsewhere, as something unhelpful.

**Would flip if:** the app served a schema generated _from_ the implementation rather than
written aspirationally alongside it. Then generating the client is correct by construction
and hand-written schemas become the thing that drifts.

---

## D-003 — Isolation comes from unique data, not from resetting or sharing state

**Chosen.** Every test builds its own user and data through factories. No shared account,
no database reset, no teardown. `authenticatedPage` registers a fresh user over the API and
injects its JWT into `localStorage.jwt` — the key the app itself writes
(`src/middleware.js:52`) and reads on boot (`src/components/App.js:43`).

**Rejected: Testcontainers.** It needs a Docker daemon reachable from the test process,
which is a heavier prerequisite than the reviewer burden it was meant to avoid, and it buys
nothing here: Conduit's database is SQLite — a file, and `:memory:` under `NODE_ENV=test`.
There is no backing service to containerise. The one apparent route, pointing the app at a
containerised Postgres, dies on inspection: `models/index.js` selects Postgres only when
`NODE_ENV=production`, which also forces `ssl: { require: true }`, demands a `SECRET`,
swaps in the production error handler, and serves a static build instead of the dev server.
That is testing a configuration nobody runs.

**Rejected: truncating tables or restoring a SQLite file between tests.** Serialises the
suite, and cleanup that fails halfway leaves worse state than never having cleaned.

**Rejected: Playwright's `storageState`.** The standard answer, and wrong here.
`storageState` saves one authenticated session and replays it, which means a shared user —
and one test favouriting an article or following an author would then be visible to every
other. Per-test injection costs one API registration against a local SQLite app.

**Known limitation.** Uniqueness isolates records, not aggregates. The tag sidebar and
Global Feed are shared, so absolute-count assertions there are racy; the standards require
relative assertions instead.

**Would flip if:** the app gained real external infrastructure; if tests needed destructive
global mutations or deterministic totals; or if login became expensive — a real identity
provider, MFA, a rate limiter — at which point a `storageState` per worker, with users
still unique per worker, becomes the right trade.

---

## D-004 — Scope is chosen deliberately, and the gap is made visible

**Chosen.** Six tests — four API, two UI — covering registration and authentication,
duplicate-email rejection, article publication with read-back, the authorization boundary
on editing, signing in through the form, and publishing through the editor.

Against that, `docs/scenarios/` designs **30** scenarios, each citing a route handler,
component line, or observed response. `npm run scenarios:coverage` joins the two and prints
implemented against designed. It fails the build on an _orphan_ — a test claiming an ID no
design defines — and never on an unimplemented scenario.

That asymmetry is the point. Failing on unimplemented scenarios would push contributors to
delete inconvenient rows, converting a record of judgement into a record of what was easy.

`ConduitClient` likewise covers far more than the tests exercise — favourites, comments,
follows, tags, delete. Also deliberate: the brief constrains test count, not framework
surface, and a client that already speaks the whole API makes adding a scenario a test-only
change.

**Rejected: a test per endpoint.** An earlier revision had seventeen. They passed, they
were fast, and they were the wrong deliverable — the brief asks for three to five tests on
critical flows, puts full coverage out of scope, and says depth over breadth. Seventeen
tests demonstrate the client works. Six well-chosen ones against thirty designed scenarios
demonstrate judgement about what is worth testing.

**Rejected: line or branch coverage.** It measures which code the tests happened to
execute, which for a black-box suite against someone else's app is both unobtainable and
beside the point.

**Rejected: leaving the gap implicit.** Six tests with no design reads as thin. Six against
thirty, each omission carrying a reason, reads as scope control. Same suite, opposite
impression, and only one is inspectable.

**Would flip if:** this guarded a real deployment, where breadth is the point. Closing the
gap is purely additive — client, fixtures, factories, and guardrails do not change.

---

## D-005 — The app and the framework run on different runtimes, and there is no CI

**Chosen.** The app under test is pinned to Node 16 via nvm; the framework runs on current
Node. The framework owns no part of the app's lifecycle — its only contract is
`npm run app:health`, which fails with the exact command to start whatever is missing.

Node 16 rather than the Node 14 the dependency tree targets, because **there is no
`darwin-arm64` build of Node 14** — nodejs.org ships x64 only, so Apple Silicon gets
`Bad CPU type in executable` without Rosetta. Node 16 is the oldest native arm64 build and
still predates the OpenSSL 3 change that breaks webpack 4.

The gate is `npm run verify`: typecheck, lint, format, scenario coverage, both suites. Run
locally before every push, with its output pasted into the pull request.

**Rejected: a GitHub Actions workflow.** CI is out of the brief's scope, and the app needs
Node 16, submodule initialisation, and three native-module workarounds
(`docs/APP_SETUP.md`). A pipeline fiddly enough to sit red on a public repository is worse
than none. **If it were added**, it would install Node 16, initialise submodules, apply the
documented `--ignore-scripts` and `sqlite3@5.1.7 --no-save` workarounds, start both
processes, wait on `app:health`, then run `verify` — with the UI project retried once and
traces uploaded as artifacts.

**Rejected: the framework starting the app** via Playwright's `webServer`. It would couple
every run to a two-process, two-Node-version startup and turn setup problems into test
failures. An optional `webServer` gated on an `APP_DIR` variable is a reasonable later
addition; mandatory is not.

**Would flip if:** more than one person contributed, at which point local discipline stops
scaling; or the app were containerised or upgraded, making a single runtime and a
one-command `webServer` experience possible.
