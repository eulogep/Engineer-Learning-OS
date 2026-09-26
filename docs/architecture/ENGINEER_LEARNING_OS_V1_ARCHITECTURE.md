# Engineer Learning OS V1 — Architecture cible

Statut : `PLAN_ONLY`  
Programme : `ENGINEER_LEARNING_OS_V1`  
Principe : `REUSE_FIRST`, local-first, preuves avant automatisation.

## 1. Décision structurante

Engineer Learning OS V1 reste un monolithe modulaire Next.js. L’interface et les routes HTTP appartiennent à `src/app/`; les règles d’apprentissage résident dans des modules indépendants sous `src/modules/`; `src/main/` compose les cas d’usage et les adaptateurs; Prisma/SQLite, le stockage de fichiers, l’audio et les services IA restent des adaptateurs d’infrastructure.

La base SQLite est l’autorité pour l’état structuré. Les fichiers lourds ou privés (audio, CSV remis, captures) restent dans un stockage local dédié et ignoré par Git; la base ne conserve que leurs métadonnées et leurs empreintes. Aucun outil externe ne devient l’autorité sur la progression, les preuves ou les compétences.

## 2. Contexte existant et décision de réutilisation

| Élément actuel | Décision | Motif et destination |
|---|---|---|
| Next.js 16, React 19, TypeScript, Tailwind | `REUSE_AS_IS` | Socle web déjà fonctionnel et cohérent avec un monolithe local. |
| shadcn/ui et composants Radix | `REUSE_AS_IS` | Fondation accessible pour shell, formulaires, dialogues et états. |
| Page Daily English Mission et ses étapes | `ADAPT` | Réutiliser les patterns de progression, pas la séquence codée en dur. |
| Zustand | `ADAPT` | Réserver à l’état d’interface éphémère; ne pas en faire la mémoire pédagogique. |
| React Query | `REUSE_AS_IS` | Cache/invalidations côté client autour des cas d’usage HTTP. |
| Modèles Prisma `Word`, `DailyMission`, `SpeakingSession` | `ADAPT` | Préserver les données existantes et ajouter un modèle générique par migrations additives. |
| Routes API Daily Mission | `ADAPT` | Extraire les règles vers des cas d’usage; garder les routes comme transport. |
| Capture `MediaRecorder` de `SpeakingStep` | `ADAPT` | Extraire un composant réutilisable, avec prévisualisation, consentement et rétention. |
| ASR et correction Z.ai directement dans les routes | `REPLACE` | Les placer derrière des ports explicites; exécution externe désactivée par défaut. |
| Configuration Next ignorant les erreurs TypeScript | `REMOVE` | Doit disparaître avant l’acceptation V1. |
| Proxy dynamique du `Caddyfile` | `REMOVE` | Surface SSRF/exposition inutile; à traiter au hardening, avec configuration locale fixe. |
| Architecture modulaire décrite dans `docs/ARCHITECTURE.md` | `REUSE_AS_IS` | Devient la contrainte de structure du programme. |

Sources locales vérifiées : `package.json`, `prisma/schema.prisma`, `src/app/page.tsx`, `src/app/api/`, `src/lib/store.ts`, `src/components/daily-mission/`, `next.config.ts`, `Caddyfile`, `docs/ARCHITECTURE.md`.

## 3. Architecture logique

```text
Browser / learner
  -> Next.js UI (shell, mission runner, evidence, review, progress)
    -> HTTP route handlers (validation, auth/session, transport)
      -> application use cases (src/main composition)
        -> domain modules (src/modules)
          -> ports
            -> Prisma/SQLite
            -> local evidence store
            -> audio capture/playback
            -> optional external adapters (ASR, LLM, NotebookLM)
```

Les dépendances pointent vers le domaine. Un module publie des contrats; aucun module n’importe l’implémentation interne d’un autre module.

## 4. Modules V1

| Module | Responsabilité | Première phase |
|---|---|---|
| `mission-runtime` | Définitions versionnées, tentatives, étapes, pause/reprise, assistance | T-0008 |
| `evidence-assessment` | Métadonnées de preuve, soumission, évaluation et traçabilité | T-0010 |
| `competency-map` | Compétences, niveaux, transitions justifiées par preuves | T-0010 |
| `review-engine` | Erreurs récurrentes, échéances de révision, nouvelles tentatives | T-0011 |
| `english-in-loop` | Capture, lecture, consentement et évaluation de l’oral | T-0012 |
| `deep-mastery` | Questions adaptatives bornées et contrôle de maîtrise | T-0013 |
| `professional-scenarios` | Scénarios, livrables, rôles et décision attendue | T-0014 |
| `knowledge-catalog` | Sources, concepts, provenance, classifications et droits | T-0015 |
| `learning-planner` | Choix explicable de la prochaine mission/révision | T-0011 puis T-0021 |
| `learning-memory` | Résumés dérivés; jamais autorité sur les scores | T-0018 conditionnel |

