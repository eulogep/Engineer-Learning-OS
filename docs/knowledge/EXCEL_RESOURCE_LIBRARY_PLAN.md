# Excel Resource Library — Future Ingestion Plan

## Scope and decision

This document inventories the learner-provided local Excel library without ingesting its binaries into Engineer Learning OS. It does not change the application, interrupt T-0012, or start a new implementation ticket.

Inventory result: **20 resources** — 14 MP4 videos, 1 M4A audio recording, 3 DOCX guides, and 2 Markdown research/reference notes.

The machine-readable metadata is in knowledge/catalog/excel-resources.json.

## Safety boundary

- Every downloaded or third-party binary defaults to PERSONAL_LEARNING_ONLY.
- No binary is approved for Git, public assets, external upload, redistribution, or transcription.
- Creator, original URL, and license are unknown for the local media and documents.
- redistributionAllowed is therefore false for every catalog entry.
- Absolute and relative local paths are deliberately omitted from the catalog (localPath is null).
- Future missions may use the ideas and skill sequence, but must use new prompts, synthetic datasets, original explanations, and small attributed excerpts only when rights permit.
- The local Ressource Formation excel/ directory is not currently ignored by Git. It must remain unstaged; a future explicitly authorized safety task should ignore or relocate it before any ingestion operation.

## Inventory

| ID | Resource | Type | Duration | Principal competency | Pedagogical role | Quality / rights |
|---|---|---:|---:|---|---|---|
| EXCEL-LOCAL-001 | Combiner des fichiers PDF dans Excel | VIDEO | 1:09 | POWER_QUERY, DATA_CLEANING | Demonstration, extension | UNKNOWN / no redistribution |
| EXCEL-LOCAL-002 | Séparer des données sur plusieurs cellules | VIDEO | 0:38 | CSV_IMPORT, DATA_CLEANING | Demonstration, troubleshooting | UNKNOWN / no redistribution |
| EXCEL-LOCAL-003 | Utiliser l’IA dans Excel | VIDEO | 0:25 | AUTOMATION | Advanced extension | UNKNOWN / no redistribution |
| EXCEL-LOCAL-004 | Plateforme d’apprentissage et mémorisation | ARTICLE | ~20 min | none — design reference | Reference | UNKNOWN / no redistribution |
| EXCEL-LOCAL-005 | Extraire une date depuis un numéro de facture | VIDEO | 0:45 | BASIC_FORMULAS, DATA_CLEANING | Worked example | UNKNOWN / no redistribution |
| EXCEL-LOCAL-006 | Dompter la logique des formules | AUDIO | 16:13 | BASIC_FORMULAS, IF, IFERROR, LOOKUP | Concept explanation | UNKNOWN / no redistribution |
| EXCEL-LOCAL-007 | Excel — Maîtriser les données | VIDEO | 7:34 | FORMATTING, TABLES, SORT_FILTER, CLEANING | Explanation, demonstration | UNKNOWN / no redistribution |
| EXCEL-LOCAL-008 | Guide de survie des erreurs Excel | DOCX | ~15 min | ERROR_DIAGNOSIS, IFERROR, REFERENCES | Primary reference, troubleshooting | UNKNOWN / no redistribution |
| EXCEL-LOCAL-009 | Analyse de masse salariale et indicateurs RH | DOCX | ~20 min | TABLES, REFERENCES, CONDITIONAL_AGGREGATION, STATISTICS, REPORTING | Worked example, practice source | UNKNOWN / no redistribution |
| EXCEL-LOCAL-010 | Combiner RECHERCHEX | VIDEO | 1:10 | XLOOKUP, LOOKUP | Demonstration | UNKNOWN / no redistribution |
| EXCEL-LOCAL-011 | Raccourcis à connaître | VIDEO | 0:23 | unconfirmed | Reference | UNKNOWN / no redistribution |
| EXCEL-LOCAL-012 | Fonctions logiques et de recherche | DOCX | ~15 min | IF, IFERROR, LOOKUP, XLOOKUP | Primary explanation and reference | UNKNOWN / no redistribution |
| EXCEL-LOCAL-013 | Sélection 2026 de ressources Excel | REFERENCE | ~12 min | none — source discovery | Reference | UNKNOWN / verify each source |
| EXCEL-LOCAL-014 | Suivi de projet dynamique | VIDEO | 1:45 | TABLES, CONDITIONAL_FORMATTING, REPORTING | Worked example | UNKNOWN / no redistribution |
| EXCEL-LOCAL-015 | Suivi graphique automatisé | VIDEO | 1:22 | CHARTS, REPORTING, AUTOMATION | Worked example | UNKNOWN / no redistribution |
| EXCEL-LOCAL-016 | Inventaire des stocks dynamique | VIDEO | 1:40 | TABLES, BASIC_FORMULAS, REPORTING | Demonstration, practice source | UNKNOWN / no redistribution |
| EXCEL-LOCAL-017 | Barre de navigation Excel | VIDEO | 1:03 | REPORTING, AUTOMATION | Advanced extension | UNKNOWN / no redistribution |
| EXCEL-LOCAL-018 | Séparer prénom et nom | VIDEO | 1:02 | DATA_CLEANING | Secondary demonstration | UNKNOWN / no redistribution |
| EXCEL-LOCAL-019 | Raccourci Excel non identifié | VIDEO | 0:20 | unconfirmed | Reference | UNKNOWN / no redistribution |
| EXCEL-LOCAL-020 | Clean your Excel data — 20 tips | VIDEO | 0:05 | DATA_CLEANING | Reference teaser | UNKNOWN / no redistribution |

