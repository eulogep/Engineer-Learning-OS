/**
 * Pure TypeScript SQL, Algorithms/Graphs, and Operating Systems Labs
 * aligned with CYU Licence 3 Informatique (S5 BDD, S6 Graphes & OS) and LP Dev Web.
 * 100% synthetic data, deterministic evaluation, zero external calls.
 */

export type SqlChallenge = Readonly<{
  id: string;
  title: string;
  ueTag: string;
  schemaSummary: string;
  prompt: string;
  expectedKeywords: readonly string[];
  forbiddenPatterns?: readonly string[];
  modelQuery: string;
  tokenBank: readonly string[];
  expectedPreviewColumns: readonly string[];
  expectedPreviewRows: readonly (readonly string[])[];
  explanation: string;
}>;

export const SYNTHETIC_SQL_SCHEMA = {
  servers: [
    ["1", "srv-web-01", "DMZ", "online"],
    ["2", "srv-api-02", "DMZ", "online"],
    ["3", "srv-db-01", "LAN", "online"],
    ["4", "srv-backup", "LAN", "maintenance"],
  ],
  incidents: [
    ["101", "1", "HIGH", "2026-11-20", "resolved"],
    ["102", "2", "CRITICAL", "2026-11-21", "open"],
    ["103", "2", "HIGH", "2026-11-22", "open"],
    ["104", "3", "MEDIUM", "2026-11-22", "resolved"],
  ],
} as const;

export const SQL_CHALLENGES: readonly SqlChallenge[] = [
  {
    id: "sql-filter-open",
    title: "1. Filtrer & trier les incidents ouverts",
    ueTag: "CYU L3 S5 · SQL Fondamentaux",
    schemaSummary: "incidents(id, server_id, severity, created_at, status)",
    prompt: "Affiche l'id et la sévérité des incidents dont le statut est 'open', triés par date décroissante.",
    expectedKeywords: ["select", "id", "severity", "from incidents", "where", "status", "'open'", "order by", "desc"],
    modelQuery: "SELECT id, severity FROM incidents WHERE status = 'open' ORDER BY created_at DESC;",
    tokenBank: ["SELECT", "id, severity", "FROM incidents", "WHERE status = 'open'", "ORDER BY created_at DESC", "GROUP BY status"],
    expectedPreviewColumns: ["id", "severity"],
    expectedPreviewRows: [
      ["103", "HIGH"],
      ["102", "CRITICAL"],
    ],
    explanation: "WHERE filtre avant le tri ORDER BY ... DESC (du plus récent au plus ancien).",
  },
  {
    id: "sql-join-servers",
    title: "2. Jointure Serveurs ↔ Incidents",
    ueTag: "CYU L3 S5 · Jointures Relationnelles",
    schemaSummary: "servers(id, hostname, zone) · incidents(id, server_id, severity, status)",
    prompt: "Liste le hostname et la sévérité pour chaque incident ouvert en joignant servers et incidents.",
    expectedKeywords: ["select", "hostname", "severity", "join", "on", "server_id", "'open'"],
    modelQuery:
      "SELECT s.hostname, i.severity FROM incidents i INNER JOIN servers s ON s.id = i.server_id WHERE i.status = 'open';",
    tokenBank: [
      "SELECT s.hostname, i.severity",
      "FROM incidents i",
      "INNER JOIN servers s",
      "ON s.id = i.server_id",
      "WHERE i.status = 'open'",
      "HAVING COUNT(*) > 1",
    ],
    expectedPreviewColumns: ["hostname", "severity"],
    expectedPreviewRows: [
      ["srv-api-02", "CRITICAL"],
      ["srv-api-02", "HIGH"],
    ],
    explanation: "INNER JOIN relie la clé étrangère incidents.server_id à la clé primaire servers.id.",
  },
  {
    id: "sql-group-having",
    title: "3. Agrégation GROUP BY + HAVING",
    ueTag: "CYU L3 S5 · Agrégats SQL",
    schemaSummary: "incidents(id, server_id, severity, status)",
    prompt: "Trouve les server_id ayant au moins 2 incidents au total (avec COUNT et HAVING).",
    expectedKeywords: ["select", "server_id", "count(", "from incidents", "group by server_id", "having"],
    modelQuery: "SELECT server_id, COUNT(*) AS total FROM incidents GROUP BY server_id HAVING COUNT(*) >= 2;",
    tokenBank: [
      "SELECT server_id, COUNT(*) AS total",
      "FROM incidents",
      "GROUP BY server_id",
      "HAVING COUNT(*) >= 2",
      "WHERE COUNT(*) >= 2",
    ],
    expectedPreviewColumns: ["server_id", "total"],
    expectedPreviewRows: [["2", "2"]],
    explanation: "On ne peut jamais filtrer un agrégat COUNT(*) dans WHERE : il faut toujours utiliser HAVING après GROUP BY.",
  },
  {
    id: "sql-left-join-zero",
    title: "4. Trouver les serveurs sans aucun incident",
    ueTag: "CYU L3 S5 · LEFT JOIN & NULL",
    schemaSummary: "servers(id, hostname) · incidents(id, server_id)",
    prompt: "Affiche le hostname des serveurs qui n'ont aucun incident enregistré (LEFT JOIN + IS NULL).",
    expectedKeywords: ["select", "hostname", "from servers", "left join incidents", "is null"],
    modelQuery:
      "SELECT s.hostname FROM servers s LEFT JOIN incidents i ON s.id = i.server_id WHERE i.id IS NULL;",
    tokenBank: [
      "SELECT s.hostname",
      "FROM servers s",
      "LEFT JOIN incidents i",
      "ON s.id = i.server_id",
      "WHERE i.id IS NULL",
      "INNER JOIN incidents i",
    ],
    expectedPreviewColumns: ["hostname"],
    expectedPreviewRows: [["srv-backup"]],
    explanation: "LEFT JOIN conserve tous les serveurs ; filtrer WHERE i.id IS NULL isole ceux sans correspondance.",
  },
];

