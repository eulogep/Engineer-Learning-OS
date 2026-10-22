# Learning Studio — original-file provenance

## Boundary

Personal files are read in the browser. Neither bytes nor extracted text are
uploaded. Do not bundle a local academic catalogue or original files into the
Next.js client, server build, `public/`, or a tracked fixture. The distributed
`knowledge/index.json` is explicitly a public sample, not proof of local sources.

## Storage contract

Studio IndexedDB schema 2 retains the existing `documents` store and adds an
`originals` store. Import records the SHA-256 of the original bytes, original
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

## Reproducible checks

```sh
node --test --experimental-strip-types --import ./tests/register-loader.mjs 'tests/unit/learning-studio/*.test.ts'
npm run typecheck
```

The provenance unit tests use synthetic text only. IndexedDB upgrade, concurrent
imports, original retrieval, abort recovery and browser quota failure still need
browser integration coverage before the full mission is considered validated.

## Remaining mission scope

- Local AcademicSourceIndex connection, truthful missing-source reporting and
  course/chapter selection; preserve separate programme/current/exam scopes.
- DOCX extraction through a local supported adapter, without invented pages.
- Confirmed WEB/SQL exam selection, configurable duration, free/technical
  responses, detailed correction and pending human validation where needed.
- Canonical evidence integration using existing integrity/identity/assistance
  gates; no automatic promotion from generated practice.
- SCI-006 links, targeted remediation, offline/recovery/mobile/accessibility
  verification, full regression and build.

## Rollback

Keep the pre-integration branch and commits intact. Revert integration commits
in reverse order, without resetting or force-pushing shared history. Do not
downgrade IndexedDB to version 1: old code opening that version will receive a
VersionError after upgrade. A rollback build must retain the schema-2 opening
code and preserve both stores. Never clear the database as a rollback strategy.
Export/recovery UX remains a required follow-up; until validated, retain the
original filesystem files independently.
