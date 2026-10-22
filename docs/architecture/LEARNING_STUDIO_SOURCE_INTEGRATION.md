# Learning Studio — original-file provenance

## Boundary

Personal files are read in the browser. Neither bytes nor extracted text are
uploaded. Do not bundle a local academic catalogue or original files into the
Next.js client, server build, `public/`, or a tracked fixture. The distributed
`knowledge/index.json` is explicitly a public sample, not proof of local sources.

## Storage contract

Studio IndexedDB schema 3 retains the existing `documents` store and adds
`originals` and `catalogues` stores. Import records the SHA-256 of the original bytes, original
filename, extraction method, source ID and DERIVED role. The source ID is
content-addressed. A renamed identical file resolves to the existing import;
changed bytes create a distinct entry without overwriting prior versions.

Original and extracted document are saved in one transaction. Concurrent imports
do not replace existing metadata. Deletion removes both entries atomically.
`readOriginalFile` exposes the preserved bytes to future export/recovery UI.
The user's filesystem original is never modified. Existing schema-1 documents
remain readable, but missing originals and fingerprints are not fabricated.

New citations carry document version and, when available, original SHA-256.
Verification requires a matching version/hash and a verbatim passage. This
validates a reference to extracted text, not the accuracy of PDF extraction.
Legacy citations remain supported; they do not gain stronger provenance merely
by being loaded. No import produces a canonical learning event.

## Academic catalogue workflow

Open “Catalogue académique local” in the library. Select a real JSON catalogue
conforming to `AcademicSourceIndex` (the public sample is deliberately rejected).
Then choose each original file explicitly. Before extraction, its SHA-256 must
match the catalogue entry. Unknown and company classifications are refused.
No paths are fetched from a server and no batch upload is performed.

Raw catalogue revisions are retained by content hash in IndexedDB. Changed source
metadata produces a distinct document snapshot, preserving the earlier binding.
An entry is shown as available only after a document is linked by source ID and
hash. ChatGPT-only entries are displayed as missing; they are never reconstructed.
Source status is retained separately from exam scope, which stays UNCONFIRMED.
Use the subject/chapter selectors to restrict study tools and search. Plain
imports allow an explicit chapter label. The three-column workspace is retained.

## Reproducible checks

```sh
node --test --experimental-strip-types --import ./tests/register-loader.mjs 'tests/unit/learning-studio/*.test.ts'
npm run typecheck
```

The provenance unit tests use synthetic text only. IndexedDB upgrade, concurrent
imports, original retrieval, abort recovery and browser quota failure still need
browser integration coverage before the full mission is considered validated.

## Remaining mission scope

- Validate the catalogue connection with authorized real course files and browser
  reload/recovery checks; integrate confirmed exam-scope updates separately.
- DOCX extraction through a local supported adapter, without invented pages.
- Confirmed WEB/SQL exam selection, configurable duration, free/technical
  responses, detailed correction and pending human validation where needed.
- Canonical evidence integration using existing integrity/identity/assistance
  gates; no automatic promotion from generated practice.
- SCI-006 links, targeted remediation, offline/recovery/mobile/accessibility
  verification, full regression and build.

## Exam increment

The existing exam engine now accepts a bounded duration (1–180 minutes) and
optional free responses. Definition-based open prompts and technical PHP/SQL
analysis prompts are derived from selected passages; code is never executed.
The technical prompt includes the source code as the exercise stimulus, not an
invented correction. Strict UI mode hides the library and revision tools and
disables switching to the tutor until submission. Answer handlers check the
deadline even between timer ticks. This is a study constraint, not a proctoring
or anti-tamper guarantee.

Open responses are stored as `PENDING_HUMAN_VALIDATION`, with prompts, answers,
confidence and exact citations. They are excluded from automatic scores,
calibration and observed errors, including when a response copies the reference.
The correction displays the source excerpt and a human-review checklist. This
does not yet implement a validated technical rubric or canonical assessment.
The current UI explicitly labels selected sources as a training scope, not a
confirmed official exam scope. Scope confirmation remains required follow-up.

Tests: `tests/unit/learning-studio/open-exam.test.ts` covers duration limits,
pending-response persistence, source-grounded code exercises and deadline bounds.
The existing full suite also checks canonical IndexedDB recovery; it does not
replace browser testing of this new Studio UI or its schema-3 import pipeline.

## Rollback

Keep the pre-integration branch and commits intact. Revert integration commits
in reverse order, without resetting or force-pushing shared history. Do not
downgrade IndexedDB to version 1: old code opening that version will receive a
VersionError after upgrade. A rollback build must retain the schema-3 opening
code and preserve both stores. Never clear the database as a rollback strategy.
Export/recovery UX remains a required follow-up; until validated, retain the
original filesystem files independently.
