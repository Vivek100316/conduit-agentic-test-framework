---
name: add-ui-test
description: Add a UI test to this framework. Use when asked to cover a screen, a user journey, or browser-visible behaviour in the Conduit app.
---

# Add a UI test

Follow [Engineering Standards](../../../docs/ENGINEERING_STANDARDS.md) and
[Test Data](../../../docs/ENGINEERING_STANDARDS.md#test-data).

## 1. Ask whether this belongs in the UI at all

Prefer the lowest layer that can prove the behaviour. If the rule is enforced by the API,
test it in `tests/api/` — a UI test that re-proves an API rule costs browser startup and
buys nothing.

Write a UI test when the browser is genuinely the subject: rendering, a user journey,
client-side routing, session persistence, or a control's state.

## 2. Confirm the app is running, and claim a scenario

```bash
npm run app:health
```

Put the scenario ID from `docs/scenarios/` in the test title: `[UI-P1-01]`.

Read the **UI deviations** section of [DEVIATIONS.md](../../../docs/DEVIATIONS.md) before
you write the assertion. The UI departs from ordinary web convention in several places, and
they are the kind of thing you would otherwise mistake for your own bug: Enter does not
submit the editor form, a tag typed without pressing Enter is silently discarded, and an
article's URL keeps its old slug after a rename.

If you find a **new** UI deviation — an action with no feedback, a control that does not do
what its label implies, state lost without warning — the same rule applies as for the API:
reproduce it, find the cause in the component source, propose a classification, and **ask**.
Do not encode it as expected behaviour on your own authority. See § Policy.

## 3. Never put a locator in a test

Two mechanisms enforce this, and it is worth knowing they are separate things:

- **The rule.** `eslint-rules/no-locators-outside-page-objects.js` is a custom ESLint rule
  that reports any `getBy*` or `.locator(` in a file outside `src/pages/`. It fails
  `npm run lint`, and therefore `npm run verify`.
- **The moment you hear about it.** `.claude/hooks/lint-changed.mjs` is a Claude Code
  `PostToolUse` hook, registered in `.claude/settings.json`. It runs ESLint and Prettier
  against a file as soon as a `Write` or `Edit` touches it, and exits with code `2` so the
  message comes back as feedback to act on.

The rule alone would catch the violation at commit time, by which point you have moved on.
The hook is what makes the correction arrive in the same train of thought. If you are
working outside Claude Code, only the rule applies — run `npm run lint` yourself.

Reuse a page object if one fits. Otherwise:

```bash
npm run new:page -- <Name>
```

## 4. Derive selectors from the running DOM, not from memory

Follow Playwright's [locator priority](https://playwright.dev/docs/locators): `getByRole`,
`getByText`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByTestId`.
Below those: semantic CSS (`.error-messages`, `.article-content`), then XPath as a **last
resort** — legitimate for axis traversal nothing else reaches, but it needs a comment
saying why, and it is the strongest case for asking the app's owners for a test id.

**Scope rather than out-clever.** Most screens are lists of similar things, so uniqueness
normally comes from narrowing, not from a longer selector:

```ts
page.getByRole('navigation').getByRole('link', { name: 'Settings' }); // parent → child
page.locator('.article-preview').filter({ hasText: title }); // pick one of many
```

**Dynamic values are parameters, not new locators.** Expose a method that takes the value
and returns a `Locator` — `articleCard(title)` — rather than a field per instance.
`ArticlePage.tag(name)` is the existing example. Avoid a bare `.nth(n)` unless order is
genuinely what the test is about, and say so when it is.

The screens modelled so far have no `data-testid` attributes, and their form inputs have no
`id`, `name`, or `<label>` — so `getByLabel` and `getByTestId` find nothing on them, and
`getByRole` with a name or `getByPlaceholder` does the work. **That is an observation about
particular screens at a particular commit, not a property of the app.** A screen nobody has
modelled yet may be entirely different, and if test ids are ever added they become the
preferred option. Check; do not inherit the conclusion.

Counts measured on the login form, as calibration for what checking looks like:

```
count=0  getByLabel('Password')            ← no labels exist anywhere
count=2  getByRole('textbox')              ← ambiguous, strict-mode violation
count=2  locator('.form-control')          ← ambiguous
count=1  getByPlaceholder('Password')      ← use this
count=1  getByRole('button', {name:'Sign in'})
```

Anchor inputs on `getByPlaceholder`, and buttons and links on their accessible name. For a
screen not yet modelled, delegate to the **selector-scout** subagent, which inspects the
live DOM rather than guessing.

Page object methods are named for intent: `editor.publish(article)`, not
`editor.clickPublishButton()`. Intent survives a redesign; mechanics do not.

## 5. Seed state over the API, with the session the test actually needs

`authenticatedPage` is a **convenience for the common case** — a page signed in as some
ordinary user. It is not the mechanism, and it is not mandatory.

The mechanism is `signInAs(page, user)` in `src/fixtures/session.ts`, which establishes a
session for **whichever** user you hand it. Reach for it directly whenever "some ordinary
user" is not what the test is about:

```ts
const author = await api.register(buildUser());
const reader = await api.register(buildUser());
await signInAs(page, reader); // …then assert what a reader sees of author's article
```

Conduit has no roles today, so nothing here needs more than one session. When admin, guest,
or moderator views appear, they compose the same way — build the user over the API, hand it
to `signInAs`. `signOut(page)` is the deliberate opposite for anonymous-visitor tests.

Both must be called **before the first navigation**: they use `addInitScript`, which runs
before page scripts on each navigation, so calling either after `goto` leaves the loaded
app unaware.

Do not sign in through the form to reach some other screen. Signing in is proved once, by
`UI-P0-01`, and re-proving it only adds ways to fail.

## 6. Assert on what a user can observe

Use auto-retrying web-first assertions. They wait; you do not.

```ts
✅ await expect(articlePage.title()).toHaveText(input.title);
❌ expect(await articlePage.title().textContent()).toBe(input.title);
```

`waitForTimeout` is a lint error and there is no legitimate use of it here. If a wait looks
necessary, the real problem is a missing observable signal — find it, or wait on the
request that gates the behaviour.

**Never assert absolute counts** on the tag sidebar or the Global Feed. They are shared by
every test in the run. Assert relatively: "my article is present", never "there are three".

## 7. Verify

```bash
npm run verify
```
