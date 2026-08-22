# Deviation Policy

What to do when the app and its specification disagree.

## The two sources, and what each is good for

|                              | Says                               | Use it for                                                  |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `realworld/api/swagger.json` | What the app is **supposed** to do | Designing scenarios — deriving what is worth testing at all |
| The running app              | What the app **currently** does    | Writing assertions — the suite must describe reality        |

Both matter, and conflating them is where suites go wrong in one of two directions.

Assert only from the spec, and the suite is red about things nobody is going to change,
so people stop reading it. Assert only from the app, and every defect gets quietly
promoted to expected behaviour — the suite passes forever and protects nothing.

## The rule

**The specification is the source of truth about intent. The app is the source of truth
about current state. A gap between them is a finding, and a finding needs a human
decision — not an assertion written on autopilot.**

When they disagree, an agent must **stop and ask**, not choose. The right resolution
depends on facts an agent does not have: whether the spec is stale, whether the behaviour
was a deliberate product choice, whether a defect is known and accepted.

## Procedure

**1. Establish it is real.** Reproduce the request. Once is an observation; deterministic
across runs is a finding. The `tagList` deviation was confirmed over five runs before it
was written down.

**2. Find the cause in the app's source.** A deviation you cannot explain might be your
own request being wrong. Every row in `API_DEVIATIONS.md` names a file and line.

**3. Classify it.** This is the judgement an agent should surface rather than make:

| Class          | Looks like                                          | Example here                                                                               |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Defect**     | The app is wrong; no one would defend the behaviour | Duplicate registration returns `404 text/html` because `next()` is called with no argument |
| **Stale spec** | The app is right; the document was never updated    | —                                                                                          |
| **Deliberate** | The app knowingly differs, and it is defensible     | Slug does not regenerate on title change, so existing links keep working                   |

**4. Ask.** Present the evidence, the cause, the classification, and the options. Then
wait. Do not write the assertion first and mention it afterwards.

**5. Record whichever way it goes.** A row in `API_DEVIATIONS.md`, and a comment at the
assertion pointing there.

## What gets written once it is decided

The assertion always describes **current behaviour**, because a suite that fails on known
state is a suite people learn to ignore. What changes is the framing around it.

For a **defect**, the test says so, and the defect gets reported to the app's owners:

```ts
/**
 * DEFECT (see docs/API_DEVIATIONS.md): the spec requires 422 with a JSON error body.
 * The app returns 404 text/html because routes/api/users.js catches the save error and
 * calls next() with no argument. Asserted as-is so the suite describes reality; this is
 * pinned to the *current* behaviour and should be updated when the app is fixed.
 */
expect(response.status()).toBe(404);
```

That comment is the difference between documenting a bug and endorsing one. It also means
the day someone fixes the app, this test fails loudly and points straight at why.

For a **deliberate** difference, the comment says that instead, and no defect is raised.

## Never

- **Never widen a schema or loosen an assertion to make a failure disappear.** That is how
  validation stops validating. Establish what changed first.
- **Never treat a deterministic app behaviour as flake.** No retries, no waits.
- **Never decide the classification alone.** Steps 1–3 are an agent's job; step 4 is not.