No popularity signal was used to determine quality. UNKNOWN means provenance, instructional accuracy, and rights still require verification.

## High-value shortlist

1. **EXCEL-LOCAL-002 — Séparer des données**: closest bridge from the completed CSV Level 1 mission to a new held-out delimiter exercise.
2. **EXCEL-LOCAL-007 — Maîtriser les données**: potentially useful overview for tables, formatting, filtering, and cleaning; segment inspection is still required.
3. **EXCEL-LOCAL-008 — Guide des erreurs**: strongest structured troubleshooting source for deterministic error scenarios.
4. **EXCEL-LOCAL-012 — Fonctions logiques et recherche**: strongest structured source for SI, RECHERCHEV/RECHERCHEX, and error handling.
5. **EXCEL-LOCAL-009 — Analyse RH**: useful professional analysis/reporting pattern, provided all future data are synthetic.
6. **EXCEL-LOCAL-005 — Extraction de date**: compact worked example suitable for guidance fading.
7. **EXCEL-LOCAL-015 — Suivi graphique**: clear candidate for a reporting evidence task after analysis foundations.

“High value” describes pedagogical fit, not verified source quality or redistribution rights.

## Redundancy and selection

| Skill cluster | Primary resource | Secondary explanation | Reference only |
|---|---|---|---|
| Split text / columns | EXCEL-LOCAL-002 | EXCEL-LOCAL-018 | — |
| Formula logic / IF / IFERROR | EXCEL-LOCAL-012 | EXCEL-LOCAL-006 | relevant section of EXCEL-LOCAL-008 |
| Lookup / XLOOKUP | EXCEL-LOCAL-012 | EXCEL-LOCAL-010 | EXCEL-LOCAL-006 |
| Error diagnosis | EXCEL-LOCAL-008 | EXCEL-LOCAL-012 | — |
| Data handling / cleaning | EXCEL-LOCAL-007 | EXCEL-LOCAL-005 | EXCEL-LOCAL-020 |
| Tables and professional reporting | EXCEL-LOCAL-009 | EXCEL-LOCAL-014, EXCEL-LOCAL-016 | EXCEL-LOCAL-017 |
| Charts | EXCEL-LOCAL-015 | relevant section of EXCEL-LOCAL-009 | — |
| Shortcuts | not selected until inspected | EXCEL-LOCAL-011 | EXCEL-LOCAL-019 |

This selection prevents multiple missions from being generated merely because several resources demonstrate the same feature.

## Competency coverage

| Competency | Coverage | Evidence in library |
|---|---|---|
| EXCEL_CSV_IMPORT | partial | split-column demonstration; completed Level 1 remains the authoritative first mission |
| EXCEL_DATA_FORMATTING | moderate | data overview and RH guide |
| EXCEL_TABLES | moderate | data overview, RH guide, project and stock examples |
| EXCEL_SORT_FILTER | partial | broad data overview only |
| EXCEL_BASIC_FORMULAS | moderate | formula audio, date extraction, stock example |
| EXCEL_CELL_REFERENCES | moderate | error and RH guides |
| EXCEL_IF | strong | automation guide plus audio explanation |
| EXCEL_IFERROR | strong | automation and error guides |
| EXCEL_LOOKUP | strong | automation guide, error guide, audio |
| EXCEL_XLOOKUP | strong | automation guide and targeted video |
| EXCEL_ERROR_DIAGNOSIS | strong | dedicated guide |
| EXCEL_DATA_CLEANING | moderate | data overview and short demonstrations |
| EXCEL_CONDITIONAL_AGGREGATION | moderate | RH guide |
| EXCEL_STATISTICS | partial | RH guide |
| EXCEL_CHARTS | moderate | graphical reporting video and RH guide |
| EXCEL_CONDITIONAL_FORMATTING | partial | project/reporting example inferred from title |
| EXCEL_REPORTING | moderate | HR, project, chart, stock examples |
| EXCEL_POWER_QUERY | narrow | PDF combination video only |
| EXCEL_PIVOT_TABLES | gap | mentioned only in the meta resource list, no direct local instructional source confirmed |
| EXCEL_AUTOMATION | weak | short demos and broad guide; no validated automation progression |

## Gaps

