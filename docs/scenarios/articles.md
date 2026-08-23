# Scenarios — Articles

Generated against the running app. Every row cites the route handler, component, or
observed response it derives from.

> **Partial by design.** This file records only the article scenarios that are currently
> implemented. The full prioritised design — update, delete, favourites, comments, follows,
> and the UI edge cases — has deliberately not been written out here, because regenerating
> it is the clearest demonstration of what `design-scenarios` does: probe the running app,
> cite evidence, and produce a P0–P2 design rather than a wish list.
>
> Run `design-scenarios` against the articles feature to produce it. Compare
> [authentication.md](authentication.md), which is written out in full, for the shape the
> output should take — including its "explicitly not covered" reasoning.

| ID          | Scenario                                                       | Priority | Layer | Evidence                                              |
| ----------- | -------------------------------------------------------------- | -------- | ----- | ----------------------------------------------------- |
| ART-P0-01   | An article is published and reads back with content and author | P0       | API   | `routes/api/articles.js:132,155`                      |
| AUTHZ-P0-01 | A non-author cannot update an article, and it stays unchanged  | P0       | API   | `routes/api/articles.js:193` — `403`                  |
| UI-P0-02    | An article published from the editor renders for readers       | P0       | UI    | `src/components/Editor.js:159`, `Article/index.js:47` |

## Observed deviations

**`POST /articles` never returns the tags it was sent.** Deterministic over repeated runs:
the create response carries `tagList: []` while an immediate read shows the tags.
`setArticleTags` (`routes/api/articles.js:5`) does not return its inner
`Tag.findAll(...).then(...)` chain, so the article serialises before the association is
written. Classified a **defect**; pinned by `ART-P0-01`.

**The slug does not follow the title.** `PUT /articles/:slug` assigns a new title and leaves
`slug` alone, so existing links keep working. Classified a **deliberate difference** — the
behaviour is defensible even though the spec implies otherwise.

Error responses are not JSON: `403` is `text/plain`, `404` is `text/plain`, `401` is
`text/html`. Full catalogue in [DEVIATIONS.md](../DEVIATIONS.md).

## Implemented, and why these

All three rows above are implemented — this file lists nothing it has not delivered.

`ART-P0-01` proves publication and read-back, the core of the product, and carries the
`tagList` deviation, which is the single assertion a spec-driven contributor is most likely
to get wrong. `AUTHZ-P0-01` is P0 because a permission hole is a trust failure rather than a
bug, and it asserts the article is genuinely unchanged rather than stopping at the status
code. `UI-P0-02` covers the same publication flow through the interface, where the editor's
own behaviour can fail independently of the API.

## Explicitly not covered

Everything else in this feature, pending the design regeneration described above. The known
candidates, in the order they are worth restoring: article update and delete (both P0, both
previously implemented and removed when the suite was trimmed to the brief's three-to-five
range — see [D-004](../../DECISIONS.md)); the remaining authorization verbs, which exercise
the same ownership check reached by a different route; and the whole social surface —
favourites, comments, follows — which `ConduitClient` already supports, making each a
test-only change.

One deserves flagging as a product issue rather than a coverage gap: a tag typed into the
editor but never committed with Enter is silently discarded
(`src/components/Editor.js:140`). That is a usability defect worth reporting to the app's
owners, not merely testing.
