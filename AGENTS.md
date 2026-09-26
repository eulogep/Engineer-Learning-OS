# Engineer Learning OS — règles du dépôt

## Périmètre

Ce dépôt fait évoluer progressivement Daily English Mission vers Engineer Learning OS.
Ne pas créer de dépôt imbriqué et ne pas déplacer les sources existantes sans ticket explicite.

## Règles de travail

- Respecter le mode et le périmètre du ticket actif.
- Ne jamais lire, versionner ou afficher une valeur secrète.
- Ne jamais incorporer les documents académiques, données Soufflet Malt, audios, bases locales ou journaux d’exécution.
- Utiliser uniquement des fixtures synthétiques dans les tests.
- Ne pas appeler un service externe sans autorisation explicite et contrôle de confidentialité.
- Ne pas lancer de migration, seed, déploiement, commit ou push hors demande explicite.
- Conserver les rapports d’agent locaux et non versionnés, sauf décision contraire documentée.

## Frontières architecturales

- `src/modules/` contient les capacités métier indépendantes du framework.
- `src/app/` reste la couche de transport et de présentation Next.js.
- `src/shared/` contient uniquement les éléments réellement transverses et stables.
- `src/config/` centralise une configuration validée, sans valeur secrète codée en dur.
- `src/main/` constitue la racine de composition des modules et adaptateurs.
- Prisma, SQLite, l’IA, l’audio et les services externes sont des adaptateurs d’infrastructure.
- Un module ne dépend pas de l’interface interne d’un autre module.

## Qualité

Toute évolution fonctionnelle doit comporter des tests proportionnés au risque. Les contrôles de sécurité,
de confidentialité et de reprise sont des critères d’acceptation, pas des améliorations facultatives.

## Gate NotebookLM legacy

NotebookLM est requis comme capacité pédagogique, mais la skill locale legacy n’est exécutable qu’après
une demande et une approbation humaines explicites pour l’opération précise. Avant confirmation, afficher
les sources, classifications, objectif pédagogique, prompt, destination et action. Une classification
`UNKNOWN` bloque l’exécution. Interdire secrets, credentials, données entreprise internes/restreintes,
données de santé, données financières, pièces d’identité et audio privé non approuvé.

Contraintes : une seule exécution concurrente, deux retries au maximum, aucune exécution en arrière-plan,
aucun upload groupé automatique et suspension après trois échecs comparables. Toujours proposer
`MANUAL_ASSISTED_NOTEBOOKLM` et un mode local si l’automatisation est indisponible.

## Project Agent Rules (TES Minimal v0.1)

> Global token-efficiency behavior belongs in the global AGENTS.md (`~/.codex/AGENTS.md`).
> This section contains only project-specific routing and constraints.

### Project
- Stack: Next.js 16, React 19, TypeScript 5, Tailwind 4, Prisma 6, SQLite, shadcn/ui
- Package manager: npm (bun.lock also present)
- Main entry points: `src/app/` (Next.js pages), `src/modules/` (business logic)
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`

### Relevant context routes
Use only when the task touches the corresponding area.

- architecture → `docs/ARCHITECTURE.md`

### Overrides
Project-specific rules may specialize global defaults.
Do not contradict global safety or correctness requirements silently.
Document deliberate exceptions here.

- None currently.

### Verification map
- MICRO → targeted check
- LOCAL → targeted tests + lint/typecheck when applicable
- CROSS → targeted + integration/contract checks
- STRUCTURAL → broader regression verification appropriate to the change

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
