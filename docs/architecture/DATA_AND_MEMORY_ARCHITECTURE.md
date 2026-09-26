# Engineer Learning OS V1 — Architecture des données et de la mémoire

Statut : `PLAN_ONLY`  
Autorité canonique : Prisma + SQLite local.

## 1. Principes

1. Une compétence ne progresse jamais sans preuve ou décision humaine tracée.
2. Les scores, tentatives et échéances sont structurés et versionnés.
3. Les fichiers personnels restent hors Git et hors base; seules leurs métadonnées sont relationnelles.
4. Les résumés générés et la mémoire sémantique sont des vues dérivées, révocables.
5. Toute migration est additive jusqu’à validation et possède un chemin de restauration.

## 2. Modèle canonique proposé

| Entité | Champs essentiels | Relations/invariants |
|---|---|---|
| `LearnerProfile` | id, locale, timezone, consent flags, createdAt | Un profil local V1; aucun secret. |
| `Competency` | id, code, title, dimension, levelScaleVersion | Code stable et unique. |
| `CompetencyState` | learnerId, competencyId, currentLevel, confidence, updatedAt | Projection courante, jamais seule preuve. |
| `CompetencyTransition` | fromLevel, toLevel, ruleVersion, reason, evidenceId, createdAt | Ledger append-only; preuve obligatoire sauf override humain explicite. |
| `MissionDefinition` | id, slug, version, type, title, objective, estimatedMinutes, contentJson, active | `(slug, version)` unique; contenu figé après usage. |
| `MissionCompetency` | missionDefinitionId, competencyId, weight | Pondération explicite. |
| `MissionAttempt` | definitionId, learnerId, status, startedAt, pausedAt, submittedAt, completedAt, actualSeconds, assistanceStatus | Une machine d’état validée par le domaine. |
| `StepAttempt` | attemptId, stepKey, status, responseText, hintCount, timestamps | `(attemptId, stepKey)` unique. |
| `Evidence` | attemptId, competencyId, kind, storageKey, originalName, mime, size, sha256, classification, reviewStatus | `storageKey` opaque et borné à la racine locale. |
| `Assessment` | evidenceId/attemptId, rubricVersion, criterionScoresJson, criticalErrorsJson, evaluatorType, notes | Score par critère, pas seulement une moyenne. |
| `SelfAssessment` | attemptId, difficulty, confidence, blocker, success, desiredHelp, actualSeconds | Séparée de l’évaluation. |
| `ErrorPattern` | code, category, description, severity | Taxonomie versionnée. |
| `ErrorOccurrence` | patternId, attemptId, evidenceId, detectedAt, resolvedAt | Relie l’erreur à une preuve. |
| `ReviewSchedule` | competencyId/errorPatternId, dueAt, policyVersion, status | Date explicable et recalculable. |
| `ReviewAttempt` | scheduleId, missionAttemptId, outcome | Trace la révision réelle. |
| `DocumentSource` | title, sourceType, localPath/url, classification, license, checksum, approvedAt | `UNKNOWN` bloque tout transfert externe. |
| `SourceConcept` | sourceId, conceptId, locator, provenance | Provenance jusqu’au passage source. |
| `ProfessionalScenario` | slug, version, contextJson, expectedDeliverablesJson | Synthétique par défaut. |
| `ExternalOperation` | provider, purpose, dataClassesJson, consentAt, status, requestHash, timestamps | Journal sans secrets ni contenu brut. |

Les noms définitifs seront validés au ticket qui introduit chaque migration. Le JSON est acceptable pour du contenu pédagogique versionné, jamais pour masquer une relation nécessaire aux requêtes, à l’intégrité ou à l’audit.

## 3. Compatibilité avec les données existantes

- `Word` demeure exploitable par Daily English Mission.
- `DailyMission` devient soit une façade legacy, soit une source migrée vers `MissionDefinition`/`MissionAttempt`; aucune suppression avant comparaison et sauvegarde.
- `SpeakingSession` demeure lisible; ses futures preuves audio sont reliées par une relation additive, sans recopier le contenu privé.
- Les colonnes JSON existantes ne sont pas réécrites automatiquement.

Séquence de migration : sauvegarde SQLite vérifiée, migration additive, backfill déterministe sur copie, contrôles de nombre/relations, activation progressive, puis décision séparée sur le legacy.

## 4. Stockage des preuves

```text
<evidence-root>/
  <learner-id>/
    <yyyy>/<mm>/
      <opaque-evidence-id>/<sanitized-original-name>
```

Contrôles obligatoires : racine résolue, identifiant généré côté serveur, nom neutralisé, aucun `..`, limite de taille, liste de types autorisés, détection MIME par contenu quand possible, SHA-256, écriture atomique, permissions locales minimales. Les téléchargements utilisent l’identifiant, jamais un chemin fourni par le client.

Le fichier est `PERSONAL` par défaut; les datasets fournis par le système sont `TRAINING_SYNTHETIC`. Audio brut et transcriptions ont des durées de rétention indépendantes.

## 5. Mémoire à trois niveaux

| Niveau | Contenu | Autorité | Rétention |
|---|---|---|---|
| Mémoire canonique | tentatives, preuves, évaluations, compétences, erreurs, révisions | Oui | Selon politique locale et droit d’effacement |
| Mémoire de travail | étape active, brouillon, minuteur, reprise | Non, mais persistée pour résilience | Courte; purgée après clôture |
| Mémoire dérivée | résumés, recommandations, embeddings éventuels | Non | Reconstructible et supprimable |

Un modèle de langage ne modifie jamais directement le ledger. Il propose un résultat avec version de prompt/modèle; un cas d’usage validé applique ou rejette la transition.

## 6. Plan par tickets

- T-0008 : définition/tentative/étape et reprise.
- T-0009 : seed versionné du parcours Excel Niveau 1, sans données personnelles.
- T-0010 : preuve, évaluation, auto-évaluation, compétence et ledger.
- T-0011 : erreurs et révisions.
- T-0012 : métadonnées audio et rétention.
- T-0015 : sources, provenance et droits.
- T-0018 : évaluation du besoin de mémoire externe; Letta seulement si gap mesuré.
- T-0019 : journal d’opération NotebookLM.

Chaque ticket livre migration, tests de contrat, sauvegarde/restauration et contrôle d’absence de données sensibles dans Git.

## 7. Sauvegarde, restauration et suppression

- Avant migration : copie cohérente de SQLite et manifeste SHA-256.
- Preuves : manifeste séparé avec empreintes; ne pas les inclure automatiquement dans un export partageable.
- Restauration : exercice sur copie avant activation d’un schéma.
- Suppression personnelle : effacer binaire, métadonnée ou anonymiser selon obligation, puis invalider les résumés dérivés.
- Les journaux de sécurité ne contiennent jamais audio, transcription complète, clé ou contenu de fichier.

## 8. Qualité et observabilité

Mesures locales minimales : taux de reprise, tentatives abandonnées, preuves invalides, temps par étape, transitions de compétence, révisions échues. Ces mesures utilisent des identifiants internes et restent locales. Une recommandation doit exposer ses facteurs et sa version de politique.

## 9. Conditions d’acceptation

- Une tentative interrompue reprend à la dernière étape persistée.
- Une preuve est traçable jusqu’à sa mission, sa compétence et son évaluation.
- La division entre score évalué, confiance et assistance est explicite.
- Une transition peut être reconstruite depuis le ledger.
- La suppression d’une mémoire dérivée ne détruit pas l’historique canonique.
- Une restauration testée précède toute migration destructive.

