---
name: design-scenarios
description: Explore a feature of the running Conduit app and produce a prioritised P0/P1/P2 scenario design grounded in observed behaviour. Use when asked to plan coverage for a feature, extend the suite to a new area, or answer "what should we test for X".
---

# Design test scenarios for a feature

Produces `docs/scenarios/<feature>.md`: a prioritised scenario list where every entry is
grounded in something actually observed in this codebase or this running app.

Follow [Engineering Standards](../../../docs/ENGINEERING_STANDARDS.md).

## The grounding rule

**Every scenario must cite evidence.** A citation is one of:

- a route handler and line (`routes/api/articles.js:112`)
- a React component and line (`src/components/Editor.js:110`)
- an API response you produced during this session

A scenario you cannot cite is a scenario you invented. Delete it.

This rule exists because "verify login with valid credentials" is the kind of output that
looks like test design and contains no information — it would be identical for any
application ever built. The value of this skill is entirely in what it notices about *this*
app.

## Procedure

### 1. Establish the app is reachable

```bash
npm run app:health
```

Stop if it fails. Do not design scenarios against an app you cannot observe.

### 2. Map the feature's real surface

Read the Express routes backing the feature and enumerate, concretely: every endpoint and
method; whether auth is `required` or `optional` (`routes/auth.js`); every validation
branch and early return; every error path, including ones falling through to a generic
handler.

Then read the React components. Enumerate fields, controls, and rendered states. Remember
the app has **no `data-testid` attributes** and its inputs have no `id`, `name`, or
`<label>` — note what a locator would actually have to anchor on.

### 3. Observe, do not assume

Issue each request against the running app and record the **actual** status, content type,
and body shape.

Do not read expectations from `realworld/api/swagger.json`. It documents the canonical
RealWorld API, not this fork, and is known wrong about status codes, error bodies, and
field nullability. Anything you find goes under **Observed deviations** and into
[API_DEVIATIONS.md](../../../docs/API_DEVIATIONS.md).

### 4. Assign priority by consequence, not difficulty

| | Definition | Examples |
| --- | --- | --- |
| **P0** | The feature is unusable or unsafe if this breaks. Happy path, auth boundaries, data integrity. | A registered user can log in; a user cannot edit another user's article |
| **P1** | Meaningful degradation; the feature still functions. Validation, alternate flows, cross-entity effects. | A duplicate email is rejected; a published article appears on its author's profile |
| **P2** | Edge, cosmetic, or rare. | Unicode in titles; pagination past the last page; empty-state copy |

Two rules that override intuition. An **authorization** scenario is always P0 even when it
feels routine — a permission hole is a trust failure, not a bug. And anything depending on
Conduit's shared global state (the tag list, the Global Feed) is **capped at P1**, because
absolute-count assertions there are racy by construction and banned by the standards.

### 5. Choose a layer

Assign `API`, `UI`, or `both`. Default to `API` — faster and more precise. Choose `UI` only
when the user-visible journey is genuinely the subject. Mark `both` only when the API rule
and its presentation can fail independently.

### 6. Write the output

One file per feature at `docs/scenarios/<feature>.md`, with stable IDs:

```markdown
| ID | Scenario | Priority | Layer | Evidence |
| --- | --- | --- | --- | --- |
| LOGIN-P0-01 | Registered user authenticates and receives a JWT | P0 | API | routes/api/users.js:46 |
```

IDs are **stable and never reused**. A test claims one by putting it in its title, and
`npm run scenarios:coverage` reports designed against implemented and fails on any ID a
test claims that no design defines.

Always include **Implemented, and why these** and **Explicitly not covered**, with reasons.
Naming what you chose to skip, and why, is the part that reads as engineering judgement
rather than as an exhaustive list.

## Output discipline

Ten grounded scenarios beat forty generic ones. If two scenarios would be proven by the
same assertions against the same endpoint, they are **one** scenario. Resist symmetry: not
every feature has meaningful P2 cases, and inventing them to fill the table is exactly the
padding this skill exists to prevent.
