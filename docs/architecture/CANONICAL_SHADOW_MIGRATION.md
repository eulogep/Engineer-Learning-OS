# Canonical shadow migration

The V1 application keeps its existing Zustand/localStorage behavior while a client bridge appends
stable canonical metadata to IndexedDB. This is additive: no legacy record is deleted, rewritten,
or made dependent on remote infrastructure.

## Integrated sources

The central learning-record store already receives terminal Evidence from Excel, Technical
English, Deep Mastery, Professional scenarios, Academic quizzes, Visual Learning, and Daily English. The review
store receives their exact error signals, scheduled items, and completed review results. The
canonical bridge observes these two hydrated stores and writes:

- `ATTEMPT_COMPLETED` and `MISSION_COMPLETED` for terminal meaningful attempts;
- `EVIDENCE_CREATED` for terminal Evidence;
- `ERROR_OBSERVED` from the exact error-signal journal;
- `REVIEW_COMPLETED` from completed review results;
- `DELETION_REQUESTED` when an existing legacy Evidence record is removed.

## Identity and idempotence

A local profile owns one pseudonymous learner reference and one device reference. They are stored
as UUIDv7 values in localStorage. Legacy IDs are converted through namespace-separated SHA-256
into stable UUIDv7-shaped opaque IDs. Reconciliation can run after every store update or refresh;
the resulting event, definition, and outbox identities remain identical.

Evolving legacy Evidence with `ENCOUNTERED` or `INCOMPLETE` outcomes is not emitted. Its stable
terminal record is emitted after success or a completed review. This prevents an append-only
event identity from receiving changing payload content. Error occurrences remain canonical even
when their referenced Evidence has not yet reached a terminal state; the unresolved evidence
reference is omitted rather than fabricated.

## Privacy boundary

Only allowlisted pedagogical metadata enters the canonical event:

- event type, mission identity/version, concept/competency IDs, evaluation state and assistance;
- opaque local artifact/source references with `contentIncluded: false`;
- timing, pseudonymous identity, classification, and durable outbox identity.

The bridge never copies learner responses, review responses, source IDs, filenames, MIME details,
error descriptions, documents, audio, screenshots, prompts, cookies, tokens, or secrets. Daily English
adds only a stable guided-completion fact after the local database confirms both mission completion and
a linked speaking session; vocabulary, personal sentences, transcription, corrections, feedback, audio,
and their legacy identifiers remain outside canonical serialization. Remote
sync remains SHADOW/DISABLED and cannot run without the later account and activation gates.

## Failure behavior and rollback

Canonical event plus outbox job remains one IndexedDB transaction. Evidence removal first records one
durable local deletion intent; the bridge maps it to an opaque tombstone, and repeated removal
cannot duplicate the intent. Conflicting error-signal IDs
fail closed. Reconciliation is serialized and idempotent. A canonical storage failure does not
modify legacy state. Rollback is to unmount the bridge while retaining both the legacy stores and
the additive canonical database; no reverse migration is required.

## Complete daily-loop proof

A held-out synthetic Excel flow drives the production mission, learning-record, and review stores
through completion, error detection, scheduled retrieval, ReviewResult, and competency rebuild.
The final state reconciles idempotently to eight canonical event/outbox pairs in both the in-memory
reference repository and real Chrome IndexedDB. The canonical serialization omits the wrong answer,
review response, and local filename.
