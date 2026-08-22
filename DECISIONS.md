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
