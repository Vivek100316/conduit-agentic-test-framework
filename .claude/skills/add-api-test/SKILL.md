---
name: add-api-test
description: Add an API test to this framework. Use when asked to cover an endpoint, extend API coverage, or test backend behaviour for the Conduit app.
---

# Add an API test

Follow [Engineering Standards](../../../docs/ENGINEERING_STANDARDS.md) and
[Test Data](../../../docs/ENGINEERING_STANDARDS.md#test-data).

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

**This is the step that matters.** Read [DEVIATIONS.md](../../../docs/DEVIATIONS.md)
first, then issue the request yourself and record what actually comes back:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -X POST \
  http://localhost:3000/api/articles -H "Authorization: Token $TOKEN" \
  -H 'Content-Type: application/json' -d '{"article":{...}}'
```

**Read `realworld/api/swagger.json` to learn what the endpoint is _supposed_ to do — it is
useful for deciding what is worth testing. Never take an assertion from it.** It documents
the canonical RealWorld API, not this fork, and it is wrong here about registration status
codes, duplicate-email handling, and field nullability.

Where the two disagree, you have found something. See step 7.

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

## 7. When a new deviation turns up — stop and ask

Follow [DEVIATIONS.md](../../../docs/DEVIATIONS.md#policy--when-the-app-and-the-spec-disagree). The short version:

**Do not decide alone, and do not quietly assert whatever the app happens to do.** The
specification is the source of truth about intent; the app is the source of truth about
current state. A gap is a finding, and resolving it needs facts you do not have — whether
the spec is stale, whether a defect is known, whether the difference was deliberate.

Your job is steps 1–3, then hand over:

1. **Reproduce it.** Once is an observation; deterministic across runs is a finding.
2. **Find the cause** in the app's source, with a file and line. A deviation you cannot
   explain may be your own request being wrong.
3. **Propose a classification** — defect, stale spec, or deliberate difference.
4. **Ask.** Present evidence, cause, classification, options. Then wait.

Once it is decided, the assertion describes current behaviour — a suite that fails on known
state gets ignored — but a defect is labelled as one at the assertion, so that the day
someone fixes the app the test fails loudly and points at why.

Never widen a schema to make a failure disappear without first establishing what changed.
