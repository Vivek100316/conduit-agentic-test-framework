# Test Data

The strategy in one line: **every test creates the data it needs, over the API, with a
uniqueness token, and cleans up nothing.**

## Why not reset the database

Conduit uses SQLite. Every Playwright worker talks to the same running app and therefore
the same database, so the alternatives to uniqueness are all worse:

- **Truncating between tests** serialises the suite — no two tests can run at once.
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
