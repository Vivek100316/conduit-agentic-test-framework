# Engineering Standards

The single source of truth for how code is written in this repository. Every skill,
subagent, and human contributor follows this file. Nothing here is repeated inside
individual skills — they link here instead, so there is exactly one copy to keep current.

**Baselines.** We adopt the [Google TypeScript Style Guide][gts] for language-level
conventions and the [Playwright Best Practices][pwbp] for test-level conventions. This
document records only where we extend or narrow them. If something is not mentioned
here, the upstream guide applies.

[gts]: https://google.github.io/styleguide/tsguide.html
[pwbp]: https://playwright.dev/docs/best-practices

## The enforcement rule

A standard that a machine can check is a lint rule, not a paragraph. Prose is reserved
for judgement calls that tooling genuinely cannot decide.

| Enforced automatically                                      | Documented here only                             |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Naming conventions (`@typescript-eslint/naming-convention`) | What makes a good test title                     |
| Formatting (Prettier, `npm run format:check`)               | When to extend a page object vs. add one         |
| No `waitForTimeout`, no manual polling loops                | Assertion granularity                            |
| No locators outside page objects                            | Scenario priority assignment                     |
| No floating promises, no non-null `!` in tests              | When a deviation is a bug vs. a documented quirk |
| File and directory naming                                   |                                                  |

Run `npm run verify` before every push. It is the definition of done: typecheck, lint,
docs check, and the affected test suites.

## Formatting

**Prettier owns formatting. Do not hand-format, and do not argue with it.**

```bash
npm run format        # rewrite
npm run format:check  # verify — part of npm run verify
```

Configuration lives in `.prettierrc.json`: 100-column lines, single quotes, semicolons,
ES5 trailing commas. The values matter far less than the fact that nobody has to think
about them.

`eslint-config-prettier` is applied last in `eslint.config.js`, which disables every ESLint
rule that overlaps with Prettier. ESLint judges correctness; Prettier decides appearance. A
repository where the two disagree teaches contributors to ignore both.

The `PostToolUse` hook checks formatting alongside lint on every edit, so an unformatted
file is reported immediately with the command that fixes it.

## Naming

Follows Google TS Style Guide. The rules people get wrong most often:

| Construct                            | Case                                     | Example                         |
| ------------------------------------ | ---------------------------------------- | ------------------------------- |
| Class, interface, type, enum         | `UpperCamelCase`                         | `ArticlePage`, `ArticlePayload` |
| Method, function, variable, property | `lowerCamelCase`                         | `createArticle`, `authToken`    |
| Module-level constant                | `CONSTANT_CASE`                          | `DEFAULT_TIMEOUT_MS`            |
| File — page object                   | `kebab-case.page.ts`                     | `article-editor.page.ts`        |
| File — test spec                     | `kebab-case.spec.ts`                     | `article-lifecycle.spec.ts`     |
| File — factory / fixture / schema    | `kebab-case.{factory,fixture,schema}.ts` | `user.factory.ts`               |

Interfaces are **not** prefixed with `I`. Private members use the `private` keyword, not
a leading underscore. Both are explicit prohibitions in the Google guide and both are
common AI output, so both are linted.

Method names on page objects describe **user intent**, not mechanics:
`articleEditor.publish()`, not `articleEditor.clickPublishButton()`. The distinction
matters because intent survives a redesign and mechanics do not.

Test titles state the observable outcome in the present tense, without "should":

```
✅ test('rejects login with an unregistered email', ...)
❌ test('should test login functionality', ...)
```

## Locators

