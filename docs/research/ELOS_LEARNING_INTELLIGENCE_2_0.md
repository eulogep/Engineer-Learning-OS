# ELOS Learning Intelligence 2.0 — recherche, analyse d’écarts et architecture

Programme `ENGINEER_LEARNING_OS_V1` · mission `GLOBAL_LEARNING_PLATFORM_RESEARCH_AND_UPGRADE` · octobre 2026.

Statut des affirmations : **[V]** vérifié dans une source officielle ou dans le code, **[S]** source secondaire (presse, revue,
fiche de store), **[H]** hypothèse à tester. Ce document ne constitue pas une preuve d’amélioration des résultats scolaires :
les gains pédagogiques restent à mesurer avec de vrais apprenants (voir §9).

---

## 1. Phase A — Audit de l’existant

Base auditée : `main` public (`6eef300`), qui contient tous les modules de la branche locale privée et les fonctions
récentes (reconnaissance vocale locale, sauvegarde Daily English, CI). La branche privée `main` locale diverge
(34 commits non publiés, 36 en retard) : à réconcilier par une décision humaine.

| Domaine | Ce qui existe déjà [V] | Où |
|---|---|---|
| Historique canonique | Événements canoniques, EventIds, IndexedDB autorité locale, export/restauration vérifiés par empreintes, outbox | `learning-history` (37 fichiers) |
| Synchronisation | Supabase limitée aux métadonnées autorisées, identité liée, diagnostics | `learning-history/remote` |
| Maîtrise | États `NOT_SEEN → INTRODUCED → FRAGILE → PRACTICED → DEMONSTRATED → RETAINED`, dérivés uniquement de preuves (`SUCCESSFUL_GUIDED` → PRACTICED, `SUCCESSFUL_TRANSFER` → DEMONSTRATED) | `learning-records/core.ts` |
| Politiques scientifiques | SCI-001 planificateur fondé sur les preuves, SCI-002 calibration de confiance, SCI-003 échafaudage dégressif, SCI-004 entrelacement contrastif, SCI-005 auto-explication et transfert, SCI-006 graphe de dépendances ; simulation de planificateurs (`CURRENT_V1`, `FSRS_COMPATIBLE_BASELINE`, `ELOS_CONTEXT_AWARE`) | `scientific-pedagogy` |
| Sources et cours | Classification, ingestion PDF/DOCX/MD, extraction page par page, sections `DERIVED_MATERIAL` non canoniques, quiz sourcés (page, section) plafonnés à `PRACTICED`, remédiation, contrat `AskCourseAnswer` + vérificateur `askCourseAnswerIsGrounded`, interface `AIProvider` (aucun fournisseur configuré) | `academic-workspace`, `source-engine`, `document-extraction` |
| Révision | Patterns d’erreur, éléments de révision traçables | `review-engine` |
| Missions | Runtime de mission, Excel CSV (niveaux, épreuve indépendante), scénarios professionnels, apprentissage visuel, maîtrise profonde | `mission-runtime`, `held-out-excel`, `professional-scenarios`, `visual-learning`, `deep-mastery` |
| Anglais | Daily English (150 mots, 5 packs, Leitner, sauvegarde), anglais technique (preuves audio), reconnaissance vocale Whisper sur l’appareil + score de prononciation | `daily-english`, `technical-english`, `local-speech` |
| NotebookLM | Pont d’automatisation local désactivé par défaut, gate d’approbation humaine | `notebooklm` |
| Semestre | État académique du semestre, priorités | `current-semester` |
| Réservés (dossiers vides) | `competency-map`, `learning-planner`, `practice-engine`, `learning-memory`, `evidence-and-assessment`, `knowledge-catalog`, `english-in-the-loop`, `daily-mission`, `soufflet-readiness` | — |

**Tests** : 65 fichiers, 565 tests avant cette mission (unitaires, intégration Chrome réel, sécurité). **Bibliothèque `knowledge/`** :
sur `main`, uniquement un index d’exemple et un catalogue ; les documents réels restent locaux (non versionnés).
**Hors ligne** : pas de service worker ; les pages chargées fonctionnent sans réseau grâce au stockage local.
**Confidentialité** : aucune IA externe active par défaut (ZAI désactivé, NotebookLM sous gate, Whisper sur l’appareil).

## 2. REA (Reverse Engineer Anything)

