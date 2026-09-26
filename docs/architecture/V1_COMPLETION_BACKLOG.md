# Engineer Learning OS V1 completion backlog

Audit baseline: `4c309b4` on 2026-09-13.

The user-visible learning routes, canonical shadow integration, reproducible Mac build, deletion
tombstones, local recovery/status workspace, and the eight hosted Supabase checks are operational.
Final remote metadata activation was approved on 2026-09-14 and is available through authenticated, reversible browser configuration.

## BLOCKER

| ID | Work | Exit criterion | Human gate |
| --- | --- | --- | --- |
| V1-B01 — DONE | Integrate legacy evidence, error occurrences, review results, and meaningful attempts into canonical IndexedDB in additive shadow mode | Real local flows append idempotent canonical events without changing legacy behavior; raw answers/files/audio stay local-only references | No |
| V1-B02 — DONE | Prove the daily learning loop end to end | Mission -> Evidence -> ErrorOccurrence -> Review -> ReviewResult -> competency/progress passes through actual stores and canonical shadow | No |
| V1-B03 — DONE | Restore a reproducible production build after repository relocation | One documented install/build path works from the current checkout without stale absolute symlink assumptions | Dependency download may require network approval; no paid gate |
| V1-B04 — DONE | Run the eight hosted Supabase activation checks | Additive migration, shadow equality, Auth/RLS failure, outage, corruption, version mismatch, restore, and replacement pass with synthetic data | Completed on a dedicated Free Paris project; synthetic users and rows are deleted after each run |
| V1-B05 — DONE | Final remote sync activation | Authenticated SYNC_ALLOWED metadata synchronizes while IndexedDB remains authoritative and rollback stays configuration-only | Approved by the human on 2026-09-14 |

## REQUIRED

| ID | Work | Exit criterion | Human gate |
| --- | --- | --- | --- |
| V1-R01 — DONE | Isolate product TypeScript validation from optional examples and skill samples | Product `tsc --noEmit` is green without suppressing production errors | No |
| V1-R02 — DONE | Expose local canonical export/import and recovery status safely | Learner can export, validate, and restore into an empty local target with warnings and no destructive overwrite | No |
| V1-R03 — DONE | Add canonical deletion emission to learner evidence deletion | Legacy delete remains functional, tombstone is appended, and stale replay cannot restore logical state | No |
| V1-R04 — DONE | Add operational status for local persistence/outbox/restore | User can distinguish healthy, best-effort, unavailable, unrestored, and failed states without leaking content | No |
| V1-R05 — DONE | Verify every required V1 route and offline navigation in a browser | Route smoke/accessibility checks pass with external integrations disabled | No |
| V1-R06 — DONE | Produce T-0021 acceptance evidence | Held-out synthetic Excel flow, pause/resume, evidence, review, local audio, export/restore, offline run, Git/security inspection pass | Human learning-value observation remains desirable but does not block engineering evidence |
| V1-R07 — DONE | Keep continuous handoff and runbooks current | New checkout can reproduce typecheck, tests, build, browser checks, backup and rollback | No |

## IMPORTANT

| ID | Work | Exit criterion |
| --- | --- | --- |
| V1-I01 — DONE | Extend canonical shadow coverage to Academic, Visual, Deep Mastery, Professional, Technical English, and Daily English | Each mature flow has a tested mapping and comparison report |
| V1-I02 — DONE | Add local privacy-safe operational history retention | Allowlisted telemetry can be inspected and pruned near the 90-day target |
| V1-I03 — DONE | Improve empty/loading/error states for canonical recovery | Recovery failures are actionable and never imply data was deleted |
| V1-I04 — DONE | Add a release validation command | One command runs scoped typecheck, lint, domain, browser, regression, and build checks |

## SCIENTIFIC PEDAGOGY — DONE

| ID | Decision | V1 result |
| --- | --- | --- |
| SCI-001 — DONE | ADAPT | Context-aware retrieval scheduling keeps the established 3/7/14-day ladder, caps assisted success at one day, and accelerates recurring-error review; a simplified FSRS-compatible baseline remains simulation-only. |
| SCI-002 — DONE | ADOPT | Confidence is calibrated against correctness and assistance; confidence alone never awards mastery. |
| SCI-003 — DONE | ADAPT | Assistance changes one rung at a time, never auto-reveals a full solution, and fades after repeated autonomous success. |
| SCI-004 — DONE | ADAPT | Contrastive interleaving uses only curated `CONFUSED_WITH` relations after observed confusion. |
| SCI-005 — DONE | ADOPT | Self-explanation uses semantic invariants and transfer remains separate, stronger evidence. |
| SCI-006 — DONE | ADAPT | A small deterministic, provenance-bound concept graph supports inspectable remediation paths. |

All six records include source IDs, limitations, measurement plans, deterministic tests, and a privacy-safe canonical-history projection. See `docs/research/SCIENTIFIC_PEDAGOGY_V1.md`.

## OPTIONAL

| ID | Work | Exit criterion |
| --- | --- | --- |
| V1-O01 | NotebookLM workflow | Remains manual, derived, unverified, and unnecessary for the learning loop |
| V1-O02 | Passkey authentication | Reconsider after Supabase passkeys leave experimental status or the risk is accepted |
| V1-O03 | Encrypted remote object storage | Requires explicit content policy, key recovery, deletion, and cost gates |

## DEFERRED

| ID | Work | Reason |
| --- | --- | --- |
| V1-D01 | SQLite OPFS canonical adapter | IndexedDB already meets the local V1 contract |
| V1-D02 | FSRS, Kafka, Redis, Kubernetes, vector DB, or new orchestration frameworks | No demonstrated V1 need |
| V1-D03 | Legacy destructive migration or canonical cutover | Additive shadow evidence and final human acceptance must come first |
| V1-D04 | Letta or external memory authority | Native event history remains canonical and reconstructible |

## Execution order

1. V1-R01 and V1-B03 establish a trustworthy validation loop.
2. V1-B01, V1-R03, V1-R02, and V1-R04 integrate the canonical local core additively.
3. V1-B02, V1-R05, V1-R06, and V1-R07 prove the complete local V1.
4. V1-B04 uses a dedicated Free Paris Supabase project and synthetic data only; all eight hosted checks pass.
5. V1-B05 records the explicit human approval, enables authenticated SYNC_ALLOWED transfer, and preserves a one-variable rollback.

V1-B05 authorizes the authenticated transfer of real learner metadata classified SYNC_ALLOWED. No item authorizes raw-content transfer, a paid plan, destructive migration, or a canonical cutover.
