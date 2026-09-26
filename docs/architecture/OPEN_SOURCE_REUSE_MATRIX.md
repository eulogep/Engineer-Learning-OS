# Engineer Learning OS V1 — Matrice de réutilisation open source

Statut : audit préliminaire `PLAN_ONLY`  
Date de vérification : 2026-08-11  
Règle : aucune installation, aucun fork et aucun appel réseau applicatif n’est autorisé par ce document.

## 1. Légende de décision

- `REUSE_AS_IS` : dépendance directe acceptable après ticket d’intégration.
- `ADAPT` : intégrer une partie derrière les contrats du produit.
- `BORROW_PATTERN` : reprendre une idée, sans dépendance ni copie de code.
- `PILOT` : essai isolé, réversible et mesuré.
- `DEFER` : attendre un besoin démontré et des gates satisfaites.
- `REJECT` : incompatible avec le périmètre ou le risque.

## 2. Matrice

| Projet | Besoin potentiel | Licence observée | Runtime / données / réseau | Chevauchement | Coût | Décision V1 | Ticket et kill criteria |
|---|---|---|---|---|---|---|---|
| `book-to-skill` | Transformer une source autorisée en support réutilisable | MIT | Python/agent; traitement annoncé local, mais le fournisseur de modèle éventuel reste une frontière externe; droits d’auteur à gérer | Moyen avec knowledge catalog | Moyen | `PILOT` | T-0015, un seul support TCP/UDP appartenant à l’utilisateur ou ouvert. Stop si provenance/licence inconnue, contenu envoyé sans approbation, résultat non traçable ou gain pédagogique non mesurable. |
| `DeepTutor` | Tutorat agentique, RAG, outils et mémoire | Apache-2.0 | Python 3.11+, Node 20.9+, modèles/embeddings et infrastructure substantielle | Très élevé avec runtime, mastery, knowledge et memory | Très élevé | `BORROW_PATTERN`, puis `DEFER` | T-0016 audit d’architecture seulement. Stop intégration si elle duplique le cœur, impose ses schémas, nécessite une donnée externe non approuvée ou rend le mode local fragile. |
| `AFFiNE` | Espace de connaissances/canvas local | Dépôt à licences et frontières client/serveur à revalider au pilote | Client annoncé utilisable hors ligne; sync/collaboration et serveur ont des frontières distinctes | Élevé avec knowledge/notes, faible avec mission runtime | Élevé | `BORROW_PATTERN`, `DEFER` intégration | T-0017 : pilote UX isolé uniquement après revue exacte des fichiers/licences. Stop si serveur propriétaire requis, export imprécis ou données personnelles quittent l’hôte. |
| `PenEcho` | Canvas manuscrit, équations, diagrammes, raisonnement spatial | AGPL-3.0 avec option commerciale | Node.js 20.3+; écoute `0.0.0.0` par défaut; API ou CLI IA; images/canvas transmis au modèle choisi; logs optionnels sensibles | Moyen pour explication/mastery | Élevé | `DEFER`, éventuel `PILOT` séparé | T-0017 après threat model. Stop si exposition LAN, AGPL incompatible, preuve non exportable, clé/log non maîtrisé ou amélioration non démontrée. |
| `Letta` | Mémoire persistante d’agent | Apache-2.0 | Serveur/clients Python et TypeScript; fournisseur de modèle et clé selon configuration | Très élevé avec mémoire canonique | Élevé | `DEFER` conditionnel | T-0018 seulement si test comparatif prouve que SQLite + résumés ne suffit pas. Stop si devient autorité, copie des données personnelles ou ajoute un service permanent sans bénéfice. |
| `SkillOpt` | Optimiser des skills/prompt à partir de trajectoires | MIT | Python; peut partager des trajectoires avec un fournisseur; WebUI à borner à loopback | Faible avant comportements stables | Moyen | `DEFER` post-V1 | Aucune intégration T-0006–T-0021. Réévaluer après corpus d’évaluation, consentement et budget; stop si transcript personnel requis. |
| `GEPA` | Optimisation réfléchie de prompts/programmes | MIT | Python; nécessite évaluateur, dataset et modèle | Faible avant métriques fiables | Moyen | `DEFER` post-V1 | Réévaluer après tests held-out stables; stop en l’absence de budget, rollback et non-régression. |
| `DSPy` | Programmes LM modulaires et optimisation | MIT | Python >= 3.10; fournisseurs LM selon configuration | Moyen avec futurs adaptateurs IA | Moyen/élevé | `DEFER` | Aucun ticket V1 tant que deux cas d’usage LM modulaires ne justifient pas le runtime Python. |
| NotebookLM | Support pédagogique optionnel | Service externe, gouvernance locale déjà définie | Upload manuel contrôlé; destination Google; pas d’autorité canonique | Faible si limité aux artefacts | Moyen | `ADAPT` en `MANUAL_ASSISTED` | T-0019. Stop si classification `UNKNOWN`, absence d’approbation précise, source interdite ou automatisation non gouvernée. |

## 3. Conclusion de sélection

Aucun projet tiers n’est requis pour livrer T-0009. La stratégie V1 est :

1. réutiliser le socle local existant;
2. construire les contrats de mission, preuve et compétence;
3. mesurer un parcours Excel réel;
4. piloter `book-to-skill` sur une source autorisée;
5. emprunter des patterns à DeepTutor/AFFiNE sans adopter leurs plateformes;
6. n’essayer PenEcho, Letta ou NotebookLM qu’avec un périmètre, des données et une sortie explicites;
7. différer les optimiseurs jusqu’à l’existence d’évaluations reproductibles.

## 4. Checklist avant chaque pilote

- commit/tag précis et fichiers de licence revérifiés;
- dépendances, SBOM et vulnérabilités inspectées;
- données entrantes classifiées et droits documentés;
- sorties réseau et télémétrie listées;
- exécution sur loopback, secrets hors dépôt;
- export et suppression testés;
- métrique de succès et durée bornée;
- désinstallation/rollback sans perte de la base canonique.

## 5. Sources primaires

- DSPy : <https://github.com/stanfordnlp/dspy>
- book-to-skill : <https://github.com/virgiliojr94/book-to-skill> et <https://github.com/virgiliojr94/book-to-skill/blob/master/LICENSE.md>
- DeepTutor : <https://github.com/HKUDS/DeepTutor>
- AFFiNE : <https://github.com/toeverything/AFFiNE> et discussion de frontière client/serveur <https://github.com/toeverything/AFFiNE/discussions/5947>
- Letta : <https://github.com/letta-ai/letta> et <https://github.com/letta-ai/letta/blob/main/LICENSE>
- SkillOpt : <https://github.com/microsoft/SkillOpt>
- GEPA : <https://github.com/gepa-ai/gepa>
- PenEcho : <https://github.com/penecho/penecho>, <https://github.com/penecho/penecho/blob/main/LICENSE> et <https://github.com/penecho/penecho/blob/main/COMMERCIAL-LICENSE.md>

Les versions, licences et conditions peuvent évoluer; la présente lecture n’est pas un avis juridique et doit être renouvelée au ticket de pilote.

