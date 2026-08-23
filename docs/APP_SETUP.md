# Running the App Under Test (Conduit)

Verified working on macOS arm64 (Darwin 25.4.0), 2026-08-22.

The upstream README's instructions (`npm install && npm start`) do **not** work on a
modern machine. Four separate problems have to be solved. Each fix below was verified
by actually running the app, not inferred.

## Prerequisites

Node **16** (arm64), via nvm:

```bash
brew install nvm
mkdir -p ~/.nvm
export NVM_DIR="$HOME/.nvm"
. "/opt/homebrew/opt/nvm/nvm.sh"
nvm install 16      # 16.20.2 arm64
```

### Why 16 and not 14

Node 14 is what the dependency tree targets, but **there is no `darwin-arm64` build of
Node 14** — nodejs.org ships only `darwin-x64` for 14.21.3. Installing it on Apple
Silicon yields `Bad CPU type in executable` unless Rosetta 2 is installed. Node 16 is
the oldest version with a native arm64 build, and it still predates the OpenSSL 3
change that breaks webpack 4 (which `react-scripts@4` uses), so no
`--openssl-legacy-provider` workaround is needed.

## Setup

```bash
git submodule update --init --recursive
```

The frontend is a git submodule and ships empty. Without this, `npm install` fails
instantly in `preinstall`, which does `cd react-redux-realworld-example-app && npm install`.

```bash
npm install --ignore-scripts
```

`--ignore-scripts` is required for two reasons: it skips the `preinstall` hook (which
would recurse into the frontend before we're ready) and it skips native builds that
fail on this machine.

```bash
npm install sqlite3@5.1.7 --no-save
```

The pinned `sqlite3@5.0.2` has no working `darwin-arm64` build — `node-pre-gyp` finds
no prebuilt binary and the fallback source build fails on both Node 16 and Node 26.
`5.1.7` ships an arm64 prebuilt and is API-compatible with `sequelize@6`. `--no-save`
keeps the app's `package.json` untouched, which matters because **modifying the app
under test is out of scope** for this assignment.

```bash
cd react-redux-realworld-example-app
npm install --ignore-scripts
cd ..
```

Skips `node-sass@5.0.0`, which cannot build on Node 16 or 26 and has no arm64 prebuilt.
This is safe: the app's only SCSS import is commented out at
`react-redux-realworld-example-app/src/index.js:12`, so `sass-loader` is never invoked
and the unbuilt `node-sass` is never required at runtime. Verified by compiling and
serving the app successfully.

## Running

Two processes, both on Node 16.

```bash
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh"
nvm exec 16 node app.js
```

Backend on <http://localhost:3000>, API at `/api`.

```bash
cd react-redux-realworld-example-app
BROWSER=none nvm exec 16 npm start
```

Frontend on <http://localhost:4101>. `PORT=4101` and
`REACT_APP_API_URL=http://localhost:3000` are hardcoded in the frontend's `start`
script. `BROWSER=none` stops CRA from opening a browser window.

Note that `npm start` at the repo root starts **only** the backend; it serves a static
React build from `react-redux-realworld-example-app/build`, which does not exist unless
`npm run build` was run (and that needs node-sass). The assignment brief's
"`npm install && npm start` → UI on 4101" is inaccurate; 4101 is the CRA dev server,
which is `npm run front`.

## Verified API deviations from the spec

`realworld/api/swagger.json` is the canonical RealWorld reference spec, **not** a
description of this fork. Confirmed by direct request against the running app:

| Case                              | swagger.json | Actual                                                         |
| --------------------------------- | ------------ | -------------------------------------------------------------- |
| `POST /api/users` success         | `201`        | **`200`**                                                      |
| `POST /api/users` duplicate email | `422` JSON   | **`404`**, `text/html`, body `error: 404 Not Found /api/users` |

Cause: `routes/api/users.js` catches the save error and calls `next()` with no
argument, so the request falls through to the generic 404 handler in `app.js`.

This is why API tests are written against observed behaviour with deviations
documented, and why the spec is not fed to a code-generating agent as ground truth.

## Other facts worth knowing

- JWT is persisted at `localStorage.jwt` (`src/middleware.js`), so Playwright's
  `storageState` captures the session correctly.
- The API accepts **both** `Authorization: Token <jwt>` and `Bearer <jwt>`
  (`routes/auth.js`), so a wrong guess still passes — which hides spec deviation.
- Under `NODE_ENV=test` the database is SQLite `:memory:` (`models/index.js`); otherwise
  it is a `db.sqlite3` file. Postgres engages **only** when `NODE_ENV=production`, which
  also forces `ssl: { require: true }` on the connection.
- The frontend contains **zero** `data-testid` attributes. Form inputs have no `id`,
  no `name`, and no `<label>` — only `placeholder` and Bootstrap classes.
