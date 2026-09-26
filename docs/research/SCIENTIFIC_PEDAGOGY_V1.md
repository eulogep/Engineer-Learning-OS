# Scientific pedagogy V1

Status: implemented in additive shadow mode on 2026-09-14. Data used for automated validation:
synthetic only. This engineering validation does not establish a causal learning benefit for real
learners.

## Decisions

| Workstream | Decision | V1 behavior | Main limitation |
| --- | --- | --- | --- |
| SCI-001 retrieval scheduler | ADAPT | Keep the validated 3/7/14-day ladder, shorten after meaningful assistance, and prioritize recurring errors. Compare a simplified FSRS-compatible baseline only in synthetic simulation. | No calibrated ELOS learner parameters or real outcome trial. |
| SCI-002 confidence calibration | ADOPT | Classify overconfident error, underconfident success, assistance dependence and stable autonomous success by fixed rules. | Confidence is self-report and never creates mastery. |
| SCI-003 scaffolding and fading | ADAPT | Use `NONE -> PROMPT -> HINT -> SCAFFOLD -> PARTIAL_EXAMPLE -> WORKED_EXAMPLE -> FULL_SOLUTION`; change one rung at a time and fade after two autonomous successes. | Meta-analytic support for scaffolding is stronger than evidence for one universal fading rule. |
| SCI-004 contrastive interleaving | ADAPT | Interleave only an explicit `CONFUSED_WITH` pair after observed confusion. | No random cross-topic mixing. |
| SCI-005 self-explanation and transfer | ADOPT | Evaluate required semantic invariants; preserve transfer as distinct, stronger evidence. | Text length and fluency do not establish understanding. |
| SCI-006 concept dependency graph | ADAPT | Use typed, deterministic, provenance-bound relations and prerequisite traversal. | Relations are curated hypotheses, not causal diagnoses. |

The source-of-truth records are exported as `SCIENTIFIC_DECISIONS` in
`src/modules/scientific-pedagogy/decisions.ts`. Each record contains the claim, evidence level,
source IDs, mechanism, limitations and measurement plan.

## Architecture and integration

```text
Canonical learning history (IndexedDB authority)
  -> privacy-safe pedagogical observations
  -> deterministic learner concept state
  -> shadow pedagogical plan
  -> Today recommendation / Progress metrics
  -> existing activity routes
  -> learner attempt
  -> existing canonical evidence pipeline
```

The shadow projection reads only canonical metadata. It does not mutate events, rewrite EventIds,
store learner responses, or independently award mastery. The existing module integrations for
Daily English, Technical English, Academic Workspace, Professional Scenarios, Deep Mastery and
Review Engine already converge into canonical events; the policy consumes that common contract.

Review Engine uses the scheduler decision directly. Deep Mastery uses the invariant evaluator for
explanation and transfer questions. Today and Progress render deterministic client-side defaults
until IndexedDB is available, avoiding server/client hydration divergence.

## Metrics

Implemented local aggregate metrics:

- delayed retrieval successes;
- transfer successes;
- recurring errors;
- current confidence-calibration categories;
- synthetic scheduler `meanPredictedRecall`, `unnecessaryReviews`, and `missedReviews`.

Future real-user evaluation, which requires a human gate, should measure delayed retrieval success,
transfer success, reviews per retained concept, assistance reduction, confidence calibration error,
error recurrence, time to demonstrated, time to retained, false mastery rate and retention after
delay. Engagement counts are not substitutes.

## Rejected universal claims

The V1 policy rejects fixed working-memory item counts, mandatory morning review, a universal 85%
flow target, a universal 10,000-hour expertise rule, dopamine-reward claims, fixed 45-minute
overload thresholds, neuroscience learner profiles, and unvalidated emotion detection. None are
represented in product code or copy.

## Experimental systems

LECTOR and Pedagogical Word Recommendation are recorded at `LEVEL_D` because the verified sources
are preprints. Broccoli is recorded at `LEVEL_C` as a peer-reviewed Web Conference system study.
These systems are not treated as equivalent to systematic reviews. No LLM
scheduler, incidental vocabulary insertion, neural word recommender, external memory service,
graph database or KG-RAG system is introduced in V1.

FSRS is classified `ADAPT`: the production policy retains ELOS error, assistance, confidence,
transfer and source-provenance signals. The `FSRS_COMPATIBLE_BASELINE` is a transparent synthetic
retention-model comparator; it is not presented as a full FSRS implementation or evidence of
pedagogical superiority.

## Safety and privacy

- No diagnostic inference about ADHD, disability, intelligence, neurology, emotion, fatigue,
  stress or health.
- No remote provider is called by the scientific policy.
- `LOCAL_ONLY` and `UNKNOWN_BLOCKED` observations remain local.
- No raw answer, audio, file or source content appears in the snapshot.
- A policy failure leaves canonical history and mastery unchanged.

## Reproducibility

Run the scientific unit tests with the repository TypeScript loader. Run the complete release gate
with `npm run validate:v1:local`. Source metadata and legal URLs are in `evidence-index.json`.
