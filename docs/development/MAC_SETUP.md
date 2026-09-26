# macOS development setup

This checkout uses normal repository-local dependency and build directories. Do not symlink
`node_modules` or `.next` outside the repository; Next.js resolves package roots through their
real paths and relocated absolute links can break generated imports.

## Supported path

1. Install and select Node.js 24.x ARM64 and npm 11.x.
2. From the repository root, run `npm ci`.
3. For the local Daily English flow, create an ignored `.env.local` containing
   `DATABASE_URL="file:./dev.db"`, then run `npm run db:setup:local`.
4. Run `npm run db:generate` to generate the local Prisma client.
5. Run `npx --no-install tsc --noEmit --pretty false`.
6. Run `npm run build`.

The application reads local environment values during build. Keep `.env` untracked and never
paste its values into logs or reports. A build does not authorize network calls, remote sync, or
real learner data transfer.

## Verified baseline

On 2026-09-13 the current relocated checkout passed with Node 24.18.0:

- lockfile install: 836 packages;
- Prisma client generation: 6.19.3;
- product TypeScript: pass;
- Next.js 16.3.2 standard Turbopack build: pass;
- 24 application routes generated, including the local data/recovery workspace;
- Daily English SQLite bootstrap is additive and idempotent.

## Recovery from an older Mac checkout

If `node_modules` or `.next` is a symlink to an old checkout or support directory, preserve the
link for diagnosis, remove the link from the active repository root, and repeat the supported
path above. Never copy `.env`, browser profiles, authentication sessions, or learner databases
into Git.

The local database bootstrap uses the public seed list and creates only missing tables and rows.
It does not reset or overwrite an existing SQLite database. Keep `prisma/dev.db` and `.env.local`
untracked. For isolated validation, set `ELOS_LOCAL_DATABASE_PATH` to a fresh path under `/tmp`.

## One-command V1 validation

After `npm ci`, run:

```sh
npm run validate:v1:local
```

The command requires Node.js 24+, Google Chrome at the standard macOS path (or
`ELOS_TEST_CHROME`), and `/usr/bin/sqlite3`. It creates a temporary synthetic SQLite database,
blanks the supported Supabase browser variables, and runs product TypeScript, full product lint,
domain/integration tests, real-Chrome IndexedDB/recovery/audio tests, the production build, all
required routes, the held-out browser scenario, cached offline navigation, and release security
scans. It starts its own loopback server on a free port and removes its temporary database and
Chrome profiles afterward.
