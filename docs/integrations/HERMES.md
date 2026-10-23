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

## Installation

```bash
REPO=~/Desktop/Developer/daily-english-mission
hermes mcp add elos --command "$(command -v node)" --args \
  --experimental-strip-types --no-warnings --import "$REPO/tests/register-loader.mjs" "$REPO/mcp/elos-server.ts"
hermes mcp test elos      # connexion + 6 outils
```

Dans une session Hermes déjà ouverte : `/reload-mcp`.

## Confidentialité

Les résultats des outils sont envoyés par Hermes à **son** fournisseur de modèle. Par défaut le serveur n’utilise que les
documents synthétiques de démonstration. Pour l’ouvrir à tes cours, définis explicitement un dossier :

```bash
hermes mcp remove elos
hermes mcp add elos --command "$(command -v node)" --env ELOS_SOURCES_DIR=/chemin/vers/mes-cours --args \
  --experimental-strip-types --no-warnings --import "$REPO/tests/register-loader.mjs" "$REPO/mcp/elos-server.ts"
```

Garde-fous : seuls `.pdf`, `.md`, `.txt` sous ce dossier ; `knowledge-private/`, fichiers secrets (`.env`, `*.secret`,
`*.private`) et chemins hors du dossier refusés ; 200 fichiers et 25 Mo par fichier au maximum ; PDF scannés ignorés.
N’y mets pas de documents d’entreprise internes, de données personnelles d’autrui ni de secrets.

Le serveur est lancé depuis ce dépôt : garde une branche qui contient `mcp/` (par exemple `main-public`).