export function evaluateSqlQuery(
  challenge: SqlChallenge,
  userSql: string,
): Readonly<{ correct: boolean; missingKeywords: readonly string[]; feedback: string }> {
  const normalized = userSql.toLowerCase().replace(/\s+/g, " ").trim();
  const missingKeywords = challenge.expectedKeywords.filter(
    (kw) => !normalized.includes(kw.toLowerCase()),
  );
  if (missingKeywords.length === 0) {
    return {
      correct: true,
      missingKeywords: [],
      feedback: `Requête valide ! ${challenge.explanation}`,
    };
  }
  return {
    correct: false,
    missingKeywords,
    feedback: `Élément(s) attendu(s) manquant(s) : ${missingKeywords.join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Algorithms, Graphs (BFS/DFS/Dijkstra), OS Scheduling & Code Review Drills
// ---------------------------------------------------------------------------

export type CsDrillCategory = "Graphes & Algo" | "Systèmes OS" | "BDD & Normalisation" | "Code Review";

export type CsDrillQuestion = Readonly<{
  id: string;
  category: CsDrillCategory;
  ueTag: string;
  title: string;
  snippet?: string;
  question: string;
  choices: readonly string[];
  correctAnswer: string;
  explanation: string;
}>;

export const CS_DRILL_QUESTIONS: readonly CsDrillQuestion[] = [
  {
    id: "cs-bfs-order",
    category: "Graphes & Algo",
    ueTag: "CYU L3 S6 · Graphes",
    title: "Parcours en largeur (BFS)",
    snippet: "Graphe non orienté : A relié à [B, C] · B relié à [D, E] · C relié à [F]\nDépart : A (ordre alphabétique des voisins)",
    question: "Quel est l'ordre exact de visite produit par un BFS (file FIFO) depuis A ?",
    choices: [
      "A → B → C → D → E → F",
      "A → B → D → E → C → F",
      "A → C → F → B → D → E",
    ],
    correctAnswer: "A → B → C → D → E → F",
    explanation: "Le BFS explore niveau par niveau grâce à une file (FIFO) : d'abord distance 0 (A), puis distance 1 (B, C), puis distance 2 (D, E, F).",
  },
  {
    id: "cs-dijkstra-path",
    category: "Graphes & Algo",
    ueTag: "CYU L3 S6 · Plus court chemin",
    title: "Algorithme de Dijkstra",
    snippet: "Arêtes pondérées : A→B (2), A→C (7), B→C (3), B→D (6), C→D (1)",
    question: "Quelle est la distance minimale de A vers D trouvée par Dijkstra ?",
    choices: [
      "6 (via A → B → C → D : 2 + 3 + 1)",
      "8 (via A → B → D : 2 + 6)",
      "8 (via A → C → D : 7 + 1)",
    ],
    correctAnswer: "6 (via A → B → C → D : 2 + 3 + 1)",
    explanation: "Passer par B puis C coûte 2 + 3 = 5 jusqu'à C, puis +1 vers D = 6, battant les chemins directs à 8.",
  },
  {
    id: "cs-bigo-lookup",
    category: "Graphes & Algo",
    ueTag: "CYU L3 S5 · Complexité",
    title: "Optimisation d'une double boucle",
    snippet: "for (const id of requestedIds) {\n  const found = users.find((u) => u.id === id);\n}",
    question: "Quelle est la complexité actuelle (N requêtes, M utilisateurs) et comment passer en O(N + M) ?",
    choices: [
      "Actuellement O(N × M) ; construire une Map<id, User> avant la boucle ramène chaque accès à O(1)",
      "Actuellement O(log N) ; utiliser Array.filter est plus rapide",
      "Actuellement O(1) ; aucune optimisation utile",
    ],
    correctAnswer:
      "Actuellement O(N × M) ; construire une Map<id, User> avant la boucle ramène chaque accès à O(1)",
    explanation: "Array.find dans une boucle produit une complexité quadratique O(N×M). Une table de hachage (Map) coûte O(M) à bâtir puis O(1) par recherche.",
  },
  {
    id: "cs-os-rr",
    category: "Systèmes OS",
    ueTag: "CYU L3 S6 · Ordonnancement",
    title: "Ordonnancement Round-Robin (quantum q = 2)",
    snippet: "Tous arrivés à t=0 : P1 (durée 5), P2 (durée 2), P3 (durée 3)",
    question: "À quel instant t le processus P2 se termine-t-il en Round-Robin (q = 2) ?",
    choices: [
      "t = 4 (P1 tourne [0..2], puis P2 tourne [2..4] et termine)",
      "t = 2 (P2 passe en premier car il est plus court)",
      "t = 7 (P1 termine d'abord à t=5 puis P2 à t=7)",
    ],
    correctAnswer: "t = 4 (P1 tourne [0..2], puis P2 tourne [2..4] et termine)",
    explanation: "En Round-Robin (q=2), P1 reçoit 2 unités (reste 3), puis P2 reçoit 2 unités et termine immédiatement à t=4.",
  },
  {
    id: "cs-os-deadlock",
    category: "Systèmes OS",
    ueTag: "CYU L3 S6 · Concurrence",
    title: "Condition d'interblocage (Deadlock)",
    snippet: "Thread 1 : lock(A) puis attend lock(B)\nThread 2 : lock(B) puis attend lock(A)",
    question: "Quelle approche prévient proprement cet interblocage (condition d'attente circulaire) ?",
    choices: [
      "Imposer un ordre global strict d'acquisition des verrous (toujours lock(A) avant lock(B))",
      "Ajouter un sleep(100ms) aléatoire avant lock(A)",
      "Augmenter la RAM de la machine",
    ],
    correctAnswer:
      "Imposer un ordre global strict d'acquisition des verrous (toujours lock(A) avant lock(B))",
    explanation: "Casser la condition d'attente circulaire (l'une des 4 conditions de Coffman) rend ce deadlock mathématiquement impossible.",
  },
  {
    id: "cs-db-3nf",
    category: "BDD & Normalisation",
    ueTag: "CYU L3 S5 · Modèle Relationnel",
    title: "Détecter une violation de 3e Forme Normale (3NF)",
    snippet: "Table Commandes(cmd_id, client_id, client_email, client_ville, montant)",
    question: "Pourquoi cette table viole-t-elle la 3NF ?",
    choices: [
      "client_email et client_ville dépendent de client_id (dépendance transitive), pas directement de cmd_id",
      "Une table ne peut pas contenir plus de 4 colonnes",
      "montant devrait être une clé primaire",
    ],
    correctAnswer:
      "client_email et client_ville dépendent de client_id (dépendance transitive), pas directement de cmd_id",
    explanation: "Séparer Clients(client_id, email, ville) évite de dupliquer l'e-mail sur chaque commande et supprime les anomalies de mise à jour.",
  },
  {
    id: "cs-db-index",
    category: "BDD & Normalisation",
    ueTag: "CYU L3 S5 · Performance SQL",
    title: "Choisir le bon index B-Tree",
    snippet: "Requête fréquente (500/s) :\nSELECT * FROM logs WHERE tenant_id = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 50;",
    question: "Quel index composite offre les meilleures performances ?",
    choices: [
      "CREATE INDEX idx_logs_tenant_created ON logs (tenant_id, created_at DESC)",
      "CREATE INDEX idx_logs_message ON logs (message)",
      "Supprimer la clé primaire id",
    ],
    correctAnswer: "CREATE INDEX idx_logs_tenant_created ON logs (tenant_id, created_at DESC)",
    explanation: "Règle d'or B-Tree : colonne d'égalité d'abord (tenant_id), puis colonne de plage/tri (created_at DESC).",
  },
  {
    id: "cs-review-edgecase",
    category: "Code Review",
    ueTag: "CYU LP Dev · Qualité & Tests",
    title: "Bug de cas limite en revue de code",
    snippet: "function average(scores: number[]): number {\n  return scores.reduce((a, b) => a + b, 0) / scores.length;\n}",
    question: "Quel bug de cas limite faut-il signaler en Pull Request ?",
    choices: [
      "Si scores est vide ([]), 0 / 0 renvoie NaN au lieu de 0 ou d'une erreur explicite",
      "reduce ne fonctionne pas sur des nombres",
      "La fonction devrait utiliser var au lieu de const",
    ],
    correctAnswer:
      "Si scores est vide ([]), 0 / 0 renvoie NaN au lieu de 0 ou d'une erreur explicite",
    explanation: "Toujours vérifier les bornes (tableau vide, division par zéro, valeurs nulles) et couvrir le cas limite par un test unitaire.",
  },
];