- Dépôt : <https://github.com/morluto/rea> · paquet `rea-agents` 6.7.0 · licence **MIT** [V].
- Capacités [V] : serveur MCP + CLI ; binaires natifs (Hopper/Ghidra/IDA), JS/Electron, .NET, APK, captures réseau,
  observation de sites via Chrome DevTools Protocol. Analyse locale, sorties structurées avec preuves et inconnues.
- Prérequis [V] : Node ≥ 22.19 ; outils tiers pour le natif. `rea-agents setup` **modifie la configuration des agents**
  → non exécuté (interdit sans autorisation). Usage isolé : installation locale dans un dossier temporaire.
- Usage légal [V] : « logiciel que vous possédez ou êtes autorisé à examiner ». Aucun produit concurrent n’autorise
  l’analyse de son front-end → **REA n’a été utilisé que sur ELOS lui-même**.
- Essai réel sur la démo ELOS : `/presentation` → 21 scripts (1,3 Mo) analysés, empreintes Next.js/React, routes,
  candidats d’endpoint de faible confiance. `/daily-english` → arrêt sur saturation mémoire (4 Go).
- Limites déclarées par REA lui-même : pas d’exécution du JavaScript capturé, comportement serveur inconnu.
- **Décision** : valeur faible pour la conception pédagogique (REA cartographie du code, pas une pédagogie) ; ne pas
  l’utiliser sur des produits tiers. Utile plus tard pour auditer les bundles ELOS (taille, routes, endpoints exposés).

## 3. Phase B — Benchmark

