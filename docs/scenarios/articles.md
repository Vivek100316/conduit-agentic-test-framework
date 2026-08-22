# Scenarios — Articles

Generated against the running app on 2026-08-22. Every row cites the route handler,
component, or observed response it derives from.

| ID          | Scenario                                                                     | Priority | Layer | Evidence                                                 |
| ----------- | ---------------------------------------------------------------------------- | -------- | ----- | -------------------------------------------------------- |
| ART-P0-01   | An article is published and reads back with its content and author           | P0       | API   | `routes/api/articles.js:132,155`                         |
| ART-P0-02   | An author updates their own article                                          | P0       | API   | `routes/api/articles.js:169`                             |
| ART-P0-03   | An author deletes their own article and it becomes unreachable               | P0       | API   | `routes/api/articles.js:200` — returns `204`             |
| ART-P1-01   | A partial update leaves untouched fields intact                              | P1       | API   | Field-by-field guards — `routes/api/articles.js:172`     |
| ART-P1-02   | The slug does not change when the title changes                              | P1       | API   | Deviation — `routes/api/articles.js:169`                 |
| ART-P1-03   | Requesting an unknown slug is refused                                        | P1       | API   | `router.param` preloader — `routes/api/articles.js:27`   |
| ART-P2-01   | Two articles with identical titles get distinct slugs                        | P2       | API   | Random slug suffix — observed `probe-title-…-yrof7y`     |
| AUTHZ-P0-01 | A non-author cannot update an article, and it stays unchanged                | P0       | API   | `routes/api/articles.js:193` — `403`                     |
| AUTHZ-P0-02 | A non-author cannot delete an article                                        | P0       | API   | `routes/api/articles.js:209` — `403`                     |
| AUTHZ-P0-03 | Publishing without a token is refused                                        | P0       | API   | `auth.required` — `routes/api/articles.js:132`           |
| SOC-P1-01   | Favouriting and unfavouriting updates the count for the acting user          | P1       | API   | `routes/api/articles.js:219,240`                         |
| SOC-P1-02   | Favourited state is per-user while the count is shared                       | P1       | API   | `toJSONFor(user)` — `models/article.js`                  |
| SOC-P1-03   | A comment is added and listed against its article                            | P1       | API   | `routes/api/articles.js:284,261`                         |
| SOC-P1-04   | A comment is deleted                                                         | P1       | API   | `routes/api/articles.js:300`                             |
| SOC-P1-05   | Following a user is reflected on their profile and not for anonymous readers | P1       | API   | `routes/api/profiles.js:38`                              |
| UI-P0-02    | An article published from the editor renders for readers                     | P0       | UI    | `src/components/Editor.js:159`, `Article/index.js:47`    |
| UI-P1-03    | A tag left uncommitted in the editor input is silently dropped               | P1       | UI    | `onKeyUp` Enter handler — `src/components/Editor.js:140` |
| UI-P2-02    | Markdown in the body renders as HTML                                         | P2       | UI    | `marked(...)` — `src/components/Article/index.js:38`     |

## Observed deviations

**`POST /articles` never returns the tags it was sent.** Deterministic over repeated runs:
the create response carries `tagList: []` while an immediate read shows the tags.
`setArticleTags` (`routes/api/articles.js:5`) does not return its inner
`Tag.findAll(...).then(...)` chain, so the article serialises before the association is
written. Pinned by `ART-P0-01`.

**The slug does not follow the title** (`ART-P1-02`), and error responses are not JSON —
`403` is `text/plain`, `404` is `text/plain`, `401` is `text/html`.

## Implemented, and why these

`ART-P0-01` and `AUTHZ-P0-01`.

`ART-P0-01` proves publication and read-back — the core of the product — and carries the
`tagList` deviation, which is the single assertion a spec-driven contributor is most
likely to get wrong. `AUTHZ-P0-01` is P0 because a permission hole is a trust failure
rather than a bug, and it asserts the article is genuinely unchanged rather than stopping
at the status code. `UI-P0-02` covers the same publication flow through the interface,
where the editor's own behaviour can fail independently of the API.

## Explicitly not covered

**`ART-P0-02` and `ART-P0-03`** — update and delete are P0 and were implemented, verified
green, and then removed when the suite was trimmed to the brief's three-to-five range
(D-004). They are the first two scenarios to restore if the cap is lifted. `ConduitClient`
already has both methods, so restoring them is a test-only change.

**`AUTHZ-P0-02` and `AUTHZ-P0-03`** — the same ownership check and the same middleware as
`AUTHZ-P0-01`, reached by a different verb. Distinct on paper; one branch in the code.

**All `SOC-*`** — favourites, comments, and follows are real product surface and are fully
supported by the client. They are absent because none of them changes what the framework
demonstrates, and the brief puts full coverage out of scope. `SOC-P1-02` is the most
interesting of them: per-user state layered over a shared count is the kind of thing that
breaks quietly.

**`UI-P1-03`** — the most valuable unimplemented scenario in this file. A tag typed but
never committed with Enter is discarded without warning, which is a genuine usability
defect rather than a test gap. Worth reporting to the app's owners, not just testing.

**`ART-P2-01`, `UI-P2-02`** — P2 by construction. The slug suffix is observably random and
markdown rendering is a library's responsibility.
