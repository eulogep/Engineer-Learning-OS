# Engineer Learning OS V1 local runbook

## Supported checkout

Use Node.js 24.x and npm 11.x on Apple Silicon macOS. From a new checkout:

```sh
npm ci
printf '%s\n' 'DATABASE_URL="file:./dev.db"' > .env.local
npm run db:setup:local
npm run validate:v1:local
```

`.env.local` and `prisma/dev.db` are ignored local files. The database bootstrap creates missing
tables and public seed rows with `INSERT OR IGNORE`; it does not reset existing learner rows.
The validation command uses its own temporary synthetic database and does not read the active
learner database.

Requirements outside npm are Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
and `/usr/bin/sqlite3`. Set `ELOS_TEST_CHROME` if Chrome is installed elsewhere.

## What the validation command proves

`npm run validate:v1:local` runs these gates in order:

1. synthetic SQLite bootstrap;
2. product TypeScript;
3. ESLint across `src`, `tests`, `scripts`, and `next.config.ts`;
4. domain and integration regression tests;
5. real Chrome IndexedDB atomicity, recovery, scale and audio persistence;
6. production build;
7. a self-managed loopback server and all required route, held-out and cached-offline checks;
8. tracked-sensitive-path, secret-pattern, CSV-formula and answer-key bundle scans.

A passing run ends with `V1_LOCAL_VALIDATION PASS`. Supabase variables are blanked for the run,
external browser hosts are blocked, and only synthetic data is created.

## Daily local operation

Start the application on loopback:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Use `/data` to inspect local persistence/outbox/recovery status. Export canonical history before a
machine move or risky maintenance operation. An export contains canonical metadata and opaque
local references; referenced files and audio require separate local backup and relinking.

## Restore drill

1. Keep the current database and browser profile untouched.
2. Open `/data` and select the canonical export.
3. Restore only into the distinct empty target offered by the UI.
4. Confirm imported counts, digest and projection status.
5. Reopen the target and verify that referenced artifacts are marked for relinking.
6. Keep the source export until the restored state has been inspected.

The restore flow rejects overwrite of the active database. Do not copy browser profiles, session
cookies, `.env` files, learner databases, or personal artifacts into Git.

## Local rollback

Stop the application first. Preserve the canonical export and active learner stores. Test an older
code checkpoint in a separate worktree, for example:

```sh
git worktree add ../daily-english-mission-rollback <known-good-commit>
```

Install dependencies and run `npm run validate:v1:local` inside that worktree before using it.
Code rollback never authorizes deleting or replacing learner data. Import a backup only into a
new empty target and compare it before any later cutover.

## Hosted gates

The dedicated Free Supabase project is linked for synthetic shadow validation. Run the hosted gate
only with its three values supplied through the process environment:

```sh
ELOS_SUPABASE_PROJECT_REF=... \
ELOS_SUPABASE_PUBLISHABLE_KEY=... \
ELOS_SUPABASE_SECRET_KEY=... \
npm run validate:v1:hosted
```

Keep the server-only key in an OS credential store and never place it in `.env`, a browser variable,
command output, or Git. The harness uses it only to create and remove two synthetic Auth users. It
then exercises the eight hosted V1-B04 scenarios, writes a secret-free local report under
`.agent/reports/`, deletes the users and their cascading rows, and never uses the product’s real learner session. A passing run ends with `V1_HOSTED_SUPABASE_VALIDATION PASS`.

Before accepting a schema change, run a linked migration dry-run and `supabase db advisors`. The
six advisor warnings for authenticated execution of the public `SECURITY DEFINER` RPCs are
intentional: these functions are the authenticated API, check `auth.uid()`, validate active device
credentials, use an empty `search_path`, and grant no anonymous execution. Any additional warning requires review. B05 was approved on 2026-09-14; the sixth expected warning is the authenticated learner-identity resolver.


## Authenticated remote metadata sync

B05 is active for the dedicated Free Supabase project. Open `/data`, create an account or sign in,
then use **Synchroniser maintenant**. Email confirmation may be required before the first sign-in.
The browser sends only canonical metadata classified `SYNC_ALLOWED`; raw answers, files and
audio remain local. IndexedDB continues to accept writes while offline and retries when the browser
returns online.

Only these public values belong in the ignored local runtime file:

```sh
NEXT_PUBLIC_ELOS_REMOTE_SYNC_MODE=ACTIVE
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never expose the secret/service-role key through a `NEXT_PUBLIC_` variable. To stop remote
transfer without changing or deleting data, set `NEXT_PUBLIC_ELOS_REMOTE_SYNC_MODE=DISABLED`
and restart the app. Keep both IndexedDB and the remote copy intact during investigation.