Locators live only in `src/pages/`. Within that, follow Playwright's own
[locator priority](https://playwright.dev/docs/locators):

`getByRole` → `getByText` → `getByLabel` → `getByPlaceholder` → `getByAltText` →
`getByTitle` → `getByTestId` → semantic CSS → XPath.

XPath is **last, not banned**. It is legitimate where nothing above reaches — axis
traversal to an ancestor or sibling that carries no usable attribute — and when used it
needs a comment saying what was tried first. Treat reaching for it as the strongest
argument for asking the app's owners for a `data-testid`.

Verify counts against the running app before committing a locator. On the screens modelled
so far, `getByLabel` and `getByTestId` match nothing, so `getByRole` with a name and
`getByPlaceholder` do the work — an observation about specific components at one commit,
not a rule about the app.

### Scoping, and dynamic values

Uniqueness normally comes from **narrowing**, not from a longer selector:

```ts
✅ page.getByRole('navigation').getByRole('link', { name: 'Settings' });
✅ page.locator('.article-preview').filter({ hasText: title });
❌ page.locator('nav > ul > li:nth-child(3) > a');
```

Dynamic values are **parameters**, not new locators. A page object exposes a method that
takes the value and returns a `Locator`:

```ts
✅ articleCard(title: string): Locator
❌ thirdArticleCard: Locator
```

A bare `.nth(n)` is acceptable only when order is the thing under test — "the first article
in the feed" — and the test should say so.

## Assertions

**Always use web-first assertions.** They retry until the timeout; the manual form
evaluates once and is the single largest source of flake in Playwright suites.

```ts
✅ await expect(page.getByRole('button', { name: 'Publish Article' })).toBeVisible();
❌ expect(await page.getByRole('button').isVisible()).toBe(true);
```

Assert on state the user can observe, not on implementation detail — visible text and
control state rather than CSS classes or Redux internals.

Use `expect.soft` only for genuinely independent checks where continuing yields more
information. If a failed check makes later checks meaningless, use a hard assertion.

**Assert relatively, never on global counts.** Conduit's tag sidebar and Global Feed are
shared across every test in the run, so absolute counts are inherently racy:

```ts
✅ await expect(feed.articleTitled(article.title)).toBeVisible();
❌ await expect(feed.articles).toHaveCount(3);
```

## Waiting and polling

In strict order of preference. Reach for a lower row only when every row above is
genuinely inapplicable.

| Preference | Mechanism                                     | Use for                                           |
| ---------- | --------------------------------------------- | ------------------------------------------------- |
| 1          | Auto-retrying `expect(locator)`               | Anything observable in the DOM                    |
| 2          | `expect.poll(fn)`                             | Non-locator values, e.g. an API read-back         |
| 3          | `expect(fn).toPass()`                         | A block of assertions that should eventually hold |
| 4          | `waitForResponse` / `waitForURL`              | A specific network or navigation event            |
| ✗          | `waitForTimeout`, `setTimeout`, `while` loops | Never. Lint error.                                |

There is no legitimate use of a fixed sleep in this repository. If one appears to be
needed, the real problem is a missing observable signal — find it, or add a
`waitForResponse` on the request that actually gates the behaviour.

## Project structure

```
src/
  api/         Typed API client and runtime schemas — the only place HTTP is spoken
  pages/       Page objects — the only place locators may appear
  factories/   Test data builders producing unique-per-test data
  fixtures/    Playwright fixtures composed via test.extend
  config/      Environment loading and validation
tests/
  api/         API specs
  ui/          UI specs
tools/         Generators and repository checks
eslint-rules/  Custom guardrail rules
docs/
  scenarios/   Generated scenario designs, one file per feature
```

The two structural invariants the whole design rests on:

- **Locators live only in `src/pages/`.** A `getBy*` or `.locator(` under `tests/` is a
  lint error. The app has zero `data-testid` attributes and modifying it is out of
  scope, so selectors are a scarce, curated resource — not something to improvise
  per test.
- **HTTP lives only in `src/api/`.** A raw `request.post(...)` inside a spec is a lint
  error. Every endpoint has exactly one typed method with one schema.

## Test design

Prefer the lowest layer that can prove the behaviour. If a rule is enforced by the API,
test it in `tests/api/`; use `tests/ui/` when the user-visible journey is the thing
under test. A UI test that exists only to re-prove an API rule is duplicated cost.

Set up preconditions through the API, never through the UI. UI setup is slow, and it
couples a test's reliability to screens it is not trying to test.

Every test creates its own data through a factory. There is no shared fixture user, no
database reset, and no teardown — isolation comes from uniqueness, which is
parallel-safe and cannot fail halfway.

## API contract rule

`realworld/api/swagger.json` describes the canonical RealWorld API, **not** this fork.
Verified deviations exist: registration returns `200` where the spec says `201`, and a
duplicate email returns `404 text/html` where the spec says `422 JSON`.

Therefore: **observe the endpoint against the running app before writing the
assertion.** Schemas in `src/api/` encode what the server actually does. Every
deviation gets a comment linking to the route source and an entry in `DECISIONS.md`.
Never generate an assertion from the spec.

---

## Test data

The strategy in one line: **every test creates the data it needs, over the API, with a
uniqueness token, and cleans up nothing.**

### Why not reset the database

**The suite runs fully parallel** — `fullyParallel: true` in `playwright.config.ts`, five
workers on this machine, six tests in about 1.6 seconds. Everything below is the reasoning
for _why that is possible_, by listing what was rejected in order to get it.

Conduit uses SQLite. Every worker talks to the same running app and therefore the same
database, so the alternatives to uniqueness would each cost the parallelism:

- **Truncating between tests** would serialise the suite. If test A wipes the database
  while test B is mid-flight, B fails through no fault of its own — so truncation forces
  `workers: 1`. This is the reason it was rejected, not a property of the suite as built.
- **Restoring a snapshot file** does the same, and races with an app holding the file open.
- **Teardown hooks** are the subtlest trap. Cleanup that fails halfway leaves the database
  in a state nobody designed, and the failure surfaces in whichever unlucky test runs next
  rather than in the one that caused it. Cleanup code is also untested code running in the
  most safety-critical position in the suite.

Uniqueness sidesteps all of it. Two tests creating "a user" create genuinely different
users, so they cannot interfere, and there is nothing to undo. The cost is rows left
behind, which for a local SQLite app is not a cost — under `NODE_ENV=test` the database is
`:memory:` and disappears with the process; otherwise deleting `db.sqlite3` and restarting
the app resets everything.

### "No teardown" means data, not resources

Two different things get called cleanup, and only one of them is skipped here.

**Resources are released after every test, automatically.** Playwright owns the lifecycle
of the `page`, the `BrowserContext`, and the `APIRequestContext` behind the `request`
fixture; each is disposed when the test that used it finishes, and the browser is closed
when the run ends. Fixtures with a body after `await use(...)` release in reverse order of
setup. This repository opens no sockets, files, or database handles of its own —
`ConduitClient` is a thin wrapper over Playwright's `request`, and nothing talks to SQLite
directly — so there is nothing left to close by hand. Adding manual disposal would risk
double-closing something Playwright already owns.

**Data is deliberately left behind.** That is the choice described above: rows persist,
and the next test does not care because it works with its own.

So "do not add teardown hooks" means _do not delete the data you created_. It has never
meant leaking connections. If you ever add something that genuinely holds a resource — a
raw socket, a file handle, a WebSocket — release it in the fixture that created it, after
`use`.

### The two rules

**1. Factories generate valid data. Tests supply asserted data.**

A factory's job is to satisfy the app's constraints — unique username, non-empty body —
not to decide what a test is about. Anything a test asserts on is passed explicitly:

```ts
const input = buildArticle({ body: 'Published through the editor.' });
...
await expect(articlePage.body()).toContainText('Published through the editor.');
```

The assertion and the value that satisfies it are visible in the same file. The earlier
version of these factories used faker for prose, which meant a test asserting on body text
depended on generated content — reproducible in principle, unreadable in practice.

**2. Preconditions are created over the API, never through the UI.**

`registeredUser`, `otherUser`, and `authoredArticle` are all API calls. Driving the UI to
set up a test couples its reliability to screens it is not trying to test, and it is
roughly an order of magnitude slower.

### What is unique, and what is not

`unique()` returns a base-36 timestamp plus a random suffix — ordered enough to read in a
database row, random enough for workers starting in the same millisecond.

| Field                 | Unique     | Why                                                                          |
| --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `username`, `email`   | Yes        | Enforced unique by the app                                                   |
| Article `title`       | Yes        | Lets a feed or search assertion find exactly one article                     |
| Tag names             | Yes        | **The tag list is global.** A fixed tag would be visible to every other test |
| `password`            | No         | Constant and readable; nothing asserts on it                                 |
| `description`, `body` | Token only | Dull on purpose — see rule 1                                                 |

### The limit of this approach

Uniqueness isolates _records_, not _aggregates_. Conduit's tag sidebar and Global Feed are
shared by every test in a run, so an absolute count against them is racy by construction:

```ts
✅ await expect(feed.articleTitled(article.title)).toBeVisible();
❌ await expect(feed.articles).toHaveCount(3);
```

This is a convention, not something the linter can catch, which is why it appears in
[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) and in `CLAUDE.md`. If a scenario
genuinely needs deterministic global state — asserting on pagination totals, say — that is
the constraint that would flip D-003 toward per-run database isolation.

### Extending

New entity: add `src/factories/<entity>.factory.ts` following the two rules, and expose it
as a fixture only if more than one test needs it. A fixture that one test uses is
indirection, not abstraction.

Edge-case data — unicode titles, maximum-length bodies, injection strings — belongs in
named overrides at the call site rather than in new factories, so the test says what it is
probing:

```ts
const input = buildArticle({ title: `Ünïcôdé ${unique()}` });
```
