# T-0021 — V1 acceptance and learning validation

Date: 2026-09-13
Baseline before this ticket: `0f82b8d`
Data used: synthetic only
External providers: disabled for local acceptance; Supabase synthetic shadow validated separately

## Acceptance scenario

1. Open **Apprendre**, then **Validation Excel autonome**.
2. Download `plant-readings.csv`, a distinct eight-row synthetic semicolon dataset.
3. Start the attempt and enter a partial diagnostic.
4. Pause, refresh the page, resume, and confirm every answer is preserved.
5. Complete the import in Excel without reopening the guided procedure, identify the missing
   energy reading, and explain how the preview confirms the column structure.
6. Submit to the local same-origin evaluator. The assessment key is present in the server build
   and absent from the client static bundle.
7. Confirm that success creates traceable `SUCCESSFUL_TRANSFER` evidence and can produce
   `DEMONSTRATED`; failure creates `INCOMPLETE` evidence and remains `FRAGILE`.
8. Complete the existing wrong-answer -> ErrorOccurrence -> Review -> ReviewResult flow and
   confirm that canonical shadow reconciliation is idempotent and excludes raw answers/files.
9. Round-trip a synthetic audio Blob through the production local audio service in real Chrome
   IndexedDB, then delete it.
10. Export and restore canonical history into a distinct empty IndexedDB database; verify digest,
    projections, tombstones, classifications, outbox and source preservation.
11. Block external hosts, visit every required V1 route, then switch Chrome offline and traverse
    cached history between `/` and `/data`.
12. Inspect Git, sensitive paths, CSV formula prefixes, client bundle, typecheck, lint and build.

## Automated result

| Area | Result | Evidence |
| --- | --- | --- |
| Held-out state and progression rules | PASS | 4/4 focused domain tests |
| Held-out browser flow | PASS | start, input, pause, refresh, resume, submit, evidence |
| Assessment API | PASS | valid, invalid and malformed submissions |
| Answer-key boundary | PASS | key absent from `.next/static`, present in `.next/server` |
| Complete learning/review/canonical loop | PASS | actual stores and real IndexedDB |
| Audio local persistence | PASS | production service Blob round-trip/delete in real Chrome |
| Canonical export/restore | PASS | real Chrome, including 1k and 10k scale cases |
| Browser routes | PASS | 19/19 required routes, no external request or runtime error |
| Offline behavior | PASS | cached `/` <-> `/data` history navigation |
| Regression suite | PASS | 437/437 domain and integration tests |
| Browser persistence suite | PASS | 47/47 tests |
| TypeScript and scoped ESLint | PASS | zero diagnostics |
| Production build | PASS | Next.js 16.3.2, 26 generated route entries |
| Git/security inspection | PASS | no tracked sensitive file, secret, CSV formula prefix or line-ending-only change |
| Hosted Supabase gate | PASS | 8/8 synthetic scenarios, schema v7, Auth/RLS isolation, stable learner identity, digest rejection, restore and device replacement |
| Hosted cleanup | PASS | synthetic Auth users and cascading ELOS rows removed after the run |

## Progress explanation

The guided Excel mission can award at most `PRACTICED`. Only the distinct held-out result with all
three criteria valid, independent assistance status, and transfer evidence can award
`DEMONSTRATED`. A failed held-out submission stays visible as incomplete evidence and cannot
promote competence. `RETAINED` still requires a later delayed retrieval and is never granted by
this acceptance run.

## Limits and human observation

- Automation validates the dataset and browser workflow, but it cannot establish that a person
  successfully manipulated the workbook in Microsoft Excel or found the experience useful.
  A short observed learner session remains the next product-learning activity.
- The server-side key prevents accidental pre-submission exposure in the client bundle. It is not
  a high-stakes anti-cheating boundary against someone who controls the local application.
- Real microphone permission and personal speech were intentionally not captured. The production
  audio persistence path was exercised with a synthetic Blob in real Chrome.
- Offline evidence covers an already loaded local session and cached history navigation. A cold
  first visit without a running local application is outside V1.
- Hosted Supabase B04 proof passes with synthetic data. The human approved B05 on 2026-09-14; authenticated SYNC_ALLOWED metadata sync is active while IndexedDB remains authoritative.

## V1.1 backlog

1. Run and record one observed learner session in desktop Excel using this held-out dataset.
2. Add a delayed held-out retrieval so `RETAINED` can be observed over time.
3. Move any future autonomous assessment keys behind the same server-only boundary.
4. Add an optional installable offline shell if cold-start offline use becomes a requirement.
5. Replace the macOS SQLite bootstrap dependency with a cross-platform migration path once the
   Prisma engine issue on this Node 24 checkout is resolved.
6. Observe the first authenticated B05 sync and review remote/local counts without inspecting learner content.

## Rollback

Return code to `0f82b8d` without deleting learner storage. If local state recovery is needed,
restore the last validated canonical export into a distinct empty database first. Never reset or
overwrite the active learner database as part of code rollback.


## 2026-09-14 post-acceptance addendum

The production identity-binding repair is now represented by additive Supabase migration V8. Its synthetic hosted validator passed 8/8 before this scientific-pedagogy work began, and cleanup passed. The original schema-v7 result above remains the historical T-0021 evidence.

Scientific pedagogy V1 adds six evidence-traceable decisions in shadow mode. The canonical history remains authoritative; policy snapshots contain aggregate metadata only, preserve EventIds, and cannot independently promote mastery. Current validation evidence is recorded by the repository release gate and `docs/research/SCIENTIFIC_PEDAGOGY_V1.md`. A real learner study remains behind explicit human approval.