## 5. Contrats essentiels

- `MissionDefinitionRepository` : lire une définition active et sa version.
- `MissionAttemptRepository` : démarrer, reprendre, enregistrer une étape, terminer ou abandonner.
- `EvidenceStore` : stocker un flux local, retourner un identifiant opaque, taille, type et SHA-256.
- `EvidenceRepository` : relier preuve, tentative, compétence et classification.
- `AssessmentService` : produire une évaluation explicable; distinguer auto-évaluation et évaluation.
- `CompetencyLedger` : appliquer une transition seulement avec preuve et règle identifiées.
- `ReviewScheduler` : calculer une prochaine révision à partir d’une politique versionnée.
- `SpeechToTextPort` et `LearningModelPort` : appels externes optionnels et audités.
- `NotebookLMTaskPort` : préparer une opération contrôlée sans l’exécuter par défaut.

## 6. Flux du premier vertical slice

Le vertical slice est `EXCEL_CSV_FOUNDATIONS_LEVEL_1`.

1. Le tableau de bord propose une mission et affiche l’objectif, la durée et les conditions.
2. Le runtime crée une tentative liée à une définition versionnée.
3. L’apprenant consulte une démonstration courte, puis importe le CSV dans Excel.
4. Il charge sa preuve locale et décrit les étapes sans tutoriel.
5. Le système valide le type/la taille, calcule l’empreinte et stocke la preuve localement.
6. Une grille explicite produit une évaluation; l’assistance reste séparée du score.
7. Le ledger de compétences enregistre la transition et sa justification.
8. Le moteur programme une révision ou le niveau suivant.

Ce flux doit être testable par un utilisateur dès T-0009; aucune plateforme générale ne doit être construite avant cette preuve.

## 7. État et événements

États d’une tentative :

```text
DRAFT -> READY -> IN_PROGRESS -> PAUSED -> IN_PROGRESS
                              -> SUBMITTED -> ASSESSED -> COMPLETED
                              -> ABANDONED
```

Chaque transition possède : acteur, horodatage, ancienne/nouvelle valeur, raison et version du contrat. Les événements d’audit sont immuables; les projections de progression sont recalculables.

## 8. Intégrations externes

- Mode par défaut : `LOCAL_ONLY`, réseau non requis pour une mission essentielle.
- Chaque adaptateur externe annonce fournisseur, données sortantes, finalité, rétention connue et consentement.
- L’échec d’un service IA ne bloque pas la saisie manuelle ni le dépôt d’une preuve.
- NotebookLM reste `MANUAL_ASSISTED` et soumis à la gouvernance existante.
- Les outils open source retenus sont pilotes isolés; aucun schéma canonique ne dépend d’eux.

## 9. Déploiement V1

Une instance locale, un utilisateur initial, SQLite et un répertoire de preuves sous une racine configurable. L’accès LAN/public, le multi-utilisateur et la synchronisation cloud sont hors périmètre tant qu’une authentification et une revue de menace adaptées ne sont pas approuvées.

## 10. Décisions différées

- Authentification locale minimale ou profil unique explicite : trancher dans T-0006.
- Politique de chiffrement au repos des preuves : trancher avant T-0010.
- Fournisseur ASR/LLM : aucun fournisseur imposé par l’architecture.
- Letta : uniquement si un test démontre une lacune de la mémoire structurée.
- AFFiNE/PenEcho/DeepTutor : aucun couplage avant leur ticket d’audit/pilote.

## 11. Critères de sortie architecture

- Les frontières de modules et leurs propriétaires sont identifiés.
- Le premier vertical slice traverse UI, runtime, preuve, évaluation et compétence.
- Le stockage local et les adaptateurs externes sont séparés.
- Une reprise après interruption est possible sans perdre une tentative validée.
- Les données existantes sont préservées par migrations additives et retour arrière documenté.
- Aucun choix open source n’est une dépendance bloquante de T-0009.

