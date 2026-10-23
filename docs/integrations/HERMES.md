# ELOS dans Hermes Agent (MCP)

ELOS expose ses outils d’étude à un agent local via un serveur MCP en stdio : `mcp/elos-server.ts`.
Aucun accès réseau ; les modules utilisés sont ceux de l’application (Studio, Daily English, évaluateur FSRS).

| Outil | Rôle |
|---|---|
| `elos_ask_sources` | Réponse composée uniquement de phrases citées des cours (page / section) ; mode `socratic` (question + indices) |
| `elos_study_pack` | Flashcards, quiz, fiche, script de résumé audio, parcours de prérequis (dérivés, jamais de maîtrise) |
| `elos_correct_english` | Correction locale des erreurs fréquentes des francophones, explications en français |
| `elos_roleplay` | Jeux de rôle oraux écrits à la main (stand-up, incident, entretien), évaluation locale |
| `elos_vocabulary` | Vocabulaire Daily English (150 mots, 5 packs) |
| `elos_compare_schedulers` | Rejeu de journaux de révision : FSRS-4.5 vs Leitner ELOS |
| `elos_today` | Quoi faire aujourd’hui : mission Daily English, mots et cartes dus, difficultés, examen proche |
| `elos_progress` | Série de jours, mots vus / maîtrisés, charge des 7 prochains jours, comparaison FSRS sur ton historique |
| `elos_exam_plan` | Compte à rebours des examens et séances de révision espacées (J-14, J-7, J-3, J-1) |
| `elos_course_map` | Programme (matières, chapitres) d’une base pédagogique : objectifs, prérequis, exemple, analogie, erreurs fréquentes, contrôle qualité |
| `elos_course_exercise` | Par défaut, QCM construit depuis tes propres cours du chapitre (citation page, mauvaises réponses tirées de la même matière, questions ratées en priorité) ; sinon exercice de la base. Correction seulement après ta réponse ; journal d’entraînement hors du dossier partagé, jamais compté comme maîtrise |

## Installation

```bash
REPO=~/Desktop/Developer/daily-english-mission
hermes mcp add elos --command "$(command -v node)" --args \
  --experimental-strip-types --no-warnings --import "$REPO/tests/register-loader.mjs" "$REPO/mcp/elos-server.ts"
hermes mcp test elos      # connexion + 11 outils
```

Dans une session Hermes déjà ouverte : `/reload-mcp`.

## Base pédagogique (programme)

`ELOS_BASE_DIR` désigne un dossier contenant une base extraite par sous-dossier
(`courses.json`, `exercises.json`, `flashcards.json`, schéma 1.0). Elle est traitée comme matériel dérivé :
synthèse générée, jamais source officielle ni preuve de maîtrise. À l’import, un contrôle qualité signale
et écarte les contenus inutilisables pour s’entraîner : QCM dont la bonne réponse est toujours la plus longue,
mauvaises réponses génériques réutilisées, cartes au verso identique, définitions recopiées, exercices sans source.
Les corrigés sortent du dossier partagé avec `npm run mcp:split-base -- <dossier de la base> <dossier privé>` :
`exercises.json` ne garde que les questions et le serveur lit les corrigés dans `ELOS_ANSWERS_DIR/<base>.json`
(droits 600). Hermes refuse de lire `config.yaml` avec son outil de fichiers, ce qui cache ce chemin, mais son
terminal tourne avec ton compte : c’est une protection contre la lecture accidentelle, pas une frontière de sécurité.

Questions citées : pour chaque chapitre, les notions du programme sont cherchées dans les définitions de tes
cours de la même matière (dossier dont le nom partage un mot avec la matière). Les intitulés parasites
(puces, débuts de proposition comme « Si… ») sont écartés. Quand un chapitre n’a pas de définition
« X est… » dans les cours (cas fréquent des diapositives), une phrase du cours qui emploie la notion est proposée
avec la notion masquée ; les mauvaises réponses sont les notions des autres chapitres de la même matière. Les
phrases retenues sont de vraies phrases (pas d’horodatage de transcription, de ligne de tableau, de code ni de
titres de diapositives collés), sans doublon, et un mot courant (« objet », « revue ») n’est demandé que si la
phrase partage un mot-clé avec le chapitre. Les réponses sont journalisées dans
`<cache>/practice-log.jsonl` (`DERIVED_PRACTICE`), hors du dossier partagé.

Retour vers l’application : après chaque réponse, le serveur écrit `elos-practice.json` à côté de
`ELOS_STATE_FILE` (format `engineer-learning-os/agent-practice` v1, des comptes par chapitre seulement).
ELOS le lit dans le dossier déjà partagé et l’affiche dans **Données → Agent local (Hermes)** comme
entraînement assisté ; il ne modifie aucun niveau de maîtrise et un fichier invalide est ignoré.

