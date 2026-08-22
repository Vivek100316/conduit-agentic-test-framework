---
name: add-api-test
description: Add an API test to this framework. Use when asked to cover an endpoint, extend API coverage, or test backend behaviour for the Conduit app.
---

# Add an API test

Follow [Engineering Standards](../../../docs/ENGINEERING_STANDARDS.md) and
[Test Data](../../../docs/TEST_DATA.md).

## 1. Confirm the app is running

```bash
npm run app:health
```

If it fails, it prints the command to start what is missing. **Do not start editing tests
because a run is red.** A red suite with the app down is not a test problem.

## 2. Claim a scenario

Find the scenario in `docs/scenarios/`. Its ID goes in the test title, in brackets:
`[ART-P0-02]`. `npm run scenarios:coverage` fails on an ID no design defines, so an
invented one will be rejected.

If no scenario covers what you were asked to test, run the `design-scenarios` skill first.
A test without a designed scenario is a test nobody decided was worth writing.

## 3. Observe the endpoint before asserting on it

**This is the step that matters.** Read [API_DEVIATIONS.md](../../../docs/API_DEVIATIONS.md)
first, then issue the request yourself and record what actually comes back:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -X POST \
  http://localhost:3000/api/articles -H "Authorization: Token $TOKEN" \
  -H 'Content-Type: application/json' -d '{"article":{...}}'
```

Do **not** read expectations out of `realworld/api/swagger.json`. It documents the
canonical RealWorld API, not this fork, and it is wrong about registration status codes,
duplicate-email handling, and field nullability. Assertions written from it fail, and the
tempting fix — loosening the assertion — hides a real behaviour.

Watch for three things this app does that surprise people:

- Success is `200`, not `201`.
- Errors are **not JSON**: `403` is `text/plain`, `404` is `text/plain`, `401` is `text/html`.
- `POST /articles` never echoes the tags you sent; a subsequent read does.

## 4. Extend the client, not the test

Raw HTTP in a test is a lint error. Add a method to `ConduitClient` in `src/api/`:

- A typed method returning parsed data, validated by a schema in `src/api/schemas/`.
- A `*Raw` variant returning the untouched `APIResponse` — negative paths need this,
  because the error bodies are not JSON and would throw while parsing.

Write the schema from the response you observed in step 3. If a field can be `null` on one
code path and `""` on another, say so — `z.string().nullable()` — and comment why.

## 5. Write the test

```bash
npm run new:test -- api <name>
```

Use fixtures rather than setup code: `api`, `registeredUser`, `otherUser`,
`authoredArticle`. Build data with a factory, and pass anything you assert on as an
explicit override.

For an authorization test, assert the resource is **genuinely unchanged**, not just that a
`403` came back — a status code proves the request was refused, not that the write failed
to land.

## 6. Verify

```bash
npm run verify
```

Typecheck, lint, scenario coverage, both suites. Green means done.

## When a new deviation turns up

Assert what the app does. Comment the cause with a file and line from the app repository.
Add a row to `docs/API_DEVIATIONS.md`. Never widen a schema to make a failure disappear
without first establishing whether the app changed.
