# Engineer Learning OS V1 — Complete Build Roadmap

Programme : `ENGINEER_LEARNING_OS_V1`  
Mode de ce document : `PLAN_ONLY`  
Nombre de phases de build : **16** (`T-0006` à `T-0021`).

## 1. Objectif et règles d’exécution

Transformer progressivement Daily English Mission en un OS d’apprentissage d’ingénieur local-first. La priorité n’est pas la quantité de fonctionnalités : c’est un cycle fiable `mission -> action -> preuve -> évaluation -> compétence -> révision`.

Contraintes permanentes : réutiliser l’existant avant remplacement, données personnelles hors Git, datasets synthétiques par défaut, aucune dépendance/install/IA sans ticket et approbation, migrations réversibles, tests proportionnés, test utilisateur précoce.

## 2. Chemin critique

```text
T-0006 -> T-0007 -> T-0008 -> T-0009 -> T-0010 -> T-0011
                                               |          |
                                               v          v
                                            T-0012 -> T-0013 -> T-0014
                                                          |
                                                          v
T-0015 -> T-0016 -> T-0017 -> T-0018 -> T-0019 -> T-0020 -> T-0021
```

T-0012 peut être préparé après T-0010, mais la progression de compétence doit rester cohérente avec T-0011. Aucun pilote externe ne bloque le vertical slice.

## 3. Jalons

| Jalon | Tickets | Résultat |
|---|---|---|
| M1 Fondation expérience | T-0006 à T-0008 | Shell et runtime générique testables |
| M2 Première valeur | T-0009 | Excel CSV Niveau 1 utilisable de bout en bout |
| M3 Preuve et rétention | T-0010 à T-0011 | Compétences justifiées et révisions |
| M4 Capacités avancées | T-0012 à T-0014 | Audio, maîtrise profonde, professionnel |
| M5 Sources et pilotes | T-0015 à T-0019 | Intégrations évaluées et contrôlées |
| M6 Production locale | T-0020 à T-0021 | Hardening, restauration et acceptation V1 |

## 4. Tickets

### T-0006 — Product, UX and Architecture Foundation

Objectif : convertir les présents documents en décisions exécutables et maquettes légères.

- Prérequis : master plan approuvé.
- Livrables : ADR du monolithe modulaire, cartes de flux, inventaire des routes/composants, modèle de menace, décision profil unique/auth, backlog vertical slice et wireframes testables.
- Acceptation : contrats, états et responsabilités sans ambiguïté; revue des risques; aucune application générale construite.
- Tests/preuves : revue documentaire, walkthrough utilisateur du shell et du parcours Excel.
- Rollback : documents seulement; retirer les ADR non approuvées.

### T-0007 — App Shell and Navigation

Objectif : créer le shell réutilisable sans casser Daily English Mission.

- Prérequis : T-0006 accepté.
- Livrables : layout local, navigation Aujourd’hui/Apprendre/Réviser/Matières/Professionnel/Preuves/Progression, états vide/chargement/erreur, metadata locale.
- Acceptation : navigation clavier/mobile, route legacy accessible, aucun appel réseau nouveau.
- Vérification : tests composants ciblés, lint/typecheck, test utilisateur de repérage.
- Rollback : feature flag ou route shell retirée, legacy intact.

### T-0008 — Interactive Mission Runtime

Objectif : exécuter une définition de mission générique avec pause/reprise.

- Prérequis : shell stable; modèle d’état validé.
- Livrables : définitions versionnées, tentative/étapes, composants de pas, persistance, minuteur, assistance, reprise.
- Acceptation : mission synthétique complète, transitions invalides refusées, refresh sans perte.
- Vérification : tests unitaires de machine d’état, contrats API, intégration Prisma et e2e minimal.
- Rollback : migrations additives et bascule vers l’expérience legacy.

### T-0009 — Excel CSV Foundations Level 1 Vertical Slice

Objectif : livrer le premier parcours réel issu de T-0005.

- Prérequis : T-0008; supports locaux T-0005; Excel déjà installé chez l’apprenant.
- Livrables : démonstration/import guidé, CSV huit lignes, contrôle de délimiteur/types/anomalie, preuve, explication et auto-évaluation.
- Acceptation : colonnes correctement séparées, fichier sauvegardé, anomalie identifiée, étapes expliquées sans tutoriel; données synthétiques uniquement.
- Vérification : test réel chronométré; test held-out court; absence d’answer key dans le client.
- Rollback : désactiver la définition de mission, conserver la tentative et les preuves locales.

