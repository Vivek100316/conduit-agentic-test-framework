# AI Usage

This framework was built with Claude Code as the primary tool, with a second opinion
solicited from Google Gemini on the architecture. This file is appended to as work
happens rather than reconstructed at the end — the specifics below are transcript, not
recollection.

Every claim about the app in this repository was verified by running something. That
discipline exists because of what is recorded here.

---

## How it was actually driven

Claude Code, in a single long session, with the app running locally throughout. The work
was split into four pull requests (#1 skeleton and guardrails, #2 API coverage, #3 UI
coverage, #4 agentic infrastructure), each gated on `npm run verify`.

The prompts were short and directional rather than specified — the interesting ones are the
corrections, because that is where the design actually came from. Verbatim:

| Prompt                                                                                                                                                    | What it changed                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"Let's first discuss on the test strategies, test tools and test infra, design pattern extra"_                                                           | Design discussion before any code. Nothing was written for the first several exchanges.                                                                                                                                                                                     |
| _"since we can't force reviewers to have docker, what your thoughts on testcontainers?"_                                                                  | Forced the containerisation question to a conclusion. Testcontainers **is** a Docker client, so it fails the same constraint — and investigating the Postgres path found `models/index.js` only uses Postgres under `NODE_ENV=production`, with SSL required. Became D-003. |
| _"Also, there are some inputs by Gemini, let me know if you are aligned or have different thought process?"_ (followed by a pasted architecture proposal) | Produced the cross-check in §2–§5 below. Roughly 60% aligned; the two most specific recommendations were wrong for this app.                                                                                                                                                |
| _"we don't need to so much test cases count, 3-4 tests should be enough"_                                                                                 | Cut the API suite from seventeen tests to four. See §6.                                                                                                                                                                                                                     |
| _"and what about test data?"_                                                                                                                             | Exposed that data management was the thinnest part of the framework. Produced `docs/ENGINEERING_STANDARDS.md`, the shared `unique()` helper, and the removal of faker from anything asserted on.                                                                            |
| _"what kind of a format we are using?"_                                                                                                                   | Exposed that Prettier was declared in `package.json` but never configured or enforced — 39 files failed `prettier --check`. Now wired into `verify` and the edit hook.                                                                                                      |

Two of those six are the user catching the framework doing the thing it was built to
prevent: claiming something was handled when it was only declared.

The mechanical prompts — "add an API test for X", "why did this fail" — were largely
replaced by the skills in `.claude/skills/`, which is the point of them. The generated
scenario designs in `docs/scenarios/` came from `design-scenarios`.

---

## Where AI was wrong, and how it was caught

### 1. Claude recommended a Node version that does not exist for this machine

The app is a 2021 codebase whose dependency tree targets Node 14. Asked how to get it
running, Claude recommended installing Node 14 via nvm, reasoning correctly that
`node-sass@5` supports Node 14/15 and that `sqlite3@5.0.2` ships napi-v3 prebuilds.

The reasoning was sound and the conclusion was wrong:

```
Downloading https://nodejs.org/dist/v14.21.3/node-v14.21.3-darwin-x64.tar.xz...
/Users/…/bin/node: Bad CPU type in executable
```

**There is no `darwin-arm64` build of Node 14.** Official arm64 macOS builds start at
Node 16. On Apple Silicon, Node 14 requires Rosetta.

**Caught by:** running the install instead of trusting it. Confirmed by listing the
actual dist directory:

```bash
curl -s https://nodejs.org/dist/v14.21.3/ | grep -o 'node-v14.21.3-darwin-[a-z0-9]*\.tar\.gz'
# node-v14.21.3-darwin-x64.tar.gz     ← x64 only
```

**Correction:** Node 16, which has a native arm64 build and still predates the OpenSSL 3
change that breaks webpack 4. Recorded as D-005.

The general lesson shaped the framework: an AI's version and compatibility claims are
plausible reconstructions, and plausible is not the same as true on _this_ machine.

---

### 2. Gemini proposed a lint rule that would make the app untestable

Asked for an agentic-first architecture, Gemini produced a well-structured proposal whose
third decision read:

> a custom ESLint plugin tailored for Playwright rules (disallowing `page.waitForTimeout`,
> forcing semantic locators `getByRole`/`getByTestId`, and enforcing teardown hooks)

Banning `waitForTimeout` is right and is implemented. Forcing `getByRole`/`getByTestId`
is wrong here in two independent ways.

**Caught by:** grepping the app before implementing the rule.

```bash
grep -rn "data-testid" react-redux-realworld-example-app/src/ | wc -l
# 0
```

Zero test ids, and modifying the app under test is out of scope. Reading
`src/components/Login.js` showed the second problem: the form's inputs have no `id`, no
`name`, and no `<label>` — only `placeholder` and Bootstrap classes, so `getByLabel`
matches nothing and `getByTestId` has nothing to find. A rule forcing those two locator
strategies would have made the login page untestable.

(The reasoning about `getByRole` in the first version of this section was itself wrong —
see §7.)

**Correction:** the rule is not "only these locator types." It is
`no-locators-outside-page-objects` — locators of any kind are a lint error outside
`src/pages/`, where a curated selector verified against the real DOM lives.

---

### 3. Gemini proposed generating tests from the OpenAPI spec

> Test Creation: Feed the OpenAPI specification / Swagger schema to the agent to generate
> contract-compliant API tests and POM methods.

A spec does exist, at `realworld/api/swagger.json`, which makes this worse rather than
better — the trap is baited.

**Caught by:** issuing the requests against the running app instead of reading the spec.

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -X POST \
  http://localhost:3000/api/users -H 'Content-Type: application/json' \
  -d '{"user":{"username":"a","email":"dup@t.com","password":"pass1234"}}'
# first call:  200 application/json      ← spec says 201
# second call: 404 text/html             ← spec says 422 application/json
```

The spec documents `POST /users` as returning `201` or `422`. The app returns `200` on
success and, on a duplicate email, `404` with a `text/html` body reading
`error: 404 Not Found /api/users` — because `routes/api/users.js` catches the save error
and calls `next()` with no argument, so it falls through to the generic 404 handler in
`app.js`.

Generating from the spec produces a registration test that is wrong twice over, and it
fails in a way that invites "fixing" the test toward the spec rather than recording
reality.

**Correction:** D-002. Schemas encode observed behaviour; `no-raw-http-outside-api-client`
forces new endpoints through the client, where writing a schema means looking at a real
response.

---

### 4. Gemini cited a configuration file that does not exist

> an explicit repository context configuration (e.g. `.cursorrules` or `.clauderc`)

`.clauderc` is not a thing. Claude Code reads `CLAUDE.md`; `AGENTS.md` is the emerging
cross-tool convention; `.cursorrules` is legacy Cursor, superseded by `.cursor/rules/*.mdc`.

**Caught by:** knowing the tool. Worth recording because it is the same failure class as
a hallucinated selector — a confident, well-formed reference to something that does not
exist — arriving inside otherwise sound advice, which is where it is hardest to notice.

---

### 5. Gemini supplied a fabricated statistic

> UI-based test setup adds friction and increases execution time by up to 80%.

Directionally true, numerically invented. The API-first setup decision stands on its own;
the number was cut rather than cited, because an unsourced figure in an architecture
document is a liability the moment someone asks where it came from.

---

### 6. The tag assertion the probe prevented (PR2)

Writing the article suite, the obvious test for creating an article with tags is:

```ts
const created = await api.createArticle(token, input);
expect(created.tagList).toEqual(input.tagList); // ← what the spec implies
```

Before writing it, the endpoint was probed five times:

```
run 1: create=[]  get=['alpha…', 'beta…']
run 2: create=[]  get=['alpha…', 'beta…']
run 3: create=[]  get=['alpha…', 'beta…']
```

The create response **never** echoes tags. `setArticleTags` in
`routes/api/articles.js:5` does not return its inner `Tag.findAll(...).then(...)` chain,
so `Promise.all` resolves and the article is serialised before the association is written.

This is recorded not because an AI got it wrong, but because it is the case the process
was designed to catch: a plausible, spec-endorsed assertion that fails against the real
app. Had it been written from the spec and then seen to fail, the tempting fix would have
been to loosen the assertion or add a wait — treating a deterministic app behaviour as
flake. Probing first meant the deviation was documented (`ART-P1-01`,
`docs/DEVIATIONS.md`) instead of papered over.

Every test written this way passed on its first run, which is the intended consequence of
observing before asserting rather than a sign that the tests are weak.

A related correction, on the same branch and worth recording because it is a judgement
error rather than a factual one: the first revision of this suite had **seventeen** tests.
They passed and they were fast, and they were still the wrong deliverable — the brief asks
for three to five tests covering critical flows, puts full coverage out of scope, and says
depth over breadth. Producing more tests because the framework made them cheap to write is
exactly the failure mode a capable code generator encourages. Trimmed to four, with the
reasoning recorded as D-004.

---

### 7. Claude reasoned from a specification to a library's behaviour, and was wrong (PR3)

The most instructive error in this repository, because the framework exists to prevent
exactly this class of mistake and its author committed it anyway.

While writing the guardrail rule in PR1, Claude asserted — confidently, and with correct
supporting reasoning — that:

> `getByRole('textbox')` cannot find a password field: `input[type=password]` has **no
> implicit ARIA role**, so it never matches, while the `type=email` field _does_ map to
> `textbox`. This fails asymmetrically.

The premise is true. [HTML-AAM][htmlaam] does specify **no corresponding role** for
`input[type=password]`. The conclusion about Playwright is false. That claim was written
into `CLAUDE.md`, `README.md`, `AI_USAGE.md`, and the rule's own doc comment, and shipped
in PR1.

**Caught by:** running every candidate locator against the live page before writing the
first page object.

```
OK   count=1  getByRole('textbox', {name:'Email'})
OK   count=1  getByRole('textbox', {name:'Password'})     ← claim said 0
BAD  count=2  getByRole('textbox')  [all]
BAD  count=0  getByLabel('Password')
BAD  count=0  getByLabel('Email')
OK   count=1  getByPlaceholder('Password')
BAD  count=2  locator('.form-control')
OK   count=1  getByRole('button', {name:'Sign in'})
```

Chromium's accessibility tree exposes password inputs as textboxes and derives the
accessible name from the `placeholder`, and Playwright's role engine follows Chromium
rather than HTML-AAM. Half the original claim held up — `getByLabel` really does match
nothing — and the half that did not was the more specific, more confident half.

**Corrected everywhere it appeared.** Page objects use `getByPlaceholder` for inputs: not
because `getByRole` fails, but because it is explicit about what the selector is really
coupled to and does not depend on a role mapping the spec says should not exist.

**Why it belongs at the top of this file.** The whole framework rests on one rule — _do
not reason from a specification to what the running system does; go and observe it_. That
rule was written for the RealWorld swagger file. It applies just as well to the ARIA spec,
to Playwright's documentation, and to a model's confident recollection of either. A
guardrail catches an agent's bad selector; nothing but running the thing catches a
plausible, well-argued, false premise in the prose that justifies the guardrail.

[htmlaam]: https://www.w3.org/TR/html-aam-1.0/

---

### 8. Two things that only worked because they were run (PR4)

Neither of these is a dramatic failure; both are cases where a plausible artifact would
have shipped broken had it not been executed once.

**The hook's formatter did not exist.** `.claude/hooks/lint-changed.mjs` was written with
`eslint --format compact`, which is correct for ESLint 8 and removed from core in ESLint 9.
The hook still exited 2, so it _looked_ like it was working — it was reporting a formatter
error as if it were a lint violation:

```
Guardrails rejected tests/api/hook-probe.spec.ts:
The compact formatter is no longer part of core ESLint.
```

A hook that always fires looks identical to a hook that works, right up until it lets a
real violation through. Caught by piping a deliberately bad file's path into the hook and
reading what came back, rather than assuming exit code 2 meant success.

**The scaffolder generated tests that failed the build.** The template put `[TODO-P0-01]`
in the test title as a placeholder. That string matches the scenario ID pattern, so
`scenarios:coverage` correctly flagged every freshly generated file as claiming an ID no
design defines — making the generator's whole purpose, _produce something that is green
before you edit it_, false on first use. Changed to `REPLACE-WITH-SCENARIO-ID`, which
cannot parse as an ID. Verified by generating a file and running it: green in 676ms,
untouched.

The pattern in both: the artifact was well-formed, the reasoning behind it was sound, and
one execution disproved it. Same lesson as §7, arrived at twice more.

---

### 9. The docs check found a broken link on its first run

Added late, after an independent review pointed out that an early stated goal — "commands
named in documentation must exist" — had never been built.

Its first execution failed, and not on the case it was written for:

```
.claude/agents/test-reviewer.md
  links to ../../../docs/DEVIATIONS.md, which does not exist
```

Subagents live at `.claude/agents/<name>.md` and skills at
`.claude/skills/<name>/SKILL.md` — one directory level apart. The skills' `../../../docs/`
was pasted into an agent file, where it climbs past the repository root. That link had been
broken since the day the reviewer agent was written, and it survived several human reads of
the file, because a relative path with the wrong number of `../` looks exactly like one with
the right number.

It also flagged `npm run build` and `npm run front` in `APP_SETUP.md` — a genuine false
positive, since those are the _app's_ scripts, not ours. Fixed by naming that file as
documenting a foreign manifest rather than by loosening the check.

The lesson is the one this repository keeps relearning: a claim nobody executes is a claim
nobody has checked. Prose was the last category still relying on careful reading, and
careful reading is exactly what missed this.

---

## Where AI was used successfully

**Environment archaeology.** Getting the app running took four discoveries — an empty git
submodule, `sqlite3@5.0.2` with no working arm64 build, `node-sass@5` likewise, and the
observation that `node-sass` is skippable because the app's only SCSS import is commented
out at `src/index.js:12`. Claude worked through these by running commands and reading
errors. The result is `docs/APP_SETUP.md`, which is more useful than the app's own README.

**Reading the app to find real test targets.** The `bio` / `image` inconsistency —
register returns `""`, login returns `null` for the same field — was found by diffing two
live responses, then explained by reading `models/user.js:82`. It is the clearest argument
in the repository for runtime schema validation over types alone, and no amount of
reasoning about the spec would have surfaced it.

**Guardrail verification.** The rules were checked by writing a file containing every
predicted agent mistake and confirming each was rejected:

```
4:14  error  Locator `getByLabel()` is not allowed here…       guardrails/no-locators-outside-page-objects
5:14  error  Locator `locator()` is not allowed here…          guardrails/no-locators-outside-page-objects
6:21  error  Raw HTTP call `request.post` is not allowed here… guardrails/no-raw-http-outside-api-client
7:9   error  Unexpected use of page.waitForTimeout()           playwright/no-wait-for-timeout
8:3   error  Replace isVisible() with toBeVisible()            playwright/prefer-web-first-assertions
10:3  error  This assertion can never fail…                    playwright/no-unnecessary-assertions
```

The last one was not configured deliberately — `expect(locator).toBeTruthy()` always
passes, and the recommended rule set caught it. Worth noting as evidence that the
off-the-shelf half of the guardrails is pulling weight, not just the custom half.
