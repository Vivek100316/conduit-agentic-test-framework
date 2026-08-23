# AGENTS.md

Conventions for AI coding agents contributing to this repository. This file is the
cross-tool entry point; [CLAUDE.md](CLAUDE.md) holds the same guidance and is what Claude
Code loads automatically. **They are kept identical in substance — if you change one,
change the other.**

## Before anything else

```bash
npm run app:health
```

The app under test is a separate process and must be running. If this fails it prints the
command to start what is missing. **A red suite with the app down is not a test problem —
do not start editing tests.**

## Two invariants, both enforced by lint

1. **Locators live only in `src/pages/`.** Never `getBy*` or `.locator(` in a test or
   fixture. Extend a page object and call an intent-named method.
2. **HTTP is spoken only in `src/api/`.** Never `request.post(...)` or `fetch(...)` from a
   test. Add a typed method with a schema to `ConduitClient`.

A `PostToolUse` hook lints every TypeScript file the moment it is written, so violations
come back immediately rather than at commit time.

## Never trust the spec

`realworld/api/swagger.json` describes the canonical RealWorld API, not this fork. They
disagree: registration returns `200` not `201`, a duplicate email returns `404 text/html`
not `422 JSON`, `bio` is `""` from register but `null` from login, and `POST /articles`
never echoes the tags it was sent.

Issue the request against the running app and assert what it does.
[docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md) catalogues every deviation with the route
file and line responsible.

## Locators, specifically

Zero `data-testid` attributes; inputs have no `id`, `name`, or `<label>`. Verified counts
on the login form:

```
count=0  getByLabel('Password')       count=2  getByRole('textbox')
count=2  locator('.form-control')     count=1  getByPlaceholder('Password')
```

Derive selectors from the running DOM, never from memory. The `selector-scout` subagent
does this and reports verified counts.

## Test data

Every test builds its own data with a factory. No shared accounts, no database reset, no
teardown. Never assert absolute counts against the tag sidebar or Global Feed — they are
shared by every test in the run. See [docs/TEST_DATA.md](docs/TEST_DATA.md).

## Definition of done

```bash
npm run verify
```

Typecheck, lint, scenario coverage, both suites. Run it before every push and update any
documentation the change invalidates in the same commit.

## Available skills and subagents

| Name               | Use for                                    |
| ------------------ | ------------------------------------------ |
| `add-api-test`     | Covering an endpoint                       |
| `add-ui-test`      | Covering a screen or journey               |
| `design-scenarios` | Planning coverage for a feature            |
| `triage-failure`   | A red test — **before** changing anything  |
| `selector-scout`   | Verified locators for an unmodelled screen |
| `test-reviewer`    | Reviewing a test before a pull request     |

## Reference

- [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) — naming, assertions,
  polling, structure
- [docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md) — where the app disagrees with the spec
- [docs/DEVIATION_POLICY.md](docs/DEVIATION_POLICY.md) — what to do when the app and
  its spec disagree. **Escalate; never decide alone.**
- [docs/TEST_DATA.md](docs/TEST_DATA.md) — data strategy
- [DECISIONS.md](DECISIONS.md) — architecture decisions and what would change them
- [docs/APP_SETUP.md](docs/APP_SETUP.md) — running the app under test