### T-0010 — Evidence and Competency Foundation

Objectif : relier une preuve locale évaluée à une compétence.

- Prérequis : vertical slice observé.
- Livrables : stockage de preuves, métadonnées, grilles versionnées, évaluations, auto-évaluation, ledger de compétences, vues Preuves/Progression.
- Acceptation : transition reconstruite depuis une preuve; suppression et contrôle de chemin testés; score et confiance séparés.
- Vérification : tests upload adversariaux, intégrité SHA-256, transactions et e2e de dépôt.
- Rollback : sauvegarde DB/fichiers et migrations additives.

### T-0011 — Error Patterns and Review Engine

Objectif : transformer les erreurs en prochaines activités bornées.

- Prérequis : compétence et évaluation fiables.
- Livrables : taxonomie d’erreurs, occurrences, politique de révision versionnée, file Réviser, recommandations expliquées.
- Acceptation : division par zéro et mauvais délimiteur créent des révisions distinctes; pas de score global opaque.
- Vérification : horloge contrôlée, tests de politique et scénarios de reprise.
- Rollback : désactiver le scheduler; données d’évaluation inchangées.

### T-0012 — Audio and Professional English

Objectif : produire une preuve orale contrôlée sans imposer un service externe.

- Prérequis : stockage de preuve et modèle de consentement.
- Livrables : capture/lecture locale, notes, conservation/suppression, consentement ASR, transcription manuelle et adaptateur optionnel.
- Acceptation : parcours complet hors ligne; refus ASR sans blocage; audio privé jamais journalisé.
- Vérification : permissions, formats, limites, annulation, tests navigateurs ciblés.
- Rollback : désactiver l’adaptateur; lecture locale maintenue.

### T-0013 — Deep Mastery

Objectif : vérifier une compréhension transférable par questions progressives.

- Prérequis : runtime, preuves et erreurs.
- Livrables : protocole définition/fonctionnement/exemple/limite/transfert, questions bornées, critères et arrêt fatigue.
- Acceptation : résultat explicable, nombre de tours plafonné, option humaine/locale.
- Vérification : fixtures synthétiques, adversarial prompt, cohérence des rubriques.
- Rollback : revenir aux missions statiques sans perdre les preuves.

### T-0014 — Professional Scenarios

Objectif : entraîner les livrables et décisions de chef de projet.

- Prérequis : runtime et évaluations.
- Livrables : scénarios synthétiques, structure FACT/ASSUMPTION/RISK/ACTION/DECISION_REQUIRED, responsabilités/échéances, grilles.
- Acceptation : livrable concis, faits séparés, décision claire, nouvelle situation held-out.
- Vérification : tests de schéma et revue humaine.
- Rollback : désactiver les scénarios versionnés concernés.

### T-0015 — Knowledge and Source Pipeline

Objectif : cataloguer sources, droits, concepts et provenance; piloter un livre-vers-skill.

- Prérequis : architecture de données et sécurité sources.
- Livrables : catalogue, import local, classification/licence/checksum, provenance, pilote `book-to-skill` TCP/UDP sur source autorisée.
- Acceptation : aucune source `UNKNOWN`; concept traçable; pilote comparé à une création manuelle et supprimable.
- Vérification : fichiers malveillants, droits, duplication, sortie réseau bloquée sans approbation.
- Rollback : supprimer artefact dérivé; source canonique inchangée.

### T-0016 — DeepTutor Audit and Decision

Objectif : décider si des patterns ou composants de DeepTutor apportent un bénéfice net.

- Prérequis : capacités internes observables jusqu’à T-0015.
- Livrables : analyse composants/licence/dépendances/données, mapping des chevauchements, mini-spike hors données personnelles si justifié, ADR.
- Acceptation : décision `BORROW_PATTERN`, `PILOT` ou `REJECT` avec coût, menace et rollback; aucune adoption wholesale implicite.
- Vérification : reproductibilité et isolation.
- Rollback : supprimer le spike; aucun schéma canonique dépendant.

### T-0017 — AFFiNE and PenEcho Isolated Pilots

Objectif : évaluer respectivement organisation/canvas et raisonnement spatial.

