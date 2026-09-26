# Engineer Learning OS V1 — UX cible

Statut : `PLAN_ONLY`  
Premier test réel : `EXCEL_CSV_FOUNDATIONS_LEVEL_1`.

## 1. Promesse d’usage

L’utilisateur ouvre l’application et sait immédiatement : ce qu’il doit faire maintenant, pourquoi, combien de temps cela prend, quelle preuve produire et ce qui viendra ensuite. L’application privilégie une mission courte et terminable plutôt qu’un catalogue massif.

## 2. Navigation V1

```text
Aujourd’hui
Apprendre
Réviser
Matières
Professionnel
Preuves
Progression
Paramètres locaux
```

Sur mobile, la navigation principale devient un menu accessible; pendant une mission, seule la progression utile demeure visible.

## 3. Écran Aujourd’hui

Ordre visuel :

1. mission recommandée, objectif et durée;
2. bouton `Commencer` ou `Reprendre`;
3. raison de la recommandation;
4. révision urgente éventuelle;
5. progression récente par compétence;
6. indicateur `LOCAL_ONLY` ou opération externe clairement signalée.

Aucun score global trompeur. Les dimensions restent séparées : compréhension, données, explication, livrable professionnel et anglais oral.

## 4. Mission runner générique

```text
+---------------------------------------------------------+
| Niveau 1 — Import CSV        Étape 2/5       12 min     |
| Objectif : séparer correctement les colonnes            |
|---------------------------------------------------------|
| Consigne active                                         |
| [démonstration / exercice / question / dépôt de preuve] |
|                                                         |
| [Indice] [Mettre en pause]                 [Continuer]   |
|---------------------------------------------------------|
| Données : TRAINING_SYNTHETIC | Réseau : aucun           |
+---------------------------------------------------------+
```

Types de pas V1 : instruction, démonstration, action hors application, question courte, checklist, dépôt de fichier, audio, auto-évaluation et résultat. Le runtime enregistre le statut, le temps réel, les indices et l’assistance déclarée.

## 5. Flux Excel CSV Foundations Niveau 1

1. **Préparation** — confirmer qu’Excel est disponible; montrer fichier, objectif, durée et confidentialité.
2. **Démonstration courte** — ouvrir par `Données > À partir d’un fichier texte/CSV`, choisir UTF-8 et virgule, prévisualiser.
3. **Exécution guidée** — l’utilisateur répète avec le fichier de huit lignes.
4. **Contrôle** — vérifier le nombre et le nom des colonnes, le type de date et la seule anomalie prévue.
5. **Preuve** — déposer le fichier sauvegardé et décrire les étapes sans regarder le tutoriel.
6. **Auto-évaluation** — difficulté, confiance, blocage, réussite, aide souhaitée et temps.
7. **Résultat** — critères, écarts, prochaine révision; pas de passage automatique si l’import est incorrect.

Les answer keys restent côté évaluateur et ne sont jamais chargées dans le navigateur avant soumission.

## 6. États à concevoir

- prêt, en cours, en pause, reprise;
- brouillon sauvegardé;
- fichier en cours de validation;
- preuve refusée avec raison actionnable;
- soumise, en évaluation, évaluée;
- réseau indisponible sans perte de travail;
- fatigue/abandon sans jugement et avec reprise proposée;
- assistance déclarée, distinguée du résultat indépendant.

## 7. Preuves et confidentialité

Avant dépôt, afficher classification, destination locale, durée de conservation et possibilité de suppression. Une preuve est prévisualisable quand le navigateur le permet. L’interface ne suggère jamais qu’un fichier personnel sera envoyé à une IA.

Pour l’audio : test microphone, enregistrement visible, pause/arrêt, lecture locale, consentement distinct avant transcription externe, suppression immédiate possible. L’accent n’est pas noté s’il reste intelligible.

## 8. Progression et feedback

Le feedback suit cet ordre : résultat observable, critères atteints, erreur critique, prochaine action courte. Il met en regard confiance déclarée et performance sans jugement. Une compétence affiche les preuves qui ont justifié son niveau et la prochaine révision.

## 9. Accessibilité

- Navigation clavier complète et focus visible.
- Labels de formulaires et annonces des erreurs.
- Contraste WCAG AA et absence d’information portée uniquement par la couleur.
- Minuteurs non coercitifs, possibilité de pause et préférence de mouvement réduit.
- Instructions en langage simple, termes techniques expliqués au moment utile.
- Dépôt de fichiers utilisable sans glisser-déposer.

## 10. Validation utilisateur progressive

- T-0007 : test du shell et de la compréhension de la navigation.
- T-0008 : test pause/reprise et clarté des états sur une mission factice.
- T-0009 : utilisateur réel sur Excel Niveau 1; principal jalon de valeur.
- T-0010 : compréhension de la preuve et de la progression.
- T-0012 : consentement et contrôle audio.
- T-0021 : parcours V1 complet et test de reprise.

Après chaque test : observer sans aider, relever erreurs et temps, corriger seulement le périmètre testé, puis décider du ticket suivant.

## 11. Critères de réussite UX V1

- L’utilisateur trouve et commence sa mission en moins de deux minutes.
- Il sait distinguer tutoriel, exercice et preuve.
- Il peut mettre en pause et reprendre sans perdre sa progression.
- Il comprend si une opération reste locale ou quitte la machine.
- Il termine Excel Niveau 1 et explique l’import sans le tutoriel.
- Toute erreur de fichier indique une correction réalisable.
- La prochaine action est toujours visible après évaluation.

