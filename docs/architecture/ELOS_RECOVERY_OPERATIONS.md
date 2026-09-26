# ELOS recovery and operational safety

## Objectives

- Local durability is immediate through IndexedDB atomic event/outbox writes.
- Remote recovery point objective is approximately 15 minutes after connectivity returns.
- Restore time objective is at most four hours.
- Remote state stays a shadow copy until the final activation decision.

## Backup states

A backup is operationally usable only when all three checks pass:

1. its checksums verify;
2. it is within the configured freshness window;
3. a restore into a fresh isolated repository succeeds and reproduces canonical and
   projection digests.

The reported states are:

- `TRUSTED`: fresh, checksum-verified, and restored successfully;
- `STALE`: restored and valid, but older than the freshness objective;
- `FAILED`: missing, corrupt, or failed during restore;
- `UNRESTORED`: present but no successful restore evidence exists.

`UNRESTORED` must never be presented as healthy.

## Local restore drill

1. Export the versioned application bundle.
2. Preserve the source store without mutation.
3. Create an exclusively owned empty repository.
4. Validate manifest, individual file checksums, overall checksum, schemas, and references.
5. Import definitions, canonical events, durable outbox, tombstones, and local references.
6. Re-open the target where the adapter supports it.
7. Compare event count, canonical history digest, projection digest, and tombstone identities.
8. Record `TRUSTED` only when every comparison succeeds.

The drill uses synthetic data during automated validation. Real learner exports remain on
device unless the human authorizes a transfer.

## Learner-facing local recovery

The `/data` workspace downloads a versioned JSON recovery file only after an explicit learner
action. The file contains sensitive pedagogical metadata and must remain private. It never embeds
local files, screenshots, or audio; those opaque references are listed as requiring relink.

Import validates the browser envelope and the full recovery manifest before writing into a uniquely
named, empty IndexedDB target. The active database is not overwritten or switched. The UI reports
local persistence, event/outbox counts, and recovery state with sanitized codes only. Remote sync
remains disabled. Browser recovery files larger than 50 MiB are refused.

## Deletion and stale devices

Deletion is represented by an immutable `DELETION_REQUESTED` canonical event and a remote
tombstone. Projection rebuild gives deletion precedence over arrival order, so a stale device
cannot resurrect logical state by replaying an older event. Operations remain `PENDING` while
eligible content has not been purged or any registered device checkpoint predates the
tombstone. Missing or unauthorized tombstones are `FAILED`.

Provider backups may retain deleted bytes until their retention window expires. This must be
documented to the learner before production activation; backup destruction or retention
changes require the corresponding human gate.

## Privacy-safe observability

Telemetry is a strict allowlist containing codes, component, version, timestamps, duration,
pseudonymous device ID, queue depth, backup state, job state, correlation ID, latency, and a
sanitized route. Answers, Evidence content, documents, audio, prompts, cookies, tokens, account
IDs, and company data have no telemetry fields and fail strict parsing if added.

The V1 browser keeps this operational journal in a separate versioned localStorage key. Every read
revalidates the strict schema, discards contaminated or malformed entries, removes entries older than
90 days, deduplicates correlation IDs, and caps the journal at 1,000 entries. The Data workspace lets
the learner inspect, prune, or clear it. Only the fixed `/data` and `/api/sync/health` route labels are
accepted; dynamic identifiers and query strings cannot enter route telemetry.

Severity policy:

- `CRITICAL`: canonical loss/corruption, restore failure, unauthorized access, deletion failure;
- `WARNING`: stuck queue, persistent conflict, divergence, degraded provider, stale backup;
- `INFO`: temporary offline operation, normal resync, and other recoverable conditions.

Only CRITICAL incidents require immediate notification. Retain local operational records for
about 90 days; do not buy a remote log-drain add-on solely to meet this target.

## Rollback

Disable or omit `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Stop shadow uploads. Do not delete the local outbox,
canonical IndexedDB store, or application export. Rebuild projections from local canonical
history. If remote content is corrupt, provision a fresh shadow namespace and repopulate only
after synthetic restore and digest checks pass.
