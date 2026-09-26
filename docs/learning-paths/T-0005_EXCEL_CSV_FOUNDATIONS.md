# T-0005 — Excel CSV Foundations

## Objectif

Permettre à l'utilisateur d'importer, structurer, nettoyer et analyser un CSV synthétique dans Excel, puis de reproduire la procédure sur un fichier nouveau sans tutoriel.

## Lien avec la baseline

T-0004 a établi DATA_ANALYSIS = 0/4. Le principal blocage observé était l'import d'un CSV séparé par des virgules : les données sont restées dans une seule colonne, puis la fatigue et la frustration ont interrompu l'épreuve. T-0005 traite ce prérequis avant Power Query, Power BI, SQL ou Python.

## Compétences ciblées

- importer un CSV depuis Données > Texte/CSV ;
- choisir le délimiteur virgule ;
- préserver le fichier brut ;
- vérifier les types des colonnes ;
- détecter valeurs manquantes, doublons, texte incohérent et valeurs aberrantes ;
- gérer explicitement une division par zéro ;
- calculer Energy_kWh_per_Ton ;
- calculer une moyenne par site ;
- consigner les traitements ;
- produire une conclusion professionnelle de cinq phrases maximum ;
- expliquer la procédure sans consulter le tutoriel.

## Prérequis

- Excel déjà installé ;
- accès local aux fichiers du parcours ;
- savoir créer, renommer et enregistrer un classeur ;
- aucun assistant IA, correcteur automatique ou recherche pendant le niveau 3.

## Structure et durées

| Niveau | Modalité | Durée cible | Preuve principale |
|---|---|---:|---|
| 1 — Import guidé | Démonstration puis exécution guidée | 20 min | XLSX importé correctement |
| 2 — Nettoyage guidé | Exécution guidée puis aide minimale | 30 min | XLSX nettoyé, journal et conclusion |
| 3 — Held-out | Exercice nouveau sans procédure | 25 min | XLSX, analyse et explication autonome |

Durée totale cible : 75 minutes, réalisable en une session ou deux sessions proches.

## Méthode pédagogique

Démonstration courte
→ exécution guidée
→ exécution avec aide minimale
→ exercice nouveau sans aide
→ preuve
→ auto-évaluation
→ prochaine révision.

Le niveau 1 limite volontairement la difficulté au mécanisme d'import. Le niveau 2 rend visibles les décisions de nettoyage. Le niveau 3 mesure le transfert sur un nouveau schéma de colonnes et des anomalies différentes.

## Règles de preuve

Une preuve valide comprend le classeur de travail, le CSV brut inchangé, le journal des anomalies, les calculs visibles, la conclusion et l'auto-évaluation. Une simple consultation du tutoriel ne démontre rien.

Chaque journal doit indiquer :

- cellule ou ligne concernée ;
- problème observé ;
- décision prise ;
- justification ;
- impact sur les calculs.

## Passage au niveau 3

Le niveau 2 doit démontrer :

1. import correct ;
2. fichier brut conservé ;
3. doublon identifié ;
4. division par zéro explicitement gérée ;
5. formule Energy_kWh_per_Ton correcte ;
6. moyenne par site correcte.

Si un point manque, reprendre uniquement le plus petit prérequis défaillant avant le held-out.

## Réussite du niveau 3

Au moins 8 critères sur 10 doivent être réussis. Aucun échec n'est accepté sur les points critiques : import correct, brut conservé, division par zéro explicite, formule correcte et fichier nettoyé sauvegardé.

## Erreurs fréquentes

- ouvrir le CSV par double-clic puis accepter une seule colonne ;
- appliquer une mise en forme sans réellement séparer les champs ;
- écraser le fichier source ;
- supprimer une ligne sans trace ;
- remplacer automatiquement une cellule vide par zéro ;
- utiliser une formule qui produit ou masque injustement #DIV/0! ;
- calculer une moyenne avant normalisation et validation ;
- inclure une valeur aberrante sans la signaler ;
- confondre observation, hypothèse et conclusion métier.

## Fatigue et frustration

Relever fatigue et frustration avant et après chaque niveau. Une pause est autorisée si l'une atteint 4/5 ou si la mesure devient non fiable. Après dix minutes bloqué sur la même étape guidée, arrêter, noter le blocage et reprendre plus tard au niveau du prérequis précis. Ne pas transformer une pause en échec de maîtrise.

## Conservation du brut

Le CSV source ne doit jamais être modifié. Dans Excel, créer Raw_Data puis dupliquer cette feuille en Clean_Data. Toutes les transformations se font dans Clean_Data et sont décrites dans le journal.

## NotebookLM — option future uniquement

    MODE = MANUAL_ASSISTED_NOTEBOOKLM
    SOURCE = TRAINING_SYNTHETIC guide only
    ARTIFACT = STUDY_GUIDE

NotebookLM n'est pas exécuté dans T-0005. Une future utilisation exigera le gate humain et une source allowlistée. Le support doit ensuite être fermé avant de refaire l'import, expliquer les étapes et traiter un fichier nouveau. L'artefact ne remplace jamais la manipulation Excel.

## Révisions

- J+1 : refaire l'import du niveau 1 sans regarder la procédure.
- J+3 : reprendre un extrait nouveau du niveau 2 et expliquer chaque contrôle.
- J+7 : réaliser un nouveau held-out court sans aide et comparer les erreurs.

Une réussite immédiate produit au mieux PRACTICED. Une réussite indépendante différée est nécessaire pour RETAINED.

## Clôture T-0005

T-0005 peut être clôturé lorsque :

- les trois preuves sont présentes ;
- le niveau 3 atteint au moins 8/10 ;
- aucun point critique n'échoue ;
- l'utilisateur explique la procédure sans tutoriel ;
- toute assistance est déclarée ;
- le dossier local reste ignoré par Git ;
- une révision différée est planifiée.