- Prérequis : revue exacte licences/versions, threat model, métriques.
- Livrables : protocoles isolés, données synthétiques, export/import, observations utilisateur; aucun branchement production par défaut.
- Acceptation : loopback, secrets isolés, suppression/export vérifiés, bénéfice comparé au coût.
- Vérification : ports exposés, trafic, fichiers créés, désinstallation.
- Rollback : arrêter les processus et supprimer répertoires de pilote explicitement résolus.

### T-0018 — Memory Gap Evaluation and Letta Decision

Objectif : déterminer si la mémoire structurée interne est insuffisante.

- Prérequis : historique réel de missions/révisions et critères de gap.
- Livrables : benchmark de rappel/explicabilité/coût, pilote Letta uniquement si gap, ADR.
- Acceptation : SQLite reste autorité; données de test synthétiques; gain mesurable indispensable.
- Vérification : suppression, reconstruction et comportement sans service.
- Rollback : retirer l’adaptateur et reconstruire les vues depuis le canonique.

### T-0019 — Controlled NotebookLM UX

Objectif : rendre le workflow `MANUAL_ASSISTED` compréhensible sans automatisation cachée.

- Prérequis : gouvernance NotebookLM, catalogue de sources et consentement.
- Livrables : écran de préparation affichant sources/classifications/objectif/prompt/destination/action active; journal d’opération; alternatives locales.
- Acceptation : aucune exécution sans approbation précise; `UNKNOWN` bloque; activité active obligatoire après support.
- Vérification : tests de gate et cas interdits; aucun upload automatique groupé.
- Rollback : désactiver l’adaptateur, conserver préparation locale.

### T-0020 — Hardening, Privacy and Recovery

Objectif : fermer les risques connus avant acceptation.

- Prérequis : features V1 gelées.
- Livrables : proxy local sûr, erreurs TypeScript bloquantes, validation uploads, secrets/logs, sauvegarde/restauration, dépendances, tests sécurité/régression.
- Acceptation : aucun risque critique ouvert; restauration prouvée; modes externes désactivés par défaut; aucun fichier sensible suivi.
- Vérification : lint, typecheck, build, tests unit/intégration/e2e/adversarial/security et revue manuelle.
- Rollback : sauvegarde complète et plan par migration/configuration.

### T-0021 — V1 Acceptance and Learning Validation

Objectif : démontrer la valeur et la sûreté du système complet.

- Prérequis : T-0020 PASS.
- Livrables : scénario d’acceptation, test utilisateur Excel held-out, reprise, preuve, révision, audio local, rapport limites et backlog V1.1.
- Acceptation : cycle complet reproductible, données contrôlées, progression explicable, aucun outil externe nécessaire, critères utilisateurs atteints.
- Vérification : essai de restauration, inspection Git, test sans réseau et dossier de preuves.
- Rollback : revenir à la dernière release locale stable et restaurer le snapshot validé.

## 5. Stratégie de test

| Couche | Contrôle minimal |
|---|---|
| Domaine | états, règles de score, ledger, révision, temps contrôlé |
| Application | transactions, idempotence, autorisations, ports en échec |
| Infrastructure | migrations, chemins, tailles/MIME, sauvegarde/restauration |
| UI | clavier, reprise, erreurs, responsive, consentement |
| E2E | une mission locale complète et une reprise |
| Sécurité | traversal, CSV injection, secret scan, sortie réseau, answer key |
| Pédagogie | test utilisateur, exercice held-out, explication sans tutoriel |

## 6. Registre des risques programme

| Risque | Signal | Réponse |
|---|---|---|
| Construire trop avant validation | T-0009 retardé | geler les abstractions et tester le vertical slice |
| Régression Daily English Mission | routes legacy cassées | feature flag, tests de non-régression, migrations additives |
| Fuite de données personnelles | fichier suivi ou egress inattendu | arrêt `DATA_EXPOSURE_RISK`, isolation et revue |
| Intégration tierce dominante | schéma/runtime imposé | ports, pilote jetable, kill criteria |
| Progression opaque | score sans preuve | ledger et rubriques versionnées |
| Fatigue utilisateur | abandons/temps anormal | pause, sessions courtes, reprise et mesure |
| Migration non restaurable | backup non testé | bloquer activation tant que restauration échoue |

## 7. Condition de démarrage

Le prochain ticket est `T-0006 — Product, UX and Architecture Foundation`. Il nécessite une approbation humaine distincte en mode `IMPLEMENT`. Ce plan n’autorise ni modification applicative, ni installation, ni migration, ni commit/push.

