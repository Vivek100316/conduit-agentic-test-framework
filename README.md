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

| Command | What it does |
| --- | --- |
| `npm run verify` | Typecheck, lint, and run the API suite. **The definition of done — run before every push.** |
| `npm run test:api` | API suite only. Sub-second; this is the inner loop. |
| `npm run test:ui` | UI suite only. |
| `npm test` | Everything. |
| `npm run lint` | Guardrails and style. |
| `npm run app:health` | Is the app under test running? |

## What "agentic-first" means here

An AI agent writing a test for this app has read a thousand RealWorld tutorials and zero
lines of *this* fork. It produces code that is idiomatic, confident, and wrong in
predictable ways. Every design choice below closes one of those specific failure modes
structurally, rather than asking a contributor to remember something.

| What an agent does | What stops it |
| --- | --- |
| `getByLabel('Password')` — no labels exist in this app | Locators are a lint error outside `src/pages/` |
| `getByRole('textbox')` for a password field — `input[type=password]` has no implicit ARIA role | Same rule; the page object holds a selector verified against the real DOM |
| `.locator('.form-control')` — 2 matches on login, 4 in the editor | Same rule |
| `expect(status).toBe(422)` on duplicate registration, because the spec says so | Raw HTTP is a lint error outside `src/api/`; the client's schemas encode observed behaviour |
| `await page.waitForTimeout(1000)` | Lint error |
| `expect(await x.isVisible()).toBe(true)` — evaluates once, never retries | Lint error (`prefer-web-first-assertions`) |
| Assumes `bio` is a `string` | Runtime schema validation fails at the call site, naming the route |

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
tools/           Health check and repository checks
eslint-rules/    Custom guardrail rules
docs/            Standards, app setup
```

Conventions live in [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md);
architecture decisions and their rejected alternatives in [DECISIONS.md](DECISIONS.md);
how AI was used to build this, including what it got wrong, in [AI_USAGE.md](AI_USAGE.md).

## Test isolation

Every test builds its own user and its own data through a factory. There is no shared
account, no database reset, and no teardown — isolation comes from uniqueness, which is
parallel-safe and cannot fail halfway and leave the next test worse off.

The one place this strains is genuinely global state: Conduit's tag sidebar and Global
Feed are shared across every test in a run. The standards therefore ban absolute-count
assertions on them in favour of relative ones ("my article is present"), because a hard
count is racy by construction.
