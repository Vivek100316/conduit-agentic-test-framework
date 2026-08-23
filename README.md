# Conduit Agentic Test Framework

Playwright + TypeScript tests for the [Conduit](https://github.com/cirosantilli/node-express-sequelize-realworld-example-app)
RealWorld app, designed so that an AI coding agent contributing a test produces a
correct one. Guardrails over guidelines.

## Quick start

The framework needs the app under test running on `localhost`. That app is a 2021
codebase with four separate problems on a modern machine — **read
[docs/APP_SETUP.md](docs/APP_SETUP.md) before your first run**; `npm install && npm start`
in that repo does not work.

Once the app is up:

```bash
npm install
npx playwright install chromium
npm run app:health
npm run verify
```

`npm run app:health` confirms both the API (`:3000`) and UI (`:4101`) are reachable and
prints the exact command to start whichever one is not.

## Commands

| Command                                | What it does                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run verify`                       | Typecheck, lint, scenario coverage, both suites. **The definition of done — run before every push.** |
| `npm run test:api`                     | API suite only. Sub-second; this is the inner loop.                                                  |
| `npm run test:ui`                      | UI suite only.                                                                                       |
| `npm test`                             | Everything.                                                                                          |
| `npm run lint`                         | Guardrails and style.                                                                                |
| `npm run app:health`                   | Is the app under test running?                                                                       |
| `npm run scenarios:coverage`           | Designed scenarios vs. implemented ones.                                                             |
| `npm run new:test -- <api\|ui> <name>` | Scaffold a spec that is green before you edit it.                                                    |
| `npm run new:page -- <Name>`           | Scaffold a page object.                                                                              |

## What "agentic-first" means here

An AI agent writing a test for this app has read a thousand RealWorld tutorials and zero
lines of _this_ fork. It produces code that is idiomatic, confident, and wrong in
predictable ways. Every design choice below closes one of those specific failure modes
structurally, rather than asking a contributor to remember something.

| What an agent does                                                                  | What stops it                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getByLabel('Password')` — no labels exist in this app                              | Locators are a lint error outside `src/pages/`                                              |
| `getByRole('textbox')` unqualified — 2 matches on the login form                    | Same rule; the page object holds a selector verified against the real DOM                   |
| `.locator('.form-control')` — 2 matches on login, 4 in the editor                   | Same rule                                                                                   |
| `expect(status).toBe(422)` on duplicate registration, because the spec says so      | Raw HTTP is a lint error outside `src/api/`; the client's schemas encode observed behaviour |
| `expect(created.tagList).toEqual(sentTags)` — the create response never echoes tags | Client method documents it; `ART-P1-01` pins the real behaviour                             |
| `await page.waitForTimeout(1000)`                                                   | Lint error                                                                                  |
| `expect(await x.isVisible()).toBe(true)` — evaluates once, never retries            | Lint error (`prefer-web-first-assertions`)                                                  |
| Assumes `bio` is a `string`                                                         | Runtime schema validation fails at the call site, naming the route                          |

These are not hypothetical. Running the guardrails against a file containing all of them
produces six errors, each naming the fix.

## Structure

```
src/api/         Typed client + runtime schemas — the only place HTTP is spoken
src/pages/       Page objects — the only place locators may appear
src/factories/   Unique-per-test data builders
src/fixtures/    Playwright fixtures composed with test.extend
src/config/      Environment loading and validation
tests/api/       API specs
tests/ui/        UI specs
tools/           Health check, scaffolding, scenario coverage
eslint-rules/    Custom guardrail rules
.claude/         Skills, subagents, and the lint-on-edit hook
docs/            Standards, data strategy, deviations, scenario designs
```

## The agentic infrastructure

Eight artifacts, each closing a failure mode named above rather than added for
completeness.

| Artifact                          | Closes                                                 |
| --------------------------------- | ------------------------------------------------------ |
| `eslint-rules/` (2 custom rules)  | Hallucinated selectors and one-off HTTP calls          |
| `.claude/hooks/lint-changed.mjs`  | Delay between writing a violation and hearing about it |
| `.claude/skills/add-api-test`     | Asserting the spec instead of the app                  |
| `.claude/skills/add-ui-test`      | Guessing selectors on an app with no test ids          |
| `.claude/skills/design-scenarios` | Coverage chosen by convenience rather than priority    |
| `.claude/skills/triage-failure`   | "Fixing" a test that was correctly reporting a bug     |
| `.claude/agents/selector-scout`   | Selectors derived from memory rather than the DOM      |
| `npm run new:test` / `new:page`   | Conventions that must be read to be followed           |

The hook is the piece worth trying: edit a spec, put a locator in it, and the violation
comes back before you have moved on. Guardrails only ever say _no_ — the generators are the
half that says _yes, here_, and a generated file passes `verify` before a line is changed.

Coverage is a computed number, not a claim:

```
$ npm run scenarios:coverage
  Priority   Implemented / Designed
  P0                   5 / 11
  P1                   1 / 15
  P2                   0 / 4
  TOTAL                6 / 30
```

Unimplemented scenarios never fail the build; an orphaned ID — one a test claims but no
design defines — always does. See [D-004](DECISIONS.md).

Conventions live in [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md);
architecture decisions and their rejected alternatives in [DECISIONS.md](DECISIONS.md);
how AI was used to build this, including what it got wrong, in [AI_USAGE.md](AI_USAGE.md).

Where the app disagrees with the RealWorld spec — and it does, in nine catalogued ways —
see [docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md). Every entry names the route file and
line responsible. Notably, error responses are not JSON (`403` is `text/plain`, `401` is
`text/html`), and `POST /articles` never returns the tags you sent it.

## Scope of coverage

Six tests: four API, two UI.

| Test          | Covers                                                          |
| ------------- | --------------------------------------------------------------- |
| `AUTH-P0-01`  | Registration, token authenticates, credentials log in           |
| `AUTH-P1-01`  | Duplicate email rejected — a documented `404` deviation         |
| `ART-P0-01`   | Article published and read back — the `tagList` deviation       |
| `AUTHZ-P0-01` | Non-author cannot edit, and the article is genuinely unchanged  |
| `UI-P0-01`    | Signing in through the form, and the session surviving a reload |
| `UI-P0-02`    | Publishing from the editor and the article rendering            |

Signing in through the form is proved once, by `UI-P0-01`. Every other UI test injects the
session directly, because re-proving login on the way to testing something else only buys
extra ways to fail.

`ConduitClient` deliberately covers much more than the tests exercise — favourites,
comments, follows, tags, delete. That gap is a decision, not unfinished work: the brief
puts full coverage out of scope and asks for depth over breadth, while a client that
already speaks the whole API is what makes adding a scenario a test-only change. Every
method was verified against live responses when written, and what that reconnaissance
turned up is in [docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md). See
[D-004](DECISIONS.md).

## Test isolation

Every test builds its own user and its own data through a factory. There is no shared
account, no database reset, and no teardown — isolation comes from uniqueness, which is
parallel-safe and cannot fail halfway and leave the next test worse off.

The one place this strains is genuinely global state: Conduit's tag sidebar and Global
Feed are shared across every test in a run. The standards therefore ban absolute-count
assertions on them in favour of relative ones ("my article is present"), because a hard
count is racy by construction.