| Produit | Fonctions pédagogiques clés | Statut | Source |
|---|---|---|---|
| NotebookLM | Chat avec citations inline, Audio/Video Overviews, cartes mentales, flashcards et quiz générés depuis les seules sources, guides d’étude ; quotas journaliers | [V] | [Google for Education](https://edu.google.com/ai-notebooklm/) |
| NotebookLM Enterprise API | `notebooks.audioOverviews.create/delete`, **v1alpha, Preview**, projet Google Cloud requis ; ne couvre pas NotebookLM grand public | [V] | [Google Cloud docs](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview) |
| Gemini Guided Learning | Mode tutorat pas à pas (LearnLM), questions de vérification, plusieurs points d’entrée, simplifie après une erreur | [S] | [Tom’s Guide](https://www.tomsguide.com/ai/google-gemini/google-geminis-guided-learning-feature-makes-ai-actually-check-if-you-understand-heres-how-it-works), [Tech & Learning](https://www.techlearning.com/how-to/geminis-guided-learning-mode-from-google-ai-what-educators-need-to-know) |
| Anki | Deux planificateurs : SM-2 et **FSRS** (stabilité, difficulté, récupérabilité ; optimiseur sur l’historique ; rétention souhaitée) | [V] | [Anki FAQ](https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm.md) |
| RemNote | Annotation de PDF → cartes, révision espacée, planificateur d’examen, cartes inline | [S] (marketing) | [remnote.com](https://remnote.com), [PDF to cards](https://remnote.com/pdf_to_cards) |
| Quizlet / Knowt | Modes Learn/Test/Match ; Knowt : cartes et examens blancs depuis notes, PDF, vidéos | [S] | [Knowt (App Store)](https://apps.apple.com/US/app/id6463744184), [comparatif](https://www.youlearn.ai/blogs/best-ai-flashcard-makers-quiz-generators-studying) |
| Duolingo Max | *Explain My Answer*, *Roleplay* (scénarios écrits par des humains), *Video Call* | [V] | [blog Duolingo](https://blog.duolingo.com/duolingo-max) |
| Khanmigo | Tuteur socratique qui retient la réponse ; preuves d’efficacité surtout anecdotiques | [S] | [revue](https://www.kidsaitools.com/en/articles/review-khan-academy-khanmigo) |
| Brilliant | Problèmes interactifs ; tuteur *Koji* qui voit l’écran et guide par étapes | [V] | [Brilliant help](https://brilliant.org/help/features) |
| Coursera Coach | Dialogues socratiques (Gemini), configuration par l’enseignant ; +9,5 % de réussite au 1er essai (chiffre Coursera) | [V] chiffre non indépendant | [Coursera blog](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction) |
| Kartable (FR) | Tuteur IA « Alfa », quiz depuis photos de cours, tableau parents ; payant | [S] | [Pass Éducation](https://www.pass-education.fr/impact/acteur/kartable/) |
| Nomad Education (FR) | Fiches, quiz ; Nomad’IA « ne fait pas les devoirs » | [V] | [Nomad Education](https://www.nomadeducation.fr/blog/articles/2025-11-12/nomadia-ia-educative-revisions-sur-mesure) |
| Asie (Gauth, Qanda, Speak) | Aide aux devoirs par photo / conversation | [H] recherche insuffisante | — |

## 4. Analyse par fonctionnalité

| Fonction | Parcours | Bénéfice supposé | Preuves | Coût / contraintes | Confidentialité | Faisabilité ELOS | Indicateur | Priorité |
|---|---|---|---|---|---|---|---|---|
| Réponses sourcées avec citations | Question → réponse → clic citation → passage | Réduit hallucinations, ancre dans le cours | [V] contrat existant | Local : nul | Local | **Fait (prototype)** | % réponses dont toutes les citations se vérifient | P0 |
| Tuteur socratique + indices gradués | Question → effort → indices 1-3 → réponse | Évite l’effet « béquille » | Bastani 2025, Kestin 2025 [V] | Local : nul ; IA : coût | IA externe = accord explicite | **Fait (prototype, déterministe)** | Score au test **sans aide** | P0 |
| Flashcards depuis les sources | Définitions → cartes → révision espacée | Rappel actif + espacement | Roediger & Karpicke 2006 ; Cepeda 2006 [V] | Nul | Local | **Fait (extraction)** | Rétention à J+7/J+30 | P0 |
| Quiz / examen blanc | QCM dérivés, correction citée | Entraînement à la récupération | idem | Nul | Local | **Fait (quiz)** ; examen blanc chronométré à faire | Écart quiz assisté / non assisté | P1 |
| Fiche de révision, carte mentale | Synthèse structurée par page | Organisation (bénéfice faible seul) | Dunlosky 2013 : résumé = faible utilité [V] | Nul | Local | **Fait** | Usage réel, non la maîtrise | P2 |
| Méthode Feynman | Expliquer → idées clés couvertes/manquantes | Auto-explication (SCI-005) | Chi et al. [V] | Nul | Local | **Fait (couverture lexicale)** | Couverture puis réussite en transfert | P1 |
| FSRS | Planification par modèle mémoire | Moins de révisions pour même rétention | Anki/FSRS [V] | Lib open source | Local | **Expérimental** (simulation SCI-001 existe) | Révisions/rétention sur historique réel | P1 |
| Audio Overview | Synthèse audio des sources | Accessibilité, mobilité | Peu d’études [H] | TTS local limité ; NotebookLM Enterprise payant | Sources envoyées si externe | **Plan** (local `speechSynthesis` d’abord) | Écoute complétée + quiz ensuite | P2 |
| Conversations immersives (anglais) | Jeu de rôle oral corrigé | Pratique productive | Duolingo [V] (efficacité non publiée) | ASR local fait ; dialogue = LLM | Audio local OK, LLM externe = accord | **Partiel** (ASR + prononciation faits) | Prononciation, mots réemployés | P1 |
| Graphe de prérequis | Lacune → prérequis → activité | Remédiation ciblée | SCI-006 [V] | Nul | Local | **Améliorer** (lier Studio ↔ SCI-006) | Taux de déblocage après remédiation | P1 |
| Annotations PDF | Surligner, noter dans la visionneuse | Lecture active | [H] | Moyen (pdf.js existe) | Local | **À construire** | Annotations → cartes | P2 |
| Photo de devoir → réponse | Résoudre à la place | Contre-productif sans garde-fou | Bastani 2025 [V] | — | Données personnelles | **Rejeté** | — | — |

## 5. Phase C — Analyse d’écarts

- **EXISTS** : historique canonique, export/restauration, sync Supabase restreinte, états de maîtrise par preuves, SCI-001→006,
  quiz sourcés, remédiation, Leitner, ASR local, prononciation, sauvegarde Daily English.
- **IMPROVE** : contrat `AskCourseAnswer` sans fournisseur → *fournisseur local livré par le Studio* ; SCI-006 non relié aux outils ;
  planificateurs multiples (Daily English Leitner, SCI-001) → à unifier derrière une interface.
- **BUILD** : Learning Studio (fait, prototype), examen blanc chronométré, annotations, import réel vers le Studio
  (depuis `academic-workspace`), liaison des tentatives non assistées vers les preuves canoniques.
- **EXPERIMENTAL** : FSRS sur données réelles, tuteur LLM local (WebGPU) ou externe avec accord, Audio Overview locale.
- **REJECT** : résolution de devoirs par photo, maîtrise attribuée par un résumé IA, API NotebookLM non documentées,
  analyse de produits tiers par REA.

## 6. NotebookLM et Gemini

| Fonction | API officielle ? | Portée | Autorisé ? | Coût | Recommandation |
|---|---|---|---|---|---|
| Notebooks, sources, chat cité | Non pour la version grand public [V] | Enterprise seulement (Gemini Enterprise) | Oui via Google Cloud | Licence Enterprise | **Natif ELOS** (fait) |
| Audio Overview | `notebooks.audioOverviews.create` **v1alpha Preview** [V] | NotebookLM Enterprise | Oui, contrat Cloud | Projet Cloud ; prix non publiés sur la page | Fournisseur optionnel P2 ; local d’abord |
| Podcast API | Endpoint séparé, rôle *Podcast API User* [V] | Google Cloud | Oui | Payant [H] | Idem |
| Flashcards, quiz, mind map | Pas d’API publique trouvée [V] | — | — | — | **Natif ELOS** (fait) |
| Gemini Guided Learning | Mode de l’app, pas d’API dédiée [S] | — | — | — | Reproduire le **principe** (fait : socratique) |
| Gemini API (modèles) | Oui (API publique) | Développeurs | Oui | Gratuit limité / payant | Fournisseur externe **optionnel**, accord explicite par opération |

Règles : jamais d’API privée ou non documentée ; le pont NotebookLM local existant reste sous gate humaine
(AGENTS.md) ; aucun document personnel envoyé sans accord explicite.

## 7. Phase D — Architecture

Pipeline (inchangé pour le canonique, additif pour le Studio) :
**Sources originales → extraction vérifiée (`academic-workspace`) → passages cités (Studio) → activités dérivées
(`DERIVED_MATERIAL`, `canonical: false`) → tentatives → [futur] tentatives non assistées validées → événements canoniques
→ projections de maîtrise → recommandations.**

Séparation des données : originaux (local, non versionnés) · extraits (pages/sections) · connaissances structurées
(concepts validés) · contenus générés (cartes, quiz, fiches : dérivés) · résultats observés (tentatives Studio
`DERIVED_PRACTICE`) · évaluations de maîtrise (canoniques, règles `learning-records` uniquement).

Modes de fournisseur (interface `AIProvider` existante) :
1. **Local déterministe** (livré) : BM25 + extraction de phrases, zéro réseau.
2. **Natif ELOS enrichi** (P1) : modèle local dans le navigateur (WebGPU), même contrat, mêmes vérifications de citations.
3. **Externe autorisé** (P2) : Gemini API / NotebookLM Enterprise, activé par opération avec affichage des sources
   envoyées, classification bloquante (`UNKNOWN` = refus), journal local.

Toute réponse, quel que soit le fournisseur, passe par `askCourseAnswerIsGrounded` **et** `verifyCitation`
(citation verbatim), sinon elle est affichée comme non sourcée.

### Feuille de route

- **P0 (fait dans cette mission)** : Learning Studio local, réponses citées vérifiables, mode socratique à indices gradués,
  Feynman, fiche, flashcards + plan de révision, quiz dérivé, carte mentale, tableau des difficultés, tests.
- **P1 (fait)** : import des cours personnels (PDF via pdf.js local, Markdown, texte) en IndexedDB, classés `PERSONAL` ;
  examen blanc chronométré sans aide, entrelacé entre cours (SCI-004), confiance déclarée et calibration (SCI-002) ;
  écoute de la fiche avec voix **locales** uniquement.
- **P1 (reste)** : brancher le Studio sur les sources d’`academic-workspace` ; décider si une réussite à l’examen
  blanc peut devenir une preuve canonique *via* les règles existantes (décision humaine) ; relier difficultés ↔
  SCI-006 ; évaluer FSRS sur historique réel contre `CURRENT_V1` ; tuteur LLM local (WebGPU) derrière le même contrat.
- **Fait ensuite** : parcours des prérequis pour chaque notion difficile (SCI-006 adapté aux cours importés : relation
  déduite quand une définition cite une autre notion, citation comme provenance, parcours via `prerequisitePath`,
  confusions SCI-006 réutilisées) ; **OCR local** des PDF scannés (tesseract.js, modèle français, worker, cœur
  WebAssembly et données servis par l’app, lancé uniquement sur demande, pages marquées « à vérifier »).
- **P2** : annotations PDF ; Audio Overview étendue puis fournisseur Enterprise optionnel ;
  conversations orales immersives (anglais) ; mode hors ligne complet (service worker).

## 8. Fondements scientifiques et limites

- **Rappel actif** : tester renforce la rétention davantage que relire (Roediger & Karpicke, 2006 ; Dunlosky et al., 2013 :
  pratique de récupération et espacement = « haute utilité »). Limite : effet mesuré surtout sur matériel verbal.
- **Espacement** : Cepeda et al. (2006, méta-analyse) ; FSRS opérationnalise un modèle de mémoire (Anki).
  Hypothèse ELOS : les intervalles Leitner actuels sont un point de départ, pas un optimum.
- **Entrelacement** : bénéfice surtout pour discriminer des notions proches (Rohrer) → SCI-004 existant.
- **Échafaudage et IA** : un tuteur GPT sans garde-fous améliore la pratique (+48 %) mais **dégrade l’examen sans aide
  (−17 %)** ; avec garde-fous (indices, pas de réponse directe), pas de perte (Bastani et al., PNAS 2025) [V]. Un tuteur
  conçu selon des principes pédagogiques a doublé les gains face à un cours actif sur un essai (Kestin et al.,
  Scientific Reports 2025, n = 194, un seul cours) [V]. → Le Studio commence par le **socratique** et garde la réponse
  pour la fin ; la maîtrise ne s’appuie que sur des tentatives **non assistées**.
- **Auto-explication** (Chi et al.) → Feynman ; limite : la couverture lexicale ne mesure pas la compréhension.
- **Résumés et cartes mentales** : faible utilité seuls (Dunlosky 2013) → présentés comme supports, jamais comme preuve.

Sources : [Bastani et al., PNAS 2025](https://papers.ssrn.com/abstract=4895486) ·
[Kestin et al., Sci. Rep. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/) · Roediger & Karpicke (2006),
*Psychological Science* 17(3) · Dunlosky et al. (2013), *Psychological Science in the Public Interest* 14(1) ·
Cepeda et al. (2006), *Psychological Bulletin* 132(3) · Chi et al. (1994), *Cognitive Science* 18(3).

## 9. Phase E–G — Prototype et bilan

Prototype : route `/studio`, module `src/modules/learning-studio` (types, documents **synthétiques**, cœur pur),
interface `src/components/learning-studio`. Fournisseur **local** du contrat `AskCourseAnswer`.

Gains **fonctionnels démontrés** (tests) : réponses dont 100 % des citations se vérifient mot pour mot dans le passage
cité ; refus explicite hors sources ou hors sélection ; aucune écriture canonique (test statique d’imports + attempts
`DERIVED_PRACTICE` non canoniques) ; parcours complet hors ligne ; aucune requête externe ; accessibilité de base
(noms accessibles, champs étiquetés, régions nommées) ; pas de défilement horizontal sur mobile.

**Non démontré, à tester avec de vrais apprenants** : effet sur la rétention (J+7/J+30), sur la réussite en test
**non assisté**, qualité perçue des réponses extractives vs génératives, utilité du Feynman lexical, charge cognitive
de l’interface trois colonnes.

Limites du prototype : réponses extractives (pas de reformulation), extraction de définitions par motifs
(« X est… », « X sert à… ») adaptée à des cours bien rédigés, OCR limité au français et sensible à la qualité du scan, pas d’annotations,
pas de service worker.

Leçons d’implémentation (vérifiées par les tests) : un seuil BM25 absolu échoue sur de petits documents personnels
(IDF quasi nul) → la répondabilité repose sur la couverture des termes de la question ; pdf.js extrait les ligatures
typographiques en fragments (« modi fi er ») → réparées avant découpage ; les voix « en ligne » du navigateur
enverraient le texte à un service externe → seules les voix `localService` sont utilisées.
