# Contributing to this repository

Playwright + TypeScript tests for the Conduit RealWorld app. Read this before writing
code; it is short on purpose.

## Before anything else

The app under test must be running. Check with:

```bash
npm run app:health
```

If it fails, it prints the exact command to start what is missing. **Do not start
modifying tests because a run is red — confirm the app is up first.** A red suite with
the app down is not a test problem.

## Two invariants

Both are enforced by lint; violating them fails the build.

1. **Locators live only in `src/pages/`.** Never write `getBy*` or `.locator(` in a test
   or fixture. Add or extend a page object and call an intent-named method
   (`loginPage.signIn(user)`), not a mechanical one (`clickSignInButton`).

2. **HTTP is spoken only in `src/api/`.** Never call `request.post(...)` or `fetch(...)`
   from a test. Add a typed method with a schema to `ConduitClient`.

## Never trust the spec

`realworld/api/swagger.json` in the app repo describes the canonical RealWorld API, not
this fork, and they disagree — registration returns `200` not `201`, a duplicate email
returns `404 text/html` not `422 JSON`, and `bio` is `""` from register but `null` from
login.

**Issue the request against the running app and assert what it actually does.** If you
find a new deviation, assert reality, comment the cause with a file and line from the app,
and add a `DECISIONS.md` entry. Never loosen a schema to make a failure go away without
first checking whether the app changed.

## Locators, specifically

The app has **zero** `data-testid` attributes and cannot be modified. Form inputs have no
`id`, no `name`, and no `<label>` — only `placeholder` and Bootstrap classes. So:

- `getByLabel(...)` matches nothing anywhere in this app.
- `getByRole('textbox')` cannot find a password field — `input[type=password]` has no
  implicit ARIA role. The email field does map to `textbox`, so this fails asymmetrically.
- `.locator('.form-control')` is ambiguous — two matches on login, four in the editor.

Derive selectors from the running DOM or the component source, never from memory of what
a login form usually looks like.

## Test data

Every test builds its own data with a factory. No shared accounts, no database reset, no
teardown. Do not add cleanup hooks.

Never assert absolute counts on the tag sidebar or Global Feed — they are shared across
every test in the run. Assert relatively: "my article is present", not "there are 3".

## Definition of done

```bash
npm run verify
```

Typecheck, lint, API suite. Run it before every push and paste the output into the pull
request. Update any documentation the change invalidates in the same commit.

## Reference

- [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) — naming, assertions,
  polling, structure. The single source of truth; not duplicated elsewhere.
- [DECISIONS.md](DECISIONS.md) — why the framework is shaped this way, and what would
  change it.
- [docs/APP_SETUP.md](docs/APP_SETUP.md) — running the app under test.
