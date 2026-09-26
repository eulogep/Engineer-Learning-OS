# Espace de connaissance

Cet espace contient les catalogues, métadonnées, productions autorisées et références de la bibliothèque académique locale ELOS.

## Règles

- Les fichiers originaux restent les sources académiques de référence.
- Une source présente ne constitue jamais une preuve de maîtrise.
- `PROGRAM_SCOPE != CURRENT_COURSE_STATE != MASTERY_STATE != EXAM_SCOPE != BACKLOG`.
- Toute extraction, synthèse, quiz ou sortie de modèle reste `DERIVED` et conserve un lien vers l’original.
- Les fichiers académiques personnels, les binaires aux droits inconnus et les données professionnelles restent locaux et ignorés par Git.
- Aucun contenu `LOCAL_ONLY` ou `UNKNOWN_BLOCKED` ne peut être envoyé à un service distant.

## Structure

- `index.json` : registre initial validé des sources présentes et manquantes.
- `current-semester/` : baseline du semestre actuel, locale uniquement.
- `program/` : programme officiel; il décrit le périmètre sans prouver qu’un sujet a été enseigné.
- `elos-research/` : recherches et mémoire du projet ELOS.
- `catalog/` : métadonnées de ressources déjà gouvernées.
- `_incoming/` : zone locale de classement des nouvelles sources.
- `.derived/` : artefacts dérivés séparés des originaux.
- `../knowledge-private/` : contexte professionnel ou personnel strictement local.

Les sources absentes listées dans `index.json` ne doivent jamais être recréées depuis une mémoire de conversation.
