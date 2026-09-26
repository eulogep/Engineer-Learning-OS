# Engineer Learning OS V1 — Frontières de sécurité et confidentialité

Statut : `PLAN_ONLY`  
Position par défaut : local, privé, réseau refusé sauf opération approuvée.

## 1. Actifs protégés

- productions d’apprentissage, fichiers Excel, audio et transcriptions;
- progression, difficultés, évaluations et profil de compétences;
- documents académiques et sources sous droits;
- secrets d’API et sessions locales;
- intégrité des définitions de mission, grilles et answer keys;
- base SQLite et sauvegardes.

## 2. Frontières de confiance

| Frontière | Risque | Contrôle attendu |
|---|---|---|
| Navigateur -> routes Next.js | entrée non fiable, CSRF, taille | validation serveur, limite, type de contenu, origine/session |
| Routes -> domaine | contournement des règles | cas d’usage uniques et machine d’état |
| Domaine -> SQLite | corruption, migration irréversible | transactions, contraintes, sauvegarde et test de restauration |
| Domaine -> fichiers locaux | traversée de chemin, fuite | identifiants opaques, racine fixe, noms neutralisés, permissions |
| Application -> fournisseur externe | exfiltration, rétention inconnue | adaptateur bloqué par défaut, aperçu des données et consentement |
| Application -> NotebookLM | upload non approuvé | gate legacy existant et mode `MANUAL_ASSISTED` |
| Hôte local -> LAN/Internet | accès non autorisé | écoute loopback par défaut, pas de tunnel/proxy dynamique |

## 3. Classifications

- `PUBLIC` : publication explicitement autorisée.
- `TRAINING_SYNTHETIC` : dataset fictif créé pour le parcours.
- `ACADEMIC` : document de cours; traitement local, droits vérifiés.
- `PERSONAL` : toute production, audio, progression et baseline.
- `COMPANY_INTERNAL` / `RESTRICTED` : bloqué pour services externes.
- `UNKNOWN` : blocage immédiat jusqu’à classification.

Une classification ne peut être abaissée automatiquement. NotebookLM, ASR et LLM refusent `UNKNOWN`, secrets, credentials, données entreprise internes/restreintes, santé, finance, identité et audio privé non approuvé.

## 4. Téléversements et preuves

- Autoriser seulement les extensions/types nécessaires au pas actif.
- Vérifier taille, signature/MIME, nom, archive et nombre de fichiers.
- Générer le chemin côté serveur; refuser chemins absolus, séparateurs et `..`.
- Calculer SHA-256 et écrire atomiquement hors des répertoires servis par Next.js.
- Ne jamais exécuter macros, scripts, HTML ou formules d’un fichier déposé.
- Servir en téléchargement forcé avec en-têtes sûrs.
- Ne pas journaliser le contenu ni le nom personnel complet.
- Isoler les answer keys du bundle client et des API non autorisées.

Pour CSV/XLSX, l’aperçu doit neutraliser les formules commençant par `=`, `+`, `-` ou `@` lors d’un futur export afin d’éviter l’injection tableur.

## 5. Audio et transcription

L’enregistrement brut reste local. Avant un appel ASR externe, l’interface affiche fournisseur, extrait transmis, objectif, politique de rétention connue et action de confirmation. Le refus conserve un chemin manuel. Les URL temporaires ne sont ni prédictibles ni persistées dans les journaux. Audio, transcription et évaluation ont des politiques de suppression distinctes.

## 6. IA et contenus sources

- Les textes, fichiers et transcriptions sont des données, jamais des instructions système.
- Les prompts séparent politique, contexte et contenu non fiable.
- Les sorties sont validées par schéma; aucune commande, migration ou requête n’est exécutée depuis une sortie IA.
- Les appels ont un timeout, une limite de taille, au plus deux retries et un identifiant d’audit.
- Le résultat IA est une proposition; une règle ou validation humaine décide de la progression.
- Un mode local/manual demeure disponible pour chaque compétence essentielle.

## 7. Secrets, logs et erreurs

Secrets uniquement via variables validées, jamais dans Git, captures, rapports ou réponse d’erreur. Les journaux utilisent identifiants opaques, code d’événement, latence et statut. Aucun corps de requête privé. Les erreurs côté client restent génériques; le diagnostic local ne révèle pas de chemin personnel.

## 8. Risques existants à corriger avant V1

1. Le `Caddyfile` contient un proxy dynamique piloté par une entrée de requête : supprimer ou remplacer par une cible fixe locale.
2. `next.config.ts` ignore les erreurs de build TypeScript : rétablir l’échec sûr.
3. Les routes audio/correction appellent directement un service externe : introduire consentement, classification, ports et mode désactivé.
4. Les routes accèdent directement à Prisma : extraire validation et autorisation dans les cas d’usage.
5. Le profil mono-utilisateur n’est pas une authentification : interdire toute exposition réseau avant décision.

Ces constats ne sont pas corrigés dans ce ticket `PLAN_ONLY`.

## 9. Gates par phase

- T-0006 : modèle de menace, décision profil/auth et registre des données.
- T-0007 : en-têtes, erreurs sûres et absence d’exposition réseau.
- T-0008 : validation des transitions et anti-CSRF/session.
- T-0009 : dataset synthétique seulement; aucun answer key client.
- T-0010 : stockage de preuve, limites, traversal et suppression.
- T-0012 : consentement audio et rétention.
- T-0015 : droits/licences/provenance des sources.
- T-0019 : gate NotebookLM complet et journal sans contenu.
- T-0020 : tests adversariaux, secrets, dépendances, sauvegarde/restauration.

## 10. Réponse et restauration

En cas d’exposition présumée : arrêter les sorties réseau, préserver les seuls métadonnées utiles, révoquer les secrets concernés, identifier les fichiers/classes touchés, restaurer depuis sauvegarde vérifiée si intégrité compromise, documenter sans recopier la donnée. Aucun envoi externe de télémétrie n’est automatique.

## 11. Critères d’acceptation sécurité

- `baseline/`, preuves, audio, bases et logs sont ignorés par Git.
- Aucun secret ni chemin personnel n’apparaît dans source, build ou logs.
- Le serveur écoute localement par défaut.
- Les uploads adversariaux sont refusés et ne sortent pas de leur racine.
- Une mission essentielle fonctionne sans réseau.
- Chaque sortie réseau exige une finalité, une classification autorisée et un consentement enregistré.
- Sauvegarde et restauration sont testées avant V1.

