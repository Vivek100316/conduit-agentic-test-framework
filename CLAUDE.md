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

**Issue the request against the running app and assert what it actually does.**
[docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md) catalogues every deviation found so far,
with the route file and line that causes each one — read it before writing an API test.

Two that bite immediately: error responses are **not JSON** (403 is `text/plain`, 401 is
`text/html`), which is why every negative path uses a `*Raw` client method; and
`POST /articles` never echoes the tags you sent, though a subsequent read does.

If you find a new deviation, assert reality, comment the cause with a file and line from
the app, and add a row to `docs/API_DEVIATIONS.md`. Never loosen a schema to make a
failure go away without first checking whether the app changed.

## Locators, specifically

The app has **zero** `data-testid` attributes and cannot be modified. Form inputs have no
`id`, no `name`, and no `<label>` — only `placeholder` and Bootstrap classes. So:

- `getByLabel(...)` matches nothing anywhere in this app. Verified: 0 hits for both
  `getByLabel('Email')` and `getByLabel('Password')`.
- `getByRole('textbox')` unqualified is ambiguous — 2 matches on the login form. Qualified
  with a name it works, including for the password field, because Chromium exposes
  password inputs as textboxes and derives the accessible name from the placeholder.
- `.locator('.form-control')` is ambiguous — two matches on login, four in the editor.

Page objects use `getByPlaceholder` for inputs. It is explicit about what the selector is
actually coupled to, and it does not lean on a role mapping the HTML-AAM spec says should
not exist.

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
- [docs/API_DEVIATIONS.md](docs/API_DEVIATIONS.md) — where the app disagrees with the
  spec, and why.
- [DECISIONS.md](DECISIONS.md) — why the framework is shaped this way, and what would
  change it.
- [docs/APP_SETUP.md](docs/APP_SETUP.md) — running the app under test.
