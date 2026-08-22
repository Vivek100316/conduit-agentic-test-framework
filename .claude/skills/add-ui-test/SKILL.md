---
name: add-ui-test
description: Add a UI test to this framework. Use when asked to cover a screen, a user journey, or browser-visible behaviour in the Conduit app.
---

# Add a UI test

Follow [Engineering Standards](../../../docs/ENGINEERING_STANDARDS.md) and
[Test Data](../../../docs/TEST_DATA.md).

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

## 3. Never put a locator in a test

Locators outside `src/pages/` are a lint error, and the lint runs automatically the moment
you save the file.

Reuse a page object if one fits. Otherwise:

```bash
npm run new:page -- <Name>
```

## 4. Derive selectors from the running DOM, not from memory

This app has **zero** `data-testid` attributes and cannot be modified. Its form inputs have
no `id`, no `name`, and no `<label>`. Verified counts on the login form:

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

## 5. Seed state over the API

Use `authenticatedPage`, which registers a fresh user over the API and injects the JWT into
`localStorage`. Do not sign in through the form to reach some other screen — signing in is
proved once, by `UI-P0-01`, and re-proving it only adds ways to fail.

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