- No verified official primary source is stored in the library.
- No confirmed direct PivotTable lesson or practice asset.
- No structured Power Query progression beyond one PDF-combination clip.
- No held-out synthetic workbooks, answer keys, or deterministic evaluators.
- No reliable direct source URL or creator metadata for the downloaded media.
- No verified license or redistribution permission for any local asset.
- Two shortcut videos cannot be competency-tagged precisely from their titles.
- No direct material for interleaved cumulative assessments across formulas, cleaning, analysis, and reporting.

## Proposed staged Excel pathway

The existing **Excel CSV Foundations Level 1** remains the first real evidence-grounded mission and is not replaced.

1. **FOUNDATIONS**
   - Level 2: delimiters, Text to Columns, types, missing values, duplicates, and explicit division-by-zero handling.
   - Evidence: cleaned synthetic CSV plus a verbal or written explanation without the tutorial.
2. **FORMULAS**
   - Basic formulas, relative/absolute references, then SI and SIERREUR.
   - Evidence: repair and extend a synthetic operational table.
3. **LOOKUPS**
   - Exact lookup concept, RECHERCHEV limitations, then RECHERCHEX.
   - Evidence: complete a new product-reference table and explain failure cases.
4. **ERROR_DIAGNOSIS**
   - Diagnose #NOM?, #VALEUR!, #REF!, #N/A, and display errors.
   - Evidence: repair a deliberately broken synthetic workbook and justify each correction.
5. **DATA_CLEANING**
   - Text separation, type normalization, date extraction, duplicate/missing-value decisions.
   - Evidence: held-out cleaning task with an anomaly log.
6. **ANALYSIS**
   - NB.SI, NB.SI.ENS, SOMME.SI.ENS, average/median, and analysis limitations.
   - Evidence: short factual analysis on a synthetic workforce or production dataset.
7. **REPORTING**
   - Tables, conditional formatting, charts, concise project conclusion.
   - Evidence: one-page synthetic dashboard plus five-sentence management update.
8. **AUTOMATION**
   - Power Query foundations first; navigation/UI tricks only after reliable data flow.
   - Evidence: refresh a new input file and document what changed.

PivotTables require a verified instructional source before a dedicated mission is designed.

## Transformation contract

Every selected source must be transformed as follows:

1. **WATCH** — use only the smallest relevant segment or read the smallest relevant section.
2. **RETRIEVE** — close the source and explain the concept from memory.
3. **PRACTICE** — reproduce the operation on an original synthetic fixture.
4. **PRODUCE_EVIDENCE** — save the result and explain the decision or limitation.
5. **REVIEW** — schedule retrieval from real errors and later use a held-out variant.

Example for XLOOKUP:

- Watch the relevant segment of EXCEL-LOCAL-010 only after the structured concept explanation in EXCEL-LOCAL-012.
- Close both resources and explain exact matching and the lookup/return ranges.
- Complete an XLOOKUP in a new synthetic inventory workbook.
- Solve a variant with reordered columns and a missing key without guidance.
- Save the workbook and a concise explanation as evidence.
- Schedule a later mixed review with IFERROR and reference errors.

Watching, opening, or completing a source is never competency evidence:

WATCHED_VIDEO != COMPETENCY_EVIDENCE

## Learning-science requirements

- **ACTIVE_RECALL:** explanation before reopening the source.
- **SPACED_REPETITION:** review only after traceable performance or error evidence.
- **GENERATION:** learner creates formulas and explanations rather than copying.
- **INTERLEAVING:** later tasks combine lookup, errors, cleaning, and interpretation.
- **WORKED_EXAMPLE:** first encounter may expose a concise solved example.
- **FADING_GUIDANCE:** detailed walkthrough, minimal hints, then held-out task.
- **DUAL_CODING:** pair a small visual demonstration with a short learner explanation.
- **COGNITIVE_LOAD_CONTROL:** one new operation per early mission; no long video assigned wholesale.
- **IMMEDIATE_FORMATIVE_FEEDBACK:** deterministic checks for formula/result/required concepts where reliable.

## Future ingestion gates

Before any source is used by the runtime:

1. Record or verify creator and canonical source URL.
2. Verify license and permitted use; keep redistribution false unless explicit evidence says otherwise.
3. Inspect the relevant segment for correctness, Excel version, and exact competency.
4. Select one primary resource per skill cluster.
5. Write an original mission with synthetic fixtures and no copied answer.
6. Define evidence and deterministic evaluation before exposing the mission.
7. Ensure source paths and binaries remain outside public assets and Git.
8. Perform privacy, copyright, and held-out leakage review.

## Conditions to stop

- Do not ingest or copy binaries.
- Do not implement missions or runtime changes.
- Do not install media, Office, transcription, or extraction dependencies.
- Do not commit or push.
- Do not begin T-0013 or another ticket from this plan.

## Verdict

EXCEL_RESOURCE_LIBRARY_READY_FOR_FUTURE_INGESTION
