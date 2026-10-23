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

## Installation

```bash
REPO=~/Desktop/Developer/daily-english-mission
hermes mcp add elos --command "$(command -v node)" --args \
  --experimental-strip-types --no-warnings --import "$REPO/tests/register-loader.mjs" "$REPO/mcp/elos-server.ts"
hermes mcp test elos      # connexion + 6 outils
```

Dans une session Hermes déjà ouverte : `/reload-mcp`.

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
