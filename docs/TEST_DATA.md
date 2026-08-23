# Test Data

The strategy in one line: **every test creates the data it needs, over the API, with a
uniqueness token, and cleans up nothing.**

## Why not reset the database

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

## "No teardown" means data, not resources

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

## The two rules

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

## What is unique, and what is not

`unique()` returns a base-36 timestamp plus a random suffix — ordered enough to read in a
database row, random enough for workers starting in the same millisecond.

| Field                 | Unique     | Why                                                                          |
| --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `username`, `email`   | Yes        | Enforced unique by the app                                                   |
| Article `title`       | Yes        | Lets a feed or search assertion find exactly one article                     |
| Tag names             | Yes        | **The tag list is global.** A fixed tag would be visible to every other test |
| `password`            | No         | Constant and readable; nothing asserts on it                                 |
| `description`, `body` | Token only | Dull on purpose — see rule 1                                                 |

## The limit of this approach

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

## Extending

New entity: add `src/factories/<entity>.factory.ts` following the two rules, and expose it
as a fixture only if more than one test needs it. A fixture that one test uses is
indirection, not abstraction.

Edge-case data — unicode titles, maximum-length bodies, injection strings — belongs in
named overrides at the call site rather than in new factories, so the test says what it is
probing:

```ts
const input = buildArticle({ title: `Ünïcôdé ${unique()}` });
```