Le Studio propose le même import dans **Base pédagogique (programme)** ; seuls la carte du programme et le
rapport qualité y sont conservés, sur l’appareil.

## Ta progression (lecture seule)

Les trois derniers outils lisent un résumé écrit par l’application, jamais ta base :

1. Dans ELOS (Chrome ou Edge) : **Données → Agent local (Hermes) → Choisir le dossier partagé avec l’agent**
   (par exemple `~/ELOS-Hermes`). ELOS y écrit `elos-state.json` et le tient à jour tant que l’app est ouverte.
   Autres navigateurs : bouton « Télécharger elos-state.json ».
2. Indique ce fichier au serveur avec `--env ELOS_STATE_FILE=~/ELOS-Hermes/elos-state.json` (voir ci-dessous).

Le résumé contient : mots et cartes à réviser, difficultés, examens à venir, série de jours. Il ne contient jamais
tes phrases, transcriptions, notes, réponses ni passages de cours. Il ne permet pas d’écrire dans ELOS et n’accorde
aucune maîtrise. Un résumé de plus de 24 h est signalé comme ancien.

Limite : en mode SQLite local (serveur avec base), la mission Daily English est en base et n’apparaît pas dans le
résumé ; les révisions du Studio, elles, y sont.

## Confidentialité

Les résultats des outils sont envoyés par Hermes à **son** fournisseur de modèle. Par défaut le serveur n’utilise que les
documents synthétiques de démonstration. Pour l’ouvrir à tes cours, définis explicitement un dossier :

```bash
hermes mcp remove elos
hermes mcp add elos --command "$(command -v node)" \
  --env ELOS_SOURCES_DIR=/chemin/vers/mes-cours ELOS_STATE_FILE=$HOME/ELOS-Hermes/elos-state.json --args \
  --experimental-strip-types --no-warnings --import "$REPO/tests/register-loader.mjs" "$REPO/mcp/elos-server.ts"
```

Garde-fous : seuls `.pdf`, `.md`, `.txt` sous ce dossier ; `knowledge-private/`, fichiers secrets (`.env`, `*.secret`,
`*.private`) et chemins hors du dossier refusés ; 200 fichiers et 25 Mo par fichier au maximum ; PDF scannés ignorés.
N’y mets pas de documents d’entreprise internes, de données personnelles d’autrui ni de secrets.

Le serveur est lancé depuis ce dépôt : garde une branche qui contient `mcp/` (par exemple `main-public`).

## PDF scannés (OCR sur le Mac)

Sur macOS, le serveur lit aussi les PDF scannés grâce à l’OCR intégré (framework Vision, via `mcp/ocr-vision.swift`,
compilé une fois avec `swiftc`) : aucun téléchargement, aucun envoi. Le texte reconnu est mis en cache dans
`ELOS_CACHE_DIR` (par défaut `../.elos-cache` à côté du dossier de cours, jamais dans le dossier partagé) ; les
citations issues d’une page OCR portent la mention « verify against the page ». L’OCR se fait en arrière-plan
(la première question n’attend pas) ; pour tout préparer d’avance :

```bash
ELOS_SOURCES_DIR=~/ELOS-Hermes/cours npm run mcp:ocr
```

`ELOS_OCR=off` désactive l’OCR.

## Coach du matin (tâche planifiée Hermes, sans modèle)

`scripts/morning-coach.ts` construit chaque matin un message à partir du résumé : série, révisions dues, question de
rappel (difficulté principale), mot d’anglais du jour, réplique de jeu de rôle, compte à rebours d’examen. Aucun modèle
d’IA, aucun réseau : le message est écrit dans `coach-du-jour.md` à côté du résumé et affiché en notification macOS.

```bash
cat > ~/.hermes/scripts/elos-morning-coach.sh <<'SH'
#!/bin/bash
cd "$HOME/Desktop/Developer/daily-english-mission" || exit 1
ELOS_STATE_FILE="$HOME/ELOS-Hermes/elos-state.json" exec "$(command -v node)" --experimental-strip-types --no-warnings \
  --import ./tests/register-loader.mjs scripts/morning-coach.ts --notify
SH
chmod +x ~/.hermes/scripts/elos-morning-coach.sh
hermes cron create "0 8 * * *" --name "ELOS coach du matin" --script elos-morning-coach.sh --no-agent --deliver local
```

Avec une messagerie configurée dans Hermes (`hermes gateway setup`), remplace `--deliver local` par `telegram`,
`signal`… Le contenu (vocabulaire, jeux de rôle, intitulés de notions) est générique ; aucun passage de cours n’y figure.
