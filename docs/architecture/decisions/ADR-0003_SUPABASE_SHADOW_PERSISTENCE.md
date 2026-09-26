# ADR-0003: Supabase for remote shadow persistence

Status: Accepted for synthetic shadow implementation
Date: 2026-09-13

## Decision

Use Supabase PostgreSQL in a specific Paris EU region. Begin on the Free plan with
synthetic data and keep local IndexedDB authoritative. Remote synchronization remains
SHADOW/DISABLED until the final activation gate.

The browser-facing adapter accepts only a current `sb_publishable_*` key. Supabase Auth
provides the user session; SQL RPC functions enforce user and device ownership, RLS,
classification, replay protection, idempotence, checkpoints, and revocation. No
service-role or `sb_secret_*` key may enter browser code.

Passkeys are currently experimental in Supabase. V1 account bootstrap should therefore
start with managed magic-link authentication; passkeys can be evaluated later without
changing canonical history or device-trust contracts.

## Why

Supabase supplies PostgreSQL, managed Auth, RLS, backups, logs, and future object storage
under one operational boundary. Neon has better database-only economics and portability
but needs another object-storage provider. Firebase SQL Connect adds a GraphQL connector
and Firebase-specific authorization surface that is unnecessary for the provider-neutral
adapter.

## Portability and exit

- Canonical domain types and sync contracts do not import a Supabase SDK.
- Schema changes are plain versioned PostgreSQL migrations.
- Application exports remain the recovery source of truth.
- PostgreSQL schema and data can be exported with `supabase db dump` / `pg_dump`.
- Provider Storage objects, when introduced, require a separate manifest and export drill;
  database backups contain object metadata but not object bodies.
- Exit is additive: provision another adapter, shadow-copy synthetic data, compare canonical
  and projection digests, then repeat the activation gate. Never rewrite canonical IDs.

## Cost controls

Free is authorized for synthetic development. A paid plan is not activated automatically.
Escalate to the human before Pro (currently USD 25/month), PITR, added compute, log drains,
or quota overages. Pro becomes justified only before the remote copy is relied on for
recovery because Free has no automatic backups and can pause after inactivity.

## Required configuration after account creation

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- a managed Supabase Auth user session
- a locally generated per-device credential stored outside source control

No database password, secret key, or service-role key is required by the browser adapter.

References:

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/secure-data
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/auth/passkeys
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/local-development/cli-workflows
