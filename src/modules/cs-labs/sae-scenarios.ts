import type { KeyValueStorage } from "../daily-english/local-mission";

/**
 * Phase 4 — CYU Alternance / SAE Scenarios + local progress store for CS Labs.
 * Every scenario ties technical diagnosis, remediation, and an English engineering summary
 * without any private or company data.
 */

export type SaeStep = Readonly<{
  id: string;
  stageLabel: string;
  prompt: string;
  evidenceSnippet: string;
  choices: readonly string[];
  correctAnswer: string;
  explanation: string;
}>;

export type SaeScenario = Readonly<{
  id: string;
  title: string;
  ueTag: string;
  durationMinutes: number;
  theme: "emerald" | "indigo" | "violet" | "orange";
  context: string;
  steps: readonly SaeStep[];
  englishSummaryPrompt: string;
  englishSummaryModel: string;
}>;

export const CYU_SAE_SCENARIOS: readonly SaeScenario[] = [
  {
    id: "sae-dhcp-vlan",
    title: "SAE 1 · Panne DHCP / VLAN sur un étage",
    ueTag: "CYU LPRC · Réseaux & Exploitation",
    durationMinutes: 6,
    theme: "indigo",
    context:
      "Lundi 9h : les 18 postes de la salle B204 n'ont plus accès ni au réseau local ni à Internet. Les autres étages fonctionnent normalement.",
    steps: [
      {
        id: "dhcp-1",
        stageLabel: "1. Diagnostic initial",
        prompt: "Tu lances `ipconfig` / `ip a` sur un poste touché et vois l'adresse `169.254.48.12/16`. Que révèle cette adresse ?",
        evidenceSnippet: "eth0: inet 169.254.48.12/16 · default gateway: (none)",
        choices: [
          "Une adresse APIPA auto-assignée : le poste n'a reçu aucune réponse du serveur DHCP",
          "Le serveur DNS externe est en panne",
          "La carte réseau est débranchée physiquement",
        ],
        correctAnswer: "Une adresse APIPA auto-assignée : le poste n'a reçu aucune réponse du serveur DHCP",
        explanation: "La plage 169.254.0.0/16 (APIPA) apparaît quand le DHCP Discover n'obtient aucun DHCP Offer.",
      },
      {
        id: "dhcp-2",
        stageLabel: "2. Isolation de la cause racine",
        prompt: "Le serveur DHCP tourne bien dans le VLAN 10, tandis que la salle B204 est dans le VLAN 20. Le routeur inter-VLAN a été reconfiguré hier. Qu'est-ce qui manque sur l'interface VLAN 20 ?",
        evidenceSnippet: "interface Vlan20\n ip address 10.20.20.1 255.255.255.0\n ! (aucun relais configuré)",
        choices: [
          "Un relais DHCP (`ip helper-address 10.20.10.10`) car les broadcasts DHCP ne traversent pas un routeur",
          "Une règle NAT vers Internet",
          "Passer le masque en /8",
        ],
        correctAnswer: "Un relais DHCP (`ip helper-address 10.20.10.10`) car les broadcasts DHCP ne traversent pas un routeur",
        explanation: "Les routeurs bloquent par défaut les trames broadcast (couche 2/3) ; le relais DHCP encapsule le Discover en unicast vers le serveur DHCP.",
      },
      {
        id: "dhcp-3",
        stageLabel: "3. Prévention",
        prompt: "Une fois le relais rétabli et les baux renouvelés, quelle action évite la récidive ?",
        evidenceSnippet: "Service rétabli : 18/18 postes ont reçu une IP 10.20.20.x/24.",
        choices: [
          "Versionner la config routeur, tester le DHCP en préprod et ajouter une alerte de surveillance des baux",
          "Passer tous les postes en IP fixe manuelle sans documentation",
          "Désactiver les VLANs pour tout fusionner en un seul broadcast domain",
        ],
        correctAnswer:
          "Versionner la config routeur, tester le DHCP en préprod et ajouter une alerte de surveillance des baux",
        explanation: "Versionner les configurations réseau et monitorer les services critiques est la base d'une exploitation fiable.",
      },
    ],
    englishSummaryPrompt: "Comment résumer cet incident en 1 phrase claire au stand-up en anglais ?",
    englishSummaryModel:
      "The outage on floor B204 was caused by a missing DHCP relay on VLAN 20; we restored the helper address and added config checks.",
  },
  {
    id: "sae-linux-hardening",
    title: "SAE 2 · Audit & Durcissement Linux avant prod",
    ueTag: "CYU LPRC · Systèmes & Cybersécurité",
    durationMinutes: 6,
    theme: "violet",
    context:
      "Avant la mise en production d'une VM Debian hébergeant une API interne, ton tuteur te demande un audit de durcissement rapide.",
    steps: [
      {
        id: "lin-1",
        stageLabel: "1. Lecture de configuration SSH",
        prompt: "Tu inspectes `/etc/ssh/sshd_config`. Quel paramètre représente le risque le plus élevé ?",
        evidenceSnippet: "Port 22\nPermitRootLogin yes\nPasswordAuthentication yes\nMaxAuthTries 20",
        choices: [
          "PermitRootLogin yes + PasswordAuthentication yes exposent root au brute-force",
          "Utiliser le port 22 est interdit par Linux",
          "SSH ne chiffre pas les sessions",
        ],
        correctAnswer: "PermitRootLogin yes + PasswordAuthentication yes exposent root au brute-force",
        explanation: "Désactiver la connexion root directe et imposer l'authentification par clé SSH coupe net la majorité des attaques automatisées.",
      },
      {
        id: "lin-2",
        stageLabel: "2. Moindre privilège & Pare-feu",
        prompt: "L'API tourne sur le port interne 3000 derrière Nginx (443). Que doit autoriser le pare-feu en entrée depuis l'extérieur ?",
        evidenceSnippet: "Services actifs : nginx (:443), node-api (127.0.0.1:3000), postgres (127.0.0.1:5432), ssh (:22)",
        choices: [
          "Uniquement 443/tcp (public) et 22/tcp restreint au bastion/VPN, politique par défaut DENY",
          "Ouvrir 3000 et 5432 à 0.0.0.0/0 pour faciliter le debug",
          "Désactiver le pare-feu tant que Nginx est actif",
        ],
        correctAnswer:
          "Uniquement 443/tcp (public) et 22/tcp restreint au bastion/VPN, politique par défaut DENY",
        explanation: "Principe du moindre privilège : ne jamais exposer la BDD ni le port applicatif brut derrière un reverse proxy.",
      },
    ],
    englishSummaryPrompt: "Phrase type pour ton compte rendu d'audit en anglais :",
    englishSummaryModel:
      "We hardened the Debian host by disabling root SSH password login, enforcing key-based authentication, and restricting inbound firewall rules.",
  },
  {
    id: "sae-sql-perf",
    title: "SAE 3 · Enquête Latence SQL & API (6 s → 45 ms)",
    ueTag: "CYU L3 S5 · Bases de Données & Web",
    durationMinutes: 5,
    theme: "emerald",
    context:
      "La page d'historique des tickets met 6 secondes à répondre dès que la table dépasse 500 000 lignes.",
    steps: [
      {
        id: "sqls-1",
        stageLabel: "1. Lecture d'un EXPLAIN",
        prompt: "Le plan d'exécution indique `Seq Scan on tickets (cost=0..48200 rows=512000)`. Que se passe-t-il ?",
        evidenceSnippet: "SELECT * FROM tickets WHERE customer_id = 42 ORDER BY created_at DESC;",
        choices: [
          "La base lit l'intégralité des 512 000 lignes (Full Table Scan) faute d'index et sans pagination LIMIT",
          "La base est corrompue et doit être réinstallée",
          "Le protocole HTTP 1.1 limite SQL à 100 lignes",
        ],
        correctAnswer:
          "La base lit l'intégralité des 512 000 lignes (Full Table Scan) faute d'index et sans pagination LIMIT",
        explanation: "Un Seq Scan sur une grande table combiné à l'absence de pagination provoque une latence linéaire O(N).",
      },
      {
        id: "sqls-2",
        stageLabel: "2. Plan d'action sûr en production",
        prompt: "Quelle combinaison résout le problème sans casser les clients existants ?",
        evidenceSnippet: "Objectif : p95 < 100 ms sans interruption de service.",
        choices: [
          "Ajouter un index composite (customer_id, created_at DESC), paginer par curseur et mesurer via benchmark en préprod",
          "Supprimer les tickets de plus d'une semaine sans prévenir les utilisateurs",
          "Stocker toute la table dans un fichier CSV côté navigateur",
        ],
        correctAnswer:
          "Ajouter un index composite (customer_id, created_at DESC), paginer par curseur et mesurer via benchmark en préprod",
        explanation: "L'index composite élimine le scan complet et le tri coûteux ; la pagination borne la taille du payload JSON.",
      },
    ],
    englishSummaryPrompt: "Phrase type post-mortem en anglais :",
    englishSummaryModel:
      "Adding a composite index on (customer_id, created_at) and cursor pagination cut API response time from 6 seconds to 45 milliseconds.",
  },
  {
    id: "sae-owasp-pr",
    title: "SAE 4 · Revue de Sécurité OWASP sur Pull Request",
    ueTag: "CYU LP Dev · Sécurité Applicative",
    durationMinutes: 5,
    theme: "orange",
    context:
      "Un collègue ouvre une PR ajoutant un export de profil utilisateur et un champ de bio HTML.",
    steps: [
      {
        id: "pr-1",
        stageLabel: "1. Contrôle d'accès (Broken Access Control)",
        prompt: "La route `GET /api/users/:id/export` lit `params.id` et renvoie le profil sans vérifier la session. Quelle faille OWASP est présente ?",
        evidenceSnippet: "export async function GET(req, { params }) {\n  return Response.json(await db.user.findUnique({ where: { id: params.id } }));\n}",
        choices: [
          "IDOR / Broken Access Control (OWASP A01) : n'importe qui peut lire les données d'un autre utilisateur",
          "Un simple problème de mise en page CSS",
          "Une erreur de compression Gzip",
        ],
        correctAnswer:
          "IDOR / Broken Access Control (OWASP A01) : n'importe qui peut lire les données d'un autre utilisateur",
        explanation: "Il faut toujours authentifier l'appelant et vérifier qu'il est autorisé à accéder à la ressource demandée.",
      },
      {
        id: "pr-2",
        stageLabel: "2. Prévention XSS sur le rendu",
        prompt: "Le composant affiche la bio via `dangerouslySetInnerHTML={{ __html: user.bio }}`. Que recommander en code review ?",
        evidenceSnippet: "<div dangerouslySetInnerHTML={{ __html: user.bio }} />",
        choices: [
          "Rendre le texte brut échappé par React (`<div>{user.bio}</div>`) ou assainir strictement côté serveur/client",
          "Accepter la PR en ajoutant un commentaire TODO",
          "Retirer le champ bio uniquement sur mobile",
        ],
        correctAnswer:
          "Rendre le texte brut échappé par React (`<div>{user.bio}</div>`) ou assainir strictement côté serveur/client",
        explanation: "Injecter du HTML brut non assaini expose directement les utilisateurs à une faille XSS stockée.",
      },
    ],
    englishSummaryPrompt: "Commentaire de code review constructif en anglais :",
    englishSummaryModel:
      "Hard blocker before merge: please verify session ownership on the export route (IDOR) and avoid rendering unsanitized HTML to prevent XSS.",
  },
];

