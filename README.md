# Conduit Agentic Test Framework

Playwright + TypeScript tests for the [Conduit](https://github.com/cirosantilli/node-express-sequelize-realworld-example-app)
RealWorld app.

The framework is built so that an AI coding agent writing a test here produces a **correct**
one. Not by asking it to read the rules, but by making the wrong thing fail immediately.
Guardrails over guidelines.

## Quick start

You need the app under test running first. That app is from 2021 and does not build on a
modern machine without four fixes — **read [docs/APP_SETUP.md](docs/APP_SETUP.md) before
your first run.** `npm install && npm start` in that repo does not work.

Once the app is up:

```bash
npm install
npx playwright install chromium
npm run app:health
npm run verify
```

`npm run app:health` checks that both the API (`:3000`) and the UI (`:4101`) answer. If one
is down, it prints the exact command to start it.

## Commands

| Command                                | What it does                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `npm run verify`                       | Everything: `checks` plus both test suites. **Run this before every push.** |
| `npm run checks`                       | The static half — no app needed. This is what CI runs.                      |
| `npm run test:api`                     | API tests only. Under a second — this is the fast loop while writing.       |
| `npm run test:ui`                      | UI tests only.                                                              |
| `npm test`                             | Everything.                                                                 |
| `npm run lint`                         | Guardrails and code style.                                                  |
| `npm run app:health`                   | Is the app under test running?                                              |
| `npm run scenarios:coverage`           | How many designed scenarios are actually implemented.                       |
| `npm run docs:check`                   | Do the docs point at scripts and files that exist?                          |
| `npm run new:test -- <api\|ui> <name>` | Create a new test file that already passes `verify`.                        |
| `npm run new:page -- <Name>`           | Create a new page object.                                                   |

## How it all fits together

Read this top to bottom. Each box only talks to the box below it.

```
                    ┌────────────────────────────────────┐
                    │  Contributor — a person or an AI   │
                    └─────────────────┬──────────────────┘
                                      │ writes or edits a file
                                      ▼
                    ┌────────────────────────────────────┐
                    │  Hook: .claude/hooks/lint-changed  │
                    │  Runs on every SAVE, not at commit │
                    │  ESLint + Prettier on that file    │
                    │  A problem is sent straight back   │
                    └─────────────────┬──────────────────┘
                                      │ file is clean
                                      ▼
                    ┌────────────────────────────────────┐
                    │  npm run verify  — the gate        │
                    │  types · lint · format · coverage  │
                    │  then runs the tests               │
                    └─────────────────┬──────────────────┘
                                      ▼
                    ┌────────────────────────────────────┐
                    │  Playwright runner                 │
                    │  project "api"   ·   project "ui"  │
                    └─────────────────┬──────────────────┘
                                      ▼
                    ┌────────────────────────────────────┐
                    │  src/fixtures/   (test.extend)     │
                    │  Gives each test only what it asks │
                    │  for: api client, users, article,  │
                    │  a signed-in page                  │
                    └────────┬──────────────────┬────────┘
                             │                  │
                UI tests use │                  │ API tests use
                             ▼                  ▼
              ┌──────────────────────┐  ┌──────────────────────┐
              │     src/pages/       │  │      src/api/        │
              │  Page objects.       │  │  ConduitClient.      │
              │  The ONLY place a    │  │  The ONLY place we   │
              │  locator may live.   │  │  send HTTP. Every    │
              │                      │  │  reply is checked    │
              │                      │  │  against a schema.   │
              └──────────┬───────────┘  └──────────┬───────────┘
                         │                         │
                         │  ┌──────────────────────┴───┐
                         │  │ src/factories/ + config/ │
                         │  │ unique test data, URLs   │
                         │  │ used by BOTH sides       │
                         │  └───────────┬──────────────┘
                         │              │
              ═══════════╪══ network ═══╪═══════════════
                         ▼              ▼
              ┌────────────────────────────────────────┐
              │   Conduit app under test               │
              │   UI :4101    ·    API :3000/api       │
              │   Node 16 · never modified by us       │
              └────────────────────────────────────────┘
```

**Why it is shaped like this.** There are only two doors into the app: page objects for the
browser, and `ConduitClient` for HTTP. Everything else has to go through one of them. Two
custom ESLint rules make that a build failure rather than a house rule, so a test file
simply cannot contain a locator or an HTTP call.

That matters because both doors are where the app's surprises live. The DOM has no test
IDs and no labels, so a selector has to be checked against the running page. The API
disagrees with its own published spec in several places, so a response shape has to be checked
against a real reply. Keeping both behind one door each means those checks happen once, in
a file someone reviewed — not guessed at in every new test.

## What "agentic-first" means here

An AI agent writing a test for this app has read a thousand RealWorld tutorials and zero
lines of _this_ version of it. So it writes code that looks right, is standard practice,
and is wrong here in ways you can predict. Every rule below blocks one of those specific
mistakes.

| What an agent writes                                                               | What stops it                                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `getByLabel('Password')` — this app has no labels at all                           | Locators are a lint error outside `src/pages/`                                    |
| `getByRole('textbox')` on its own — matches 2 things on the login form             | Same rule. The page object holds a selector that was counted against the real DOM |
| `.locator('.form-control')` — 2 matches on login, 4 in the editor                  | Same rule                                                                         |
| `expect(status).toBe(422)` for a duplicate signup, because the spec says so        | HTTP is a lint error outside `src/api/`, where schemas record what really happens |
| `expect(created.tagList).toEqual(sentTags)` — the create reply never includes tags | The client method says so in a comment; `ART-P0-01` pins the real behaviour       |
| `await page.waitForTimeout(1000)`                                                  | Lint error                                                                        |
| `expect(await x.isVisible()).toBe(true)` — checks once and never retries           | Lint error (`prefer-web-first-assertions`)                                        |
| Assumes `bio` is always a string                                                   | The schema fails at the call site and names the endpoint                          |

These are not guesses. Running the guardrails over a file containing all of them produces
six errors, and each one names the fix.

## Skills and subagents — why some are one and some the other

`.claude/` holds two kinds of thing, and the difference is not cosmetic.

**Skills** (`.claude/skills/`) are instructions the main agent follows **itself**. They load
into the current conversation, so the agent keeps everything it already knows — what you
asked for, which files it just read, what it decided five minutes ago. A skill is a
checklist that changes how the agent works.

**Subagents** (`.claude/agents/`) are a **separate** agent with its own fresh context, its
own tool list, and its own model. It starts cold, does one job, and returns a report. The
main agent never sees its working-out — only the answer.

The choice comes down to three questions:

| Ask                                                  | If yes   | Why                                                           |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------- |
| Does it need to be **unable** to edit files?         | subagent | Only a subagent can be given a restricted tool list           |
| Is a **fresh, independent** view better?             | subagent | A separate context can't be swayed by the conversation so far |
| Does it produce lots of **noisy intermediate work**? | subagent | That noise stays out of the main conversation                 |
| Otherwise                                            | skill    | The agent does the work itself and keeps full context         |

So:

- **`add-api-test` and `add-ui-test` are skills** because the main agent is the one writing
  the test. It needs the full conversation to know what to build, and it needs to actually
  create the file. Handing this to a subagent would return a file whose reasoning nobody
  saw.
- **`test-reviewer` is a subagent** for two reasons. Independence: a reviewer that did not
  write the code, and cannot see the conversation that produced it, is a better reviewer.
  And enforcement: its tool list is `Bash, Read, Grep, Glob` — no `Edit`, no `Write`. "It
  reports, it does not fix" is a property of the setup, not a promise in a document.
- **`selector-scout` is a subagent** because it generates a lot of noise — page trees,
  match counts, rejected candidates — and only the verified result matters. It is also
  read-only for the same structural reason, and runs on a cheaper model because counting
  matches is mechanical work.
- **`triage-failure` and `design-scenarios` are skills** because the main agent has to act
  on what it finds. `design-scenarios` is the closest call: it explores like the scout
  does, but it writes a file the agent then works from, so keeping it in context avoids
  reading that file back in.

## Repository layout

```
src/api/         Typed client + schemas — the only place HTTP is sent
src/pages/       Page objects — the only place locators may appear
src/factories/   Builders that make unique data for each test
src/fixtures/    Playwright fixtures, composed with test.extend
src/config/      Environment loading and validation
tests/api/       API tests
tests/ui/        UI tests
tools/           Health check, file generators, coverage report
eslint-rules/    The two custom guardrail rules
.claude/         Skills, subagents, and the save-time hook
docs/            Standards, data strategy, deviations, scenario designs
```

## The agentic infrastructure

Ten pieces. Each one blocks a specific mistake listed above — nothing was added just to
round out the set.

| Piece                             | Mistake it blocks                                           |
| --------------------------------- | ----------------------------------------------------------- |
| `eslint-rules/` (2 custom rules)  | Invented selectors and one-off HTTP calls                   |
| `.claude/hooks/lint-changed.mjs`  | The delay between writing a mistake and hearing about it    |
| `.claude/skills/add-api-test`     | Testing what the spec says instead of what the app does     |
| `.claude/skills/add-ui-test`      | Guessing selectors on an app that has no test IDs           |
| `.claude/skills/design-scenarios` | Testing whatever is easy instead of whatever matters        |
| `.claude/skills/triage-failure`   | "Fixing" a test that was correctly reporting a real bug     |
| `.claude/agents/selector-scout`   | Selectors written from memory instead of from the live page |
| `npm run new:test` / `new:page`   | Conventions you have to read a document to follow           |
| `npm run docs:check`              | Docs that quietly stop matching the code                    |
| `.github/workflows/checks.yml`    | The static gate being skipped because someone forgot        |

The hook is the piece worth trying yourself: open a test file, put a locator in it, save,
and the complaint arrives before you have moved on. Rules only ever say _no_ — the
generators are the half that says _yes, like this_, and a generated file passes `verify`
before you change a line of it.

Coverage is a number the tools work out, not a claim:

```
$ npm run scenarios:coverage
  Priority   Implemented / Designed
  P0                   5 / 7
  P1                   1 / 6
  P2                   0 / 2
  TOTAL                6 / 15
```

`docs/scenarios/authentication.md` is written out in full — twelve scenarios, three
implemented, each omission with a reason. `articles.md` deliberately lists only what it has
delivered, so that running `design-scenarios` against that feature regenerates the rest and
the designed count climbs. That is the skill doing its job in the open.

A scenario that is designed but not implemented never fails the build. An **orphan** — a
test claiming an ID that no design defines — always does. See [D-004](DECISIONS.md) for why
that asymmetry is deliberate.

## How test data flows

```
  ┌──────────────────────┐     ┌──────────────────────────┐
  │   src/factories/     │ ──► │  A user and article that │
  │   buildUser()        │     │  belong to ONE test only │
  │   buildArticle()     │     │  (unique name + email)   │
  └──────────────────────┘     └────────────┬─────────────┘
                                            │ created over the API
                                            ▼
                               ┌──────────────────────────┐
                               │  Tests run in parallel   │
                               │  No database reset       │
                               │  No cleanup afterwards   │
                               └────────────┬─────────────┘
                                            ▼
                               ┌──────────────────────────┐
                               │  Assertions are relative │
                               │  "my article is there",  │
                               │  never "there are 3"     │
                               └──────────────────────────┘
```

Every test makes its own data, so two tests can never collide and there is nothing to clean
up afterwards. That is what lets the suite run fully parallel.

The one weak spot is genuinely shared state: Conduit's tag list and Global Feed belong to
every test at once. So the standards ban counting them and require relative checks instead —
a hard count would be a race by design. Full reasoning in
[docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md#test-data).

## What is covered

Six tests: four API, two UI.

| Test          | Covers                                                          |
| ------------- | --------------------------------------------------------------- |
| `AUTH-P0-01`  | Signing up, the token working, and logging in                   |
| `AUTH-P1-01`  | Duplicate email refused — a recorded `404` deviation            |
| `ART-P0-01`   | Publishing an article and reading it back — `tagList` deviation |
| `AUTHZ-P0-01` | A non-author cannot edit, and the article really is unchanged   |
| `UI-P0-01`    | Signing in on the form, and the session surviving a reload      |
| `UI-P0-02`    | Publishing in the editor and the article appearing              |

Signing in through the form is proved once, in `UI-P0-01`. Every other UI test injects the
session directly, because proving login again on the way to testing something else only adds
ways to fail.

`ConduitClient` covers far more than these tests use — favourites, comments, follows, tags,
delete. That gap is a decision, not unfinished work. The brief asks for depth over breadth
and puts full coverage out of scope, and a client that already speaks the whole API is what
makes adding a test a test-only change. Every method was checked against a real response
when it was written, and what that turned up is in
[docs/DEVIATIONS.md](docs/DEVIATIONS.md).

## Reviewing this repo in 30 minutes

If you only have half an hour, this order tells the whole story:

1. **This README** — the shape of the thing
2. **[DECISIONS.md](DECISIONS.md)** — five decisions, what was rejected, and what would
   change each one
3. **[AI_USAGE.md](AI_USAGE.md)** — how AI was used, and the three times it was wrong
4. **[tests/api/articles.spec.ts](tests/api/articles.spec.ts)** — a test asserting what the
   app really does, not what its spec claims
5. **[eslint-rules/no-locators-outside-page-objects.js](eslint-rules/no-locators-outside-page-objects.js)** —
   a guardrail, with the reason it exists in the comment
6. **`npm run verify`** — see it green

That path runs idea → judgement → evidence → enforcement → proof.

Conventions are in [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md). Where the
app disagrees with the RealWorld spec — nine recorded places — see
[docs/DEVIATIONS.md](docs/DEVIATIONS.md); every entry names the file and line in the
app that causes it. Notably, error responses are not JSON (`403` is `text/plain`, `401` is
`text/html`), and `POST /articles` never returns the tags you sent it.