// ---------------------------------------------------------------------------
// Local-first CS Labs Progress Store
// ---------------------------------------------------------------------------

export const CS_LABS_STORAGE_KEY = "engineer-learning-os:cs-labs:v1";

export type CsLabsProgress = Readonly<{
  version: 1;
  subnetSolvedCount: number;
  routingSolvedIds: readonly string[];
  sequenceSolvedIds: readonly string[];
  linuxSolvedIds: readonly string[];
  socSolvedIds: readonly string[];
  sqlSolvedIds: readonly string[];
  drillSolvedIds: readonly string[];
  saeSolvedIds: readonly string[];
  /** Skill id of the last workshop worked on, used to resume (validated by the skill map). */
  lastSkillId: string | null;
}>;

export const DEFAULT_CS_LABS_PROGRESS: CsLabsProgress = Object.freeze({
  version: 1,
  subnetSolvedCount: 0,
  routingSolvedIds: [],
  sequenceSolvedIds: [],
  linuxSolvedIds: [],
  socSolvedIds: [],
  sqlSolvedIds: [],
  drillSolvedIds: [],
  saeSolvedIds: [],
  lastSkillId: null,
});

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((v): v is string => typeof v === "string")))
    : [];
}

export function readCsLabsProgress(storage: KeyValueStorage | null): CsLabsProgress {
  if (!storage) return DEFAULT_CS_LABS_PROGRESS;
  try {
    const raw = JSON.parse(storage.getItem(CS_LABS_STORAGE_KEY) ?? "null") as Record<string, unknown> | null;
    if (!raw || raw.version !== 1) return DEFAULT_CS_LABS_PROGRESS;
    return {
      version: 1,
      subnetSolvedCount:
        typeof raw.subnetSolvedCount === "number" && Number.isFinite(raw.subnetSolvedCount) && raw.subnetSolvedCount >= 0
          ? Math.floor(raw.subnetSolvedCount)
          : 0,
      routingSolvedIds: stringArray(raw.routingSolvedIds),
      sequenceSolvedIds: stringArray(raw.sequenceSolvedIds),
      linuxSolvedIds: stringArray(raw.linuxSolvedIds),
      socSolvedIds: stringArray(raw.socSolvedIds),
      sqlSolvedIds: stringArray(raw.sqlSolvedIds),
      drillSolvedIds: stringArray(raw.drillSolvedIds),
      saeSolvedIds: stringArray(raw.saeSolvedIds),
      lastSkillId:
        typeof raw.lastSkillId === "string" && /^[a-z_-]{1,32}$/.test(raw.lastSkillId) ? raw.lastSkillId : null,
    };
  } catch {
    return DEFAULT_CS_LABS_PROGRESS;
  }
}

export function writeCsLabsProgress(storage: KeyValueStorage | null, state: CsLabsProgress): void {
  if (!storage) return;
  try {
    storage.setItem(CS_LABS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or quota full: keep working in memory.
  }
}

export type CsProgressBucket =
  | "routingSolvedIds"
  | "sequenceSolvedIds"
  | "linuxSolvedIds"
  | "socSolvedIds"
  | "sqlSolvedIds"
  | "drillSolvedIds"
  | "saeSolvedIds";

export function markCsItemSolved(
  state: CsLabsProgress,
  bucket: CsProgressBucket,
  id: string,
): CsLabsProgress {
  if (state[bucket].includes(id)) return state;
  return {
    ...state,
    [bucket]: [...state[bucket], id],
  };
}

export function incrementSubnetSolved(state: CsLabsProgress): CsLabsProgress {
  return { ...state, subnetSolvedCount: state.subnetSolvedCount + 1 };
}
