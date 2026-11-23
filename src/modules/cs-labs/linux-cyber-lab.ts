/**
 * Pure TypeScript virtual Linux terminal sandbox & SOC/Firewall Cybersecurity Lab
 * aligned with CYU LP Réseaux & Cybersécurité (LPRC).
 * ZERO real shell calls, ZERO host filesystem access — 100% synthetic in-memory simulation.
 */

export type VirtualFile = Readonly<{
  path: string;
  permissions: string;
  owner: string;
  content: string;
}>;

export type VirtualService = Readonly<{
  name: string;
  status: "active" | "inactive";
  port: string | null;
  bindAddress: string | null;
  description: string;
}>;

export type VirtualOsState = Readonly<{
  hostname: string;
  files: Readonly<Record<string, VirtualFile>>;
  services: Readonly<Record<string, VirtualService>>;
  blockedIps: readonly string[];
  allowedPorts: readonly string[];
  commandCount: number;
}>;

export type LinuxMission = Readonly<{
  id: string;
  title: string;
  ueTag: string;
  difficulty: "B1" | "B2";
  briefing: string;
  hints: readonly string[];
  suggestedCommands: readonly string[];
  initialState: VirtualOsState;
  isSolved: (state: VirtualOsState) => boolean;
  successSummary: string;
}>;

export type TerminalOutput = Readonly<{
  nextState: VirtualOsState;
  stdout: string;
  isError: boolean;
}>;

function baseFiles(): Record<string, VirtualFile> {
  return {
    "/home/apprentice/.ssh/id_ed25519": {
      path: "/home/apprentice/.ssh/id_ed25519",
      permissions: "-rw-r--r--",
      owner: "apprentice:apprentice",
      content: "-----BEGIN SYNTHETIC TEST KEY-----\n[SYNTHETIC-NON-FUNCTIONAL-FIXTURE]\n-----END SYNTHETIC TEST KEY-----",
    },
    "/var/log/auth.log": {
      path: "/var/log/auth.log",
      permissions: "-rw-r-----",
      owner: "root:adm",
      content: [
        "Nov 22 08:11:02 cyu-srv sshd[901]: Accepted publickey for apprentice from 10.10.2.15 port 51204",
        "Nov 22 08:14:10 cyu-srv sshd[944]: Failed password for root from 203.0.113.45 port 44102 ssh2",
        "Nov 22 08:14:12 cyu-srv sshd[945]: Failed password for root from 203.0.113.45 port 44108 ssh2",
        "Nov 22 08:14:14 cyu-srv sshd[946]: Failed password for admin from 203.0.113.45 port 44115 ssh2",
        "Nov 22 08:14:16 cyu-srv sshd[947]: Failed password for root from 203.0.113.45 port 44120 ssh2",
      ].join("\n"),
    },
    "/etc/ssh/sshd_config": {
      path: "/etc/ssh/sshd_config",
      permissions: "-rw-r--r--",
      owner: "root:root",
      content: [
        "Port 22",
        "PermitRootLogin no",
        "PasswordAuthentication no",
        "PubkeyAuthentication yes",
      ].join("\n"),
    },
    "/etc/resolv.conf": {
      path: "/etc/resolv.conf",
      permissions: "-rw-r--r--",
      owner: "root:root",
      content: "nameserver 10.10.0.53\nsearch lab.cyu.local",
    },
  };
}

function baseServices(): Record<string, VirtualService> {
  return {
    ssh: {
      name: "ssh",
      status: "active",
      port: "22",
      bindAddress: "0.0.0.0",
      description: "OpenSSH Server",
    },
    nginx: {
      name: "nginx",
      status: "active",
      port: "443",
      bindAddress: "0.0.0.0",
      description: "Reverse Proxy HTTPS",
    },
    "telnet-legacy": {
      name: "telnet-legacy",
      status: "active",
      port: "23",
      bindAddress: "0.0.0.0",
      description: "Service Telnet non chiffré (obsolète)",
    },
    postgres: {
      name: "postgres",
      status: "active",
      port: "5432",
      bindAddress: "127.0.0.1",
      description: "PostgreSQL (local uniquement)",
    },
  };
}

function normalizePath(raw: string): string {
  const trimmed = raw.trim().replace(/^~\//, "/home/apprentice/");
  if (trimmed === "~" || trimmed === "~/.ssh") return "/home/apprentice/.ssh";
  return trimmed.startsWith("/") ? trimmed : `/home/apprentice/${trimmed}`;
}

function octalToMode(octal: string): string | null {
  if (!/^[0-7]{3}$/.test(octal)) return null;
  const map = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
  return `-${map[Number(octal[0])]}${map[Number(octal[1])]}${map[Number(octal[2])]}`;
}

/** Pure sandbox command evaluator — safe, deterministic, zero host interaction. */
export function runVirtualLinuxCommand(
  state: VirtualOsState,
  rawCommand: string,
): TerminalOutput {
  const input = rawCommand.trim();
  if (!input) {
    return { nextState: state, stdout: "", isError: false };
  }
  const tokens = input.split(/\s+/);
  const cmd = tokens[0].toLowerCase();
  const nextBase: VirtualOsState = { ...state, commandCount: state.commandCount + 1 };

  if (cmd === "help") {
    return {
      nextState: nextBase,
      stdout: [
        "Commandes disponibles dans la sandbox Linux CYU :",
        "  ls -la [chemin]            Lister les fichiers et permissions",
        "  cat <fichier>              Lire le contenu d'un fichier",
        "  grep <motif> <fichier>     Filtrer les lignes d'un fichier/log",
        "  chmod <600|640|644> <fic>  Modifier les permissions octales",
        "  ss -tulpn                  Afficher les ports TCP en écoute",
        "  ip a | ip route            Afficher les interfaces et routes IP",
        "  systemctl status|stop|start|restart <service>",
        "  ufw status | ufw deny from <ip>",
      ].join("\n"),
      isError: false,
    };
  }

  if (cmd === "ls") {
    const targetArg = tokens.find((t, idx) => idx > 0 && !t.startsWith("-"));
    const prefix = targetArg ? normalizePath(targetArg) : "/home/apprentice/.ssh";
    const matches = Object.values(state.files).filter(
      (f) => f.path === prefix || f.path.startsWith(`${prefix}/`),
    );
    if (matches.length === 0) {
      return { nextState: nextBase, stdout: `ls: impossible d'accéder à '${targetArg ?? prefix}': Aucun fichier`, isError: true };
    }
    const lines = matches.map((f) => `${f.permissions} 1 ${f.owner} ${f.path}`);
    return { nextState: nextBase, stdout: lines.join("\n"), isError: false };
  }

  if (cmd === "cat") {
    const target = tokens[1] ? normalizePath(tokens[1]) : "";
    const file = state.files[target];
    if (!file) {
      return { nextState: nextBase, stdout: `cat: ${tokens[1] ?? ""}: Aucun fichier de ce type`, isError: true };
    }
    return { nextState: nextBase, stdout: file.content, isError: false };
  }

  if (cmd === "grep") {
    const pattern = (tokens[1] ?? "").replace(/^["']|["']$/g, "");
    const target = tokens[2] ? normalizePath(tokens[2]) : "";
    const file = state.files[target];
    if (!pattern || !file) {
      return { nextState: nextBase, stdout: "Usage: grep <motif> <fichier>", isError: true };
    }
    const matched = file.content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(pattern.toLowerCase()));
    return {
      nextState: nextBase,
      stdout: matched.length > 0 ? matched.join("\n") : "(aucune ligne correspondante)",
      isError: false,
    };
  }

  if (cmd === "chmod") {
    const modeArg = tokens[1] ?? "";
    const target = tokens[2] ? normalizePath(tokens[2]) : "";
    const file = state.files[target];
    const permString = octalToMode(modeArg);
    if (!permString || !file) {
      return { nextState: nextBase, stdout: "Usage: chmod <mode-octal-3-chiffres> <fichier>", isError: true };
    }
    const updated: VirtualOsState = {
      ...nextBase,
      files: {
        ...state.files,
        [target]: { ...file, permissions: permString },
      },
    };
    return {
      nextState: updated,
      stdout: `Permissions mises à jour : ${permString} ${target}`,
      isError: false,
    };
  }

  if (cmd === "ss") {
    const listening = Object.values(state.services)
      .filter((s) => s.status === "active" && s.port)
      .map((s) => `LISTEN  0  128  ${s.bindAddress}:${s.port}  users:(("${s.name}"))`);
    return {
      nextState: nextBase,
      stdout: ["Netid   State   Recv-Q  Local Address:Port   Process", ...listening].join("\n"),
      isError: false,
    };
  }

  if (cmd === "ip") {
    const sub = tokens[1]?.toLowerCase() ?? "a";
    if (sub === "route" || sub === "r") {
      return {
        nextState: nextBase,
        stdout: [
          "default via 10.10.0.1 dev eth0 proto static",
          "10.10.0.0/24 dev eth0 proto kernel scope link src 10.10.0.42",
        ].join("\n"),
        isError: false,
      };
    }
    return {
      nextState: nextBase,
      stdout: [
        "1: lo: <LOOPBACK,UP> inet 127.0.0.1/8",
        "2: eth0: <BROADCAST,MULTICAST,UP> inet 10.10.0.42/24 brd 10.10.0.255",
      ].join("\n"),
      isError: false,
    };
  }

  if (cmd === "systemctl") {
    const action = tokens[1]?.toLowerCase();
    const svcName = tokens[2]?.toLowerCase() ?? "";
    const service = state.services[svcName];
    if (!action || !service) {
      return {
        nextState: nextBase,
        stdout: `systemctl: service introuvable (${svcName || "aucun"}). Essayez: ssh, nginx, telnet-legacy, postgres`,
        isError: true,
      };
    }
    if (action === "status") {
      return {
        nextState: nextBase,
        stdout: `● ${service.name}.service - ${service.description}\n   Active: ${service.status === "active" ? "active (running)" : "inactive (dead)"}${service.port ? `\n   Port: ${service.bindAddress}:${service.port}` : ""}`,
        isError: false,
      };
    }
    if (action === "stop") {
      const updated: VirtualOsState = {
        ...nextBase,
        services: { ...state.services, [svcName]: { ...service, status: "inactive" } },
      };
      return { nextState: updated, stdout: `Service ${svcName} arrêté (inactive).`, isError: false };
    }
    if (action === "start" || action === "restart") {
      const updated: VirtualOsState = {
        ...nextBase,
        services: { ...state.services, [svcName]: { ...service, status: "active" } },
      };
      return { nextState: updated, stdout: `Service ${svcName} démarré (active).`, isError: false };
    }
    return { nextState: nextBase, stdout: `Action systemctl non supportée : ${action}`, isError: true };
  }

  if (cmd === "ufw") {
    const sub = tokens[1]?.toLowerCase();
    if (sub === "status") {
      const denyLines = state.blockedIps.map((ip) => `Anywhere                   DENY IN     ${ip}`);
      const allowLines = state.allowedPorts.map((p) => `${p.padEnd(26)} ALLOW IN    Anywhere`);
      return {
        nextState: nextBase,
        stdout: ["Status: active", "To                         Action      From", "--                         ------      ----", ...allowLines, ...denyLines].join("\n"),
        isError: false,
      };
    }
    if (sub === "deny" && tokens[2]?.toLowerCase() === "from" && tokens[3]) {
      const ip = tokens[3];
      if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
        return { nextState: nextBase, stdout: `Adresse IPv4 invalide : ${ip}`, isError: true };
      }
      const blockedIps = state.blockedIps.includes(ip) ? state.blockedIps : [...state.blockedIps, ip];
      return {
        nextState: { ...nextBase, blockedIps },
        stdout: `Rule added: DENY IN from ${ip}`,
        isError: false,
      };
    }
    return { nextState: nextBase, stdout: "Usage: ufw status | ufw deny from <ip>", isError: true };
  }

  return {
    nextState: nextBase,
    stdout: `${cmd}: commande non reconnue dans cette sandbox. Tapez 'help' pour la liste.`,
    isError: true,
  };
}

export const LINUX_MISSIONS: readonly LinuxMission[] = [
  {
    id: "linux-ssh-chmod",
    title: "1. Sécuriser une clé privée SSH",
    ueTag: "CYU LPRC · Admin Linux",
    difficulty: "B1",
    briefing:
      "SSH refuse d'utiliser la clé ~/.ssh/id_ed25519 car ses droits sont trop ouverts (lisible par tous). Vérifie les droits puis applique le mode strict 600.",
    hints: [
      "Vérifie d'abord les permissions actuelles avec : ls -la ~/.ssh",
      "Applique la lecture/écriture uniquement pour le propriétaire : chmod 600 ~/.ssh/id_ed25519",
    ],
    suggestedCommands: ["ls -la ~/.ssh", "chmod 600 ~/.ssh/id_ed25519"],
    initialState: {
      hostname: "cyu-srv",
      files: baseFiles(),
      services: baseServices(),
      blockedIps: [],
      allowedPorts: ["22/tcp", "443/tcp"],
      commandCount: 0,
    },
    isSolved: (state) => state.files["/home/apprentice/.ssh/id_ed25519"]?.permissions === "-rw-------",
    successSummary: "Parfait ! En 600 (-rw-------), seul le propriétaire peut lire la clé privée SSH.",
  },
  {
    id: "linux-bruteforce-ufw",
    title: "2. Bloquer une attaque brute-force SSH",
    ueTag: "CYU LPRC · Logs & Pare-feu",
    difficulty: "B2",
    briefing:
      "Inspecte /var/log/auth.log pour trouver l'adresse IP qui échoue en boucle sur SSH, puis bloque-la sur le pare-feu UFW.",
    hints: [
      "Filtre les échecs avec : grep Failed /var/log/auth.log",
      "Bloque l'IP repérée avec : ufw deny from 203.0.113.45",
    ],
    suggestedCommands: ["grep Failed /var/log/auth.log", "ufw deny from 203.0.113.45", "ufw status"],
    initialState: {
      hostname: "cyu-srv",
      files: baseFiles(),
      services: baseServices(),
      blockedIps: [],
      allowedPorts: ["22/tcp", "443/tcp"],
      commandCount: 0,
    },
    isSolved: (state) => state.blockedIps.includes("203.0.113.45"),
    successSummary: "Attaque contenue ! L'IP 203.0.113.45 est bloquée en entrée sur UFW.",
  },
  {
    id: "linux-stop-telnet",
    title: "3. Fermer un service obsolète exposé",
    ueTag: "CYU LPRC · Durcissement OS",
    difficulty: "B1",
    briefing:
      "Un audit signale un service non chiffré en écoute sur 0.0.0.0. Identifie-le via ss -tulpn et arrête-le avec systemctl.",
    hints: [
      "Liste les ports ouverts : ss -tulpn",
      "Arrête le service en clair : systemctl stop telnet-legacy",
    ],
    suggestedCommands: ["ss -tulpn", "systemctl status telnet-legacy", "systemctl stop telnet-legacy"],
    initialState: {
      hostname: "cyu-srv",
      files: baseFiles(),
      services: baseServices(),
      blockedIps: [],
      allowedPorts: ["22/tcp", "443/tcp"],
      commandCount: 0,
    },
    isSolved: (state) => state.services["telnet-legacy"]?.status === "inactive",
    successSummary: "Surface d'attaque réduite ! Le port 23 (Telnet en clair) est fermé.",
  },
  {
    id: "linux-restart-nginx",
    title: "4. Rétablir le reverse proxy HTTPS",
    ueTag: "CYU LPRC · Exploitation",
    difficulty: "B1",
    briefing:
      "Le portail HTTPS ne répond plus sur le port 443. Vérifie l'état de nginx puis redémarre le service.",
    hints: [
      "Vérifie l'état du service : systemctl status nginx",
      "Relance le service : systemctl restart nginx",
    ],
    suggestedCommands: ["systemctl status nginx", "systemctl restart nginx", "ss -tulpn"],
    initialState: {
      hostname: "cyu-srv",
      files: baseFiles(),
      services: {
        ...baseServices(),
        nginx: { ...baseServices().nginx, status: "inactive" },
      },
      blockedIps: [],
      allowedPorts: ["22/tcp", "443/tcp"],
      commandCount: 0,
    },
    isSolved: (state) => state.services.nginx?.status === "active",
    successSummary: "Service rétabli ! Nginx écoute de nouveau sur 0.0.0.0:443.",
  },
];

// ---------------------------------------------------------------------------
// SOC Incident Triage & Firewall ACL Lab
// ---------------------------------------------------------------------------

export type SocTriageCase = Readonly<{
  id: string;
  title: string;
  ueTag: string;
  severity: "Haute" | "Critique" | "Moyenne";
  artifactTitle: string;
  artifactSnippet: string;
  question: string;
  choices: readonly string[];
  correctAnswer: string;
  explanation: string;
  englishReportLine: string;
}>;

export const SOC_TRIAGE_CASES: readonly SocTriageCase[] = [
  {
    id: "soc-sqli",
    title: "Requête Web suspecte sur /api/login",
    ueTag: "OWASP A03 · Injection",
    severity: "Critique",
    artifactTitle: "Extrait access.log",
    artifactSnippet: `POST /api/login HTTP/1.1\nBody: {"email":"admin@lab.test' OR '1'='1' --","password":"x"}\nSQL exécuté: SELECT * FROM users WHERE email = 'admin@lab.test' OR '1'='1' --'`,
    question: "Quelle correction structurelle élimine définitivement cette faille ?",
    choices: [
      "Utiliser des requêtes paramétrées (prepared statements / ORM) et ne jamais concaténer l'entrée utilisateur",
      "Cacher l'URL /api/login dans le menu du site",
      "Passer le serveur en HTTPS uniquement",
    ],
    correctAnswer:
      "Utiliser des requêtes paramétrées (prepared statements / ORM) et ne jamais concaténer l'entrée utilisateur",
    explanation:
      "Les requêtes paramétrées séparent strictement le code SQL des données ; HTTPS chiffre le transport mais n'empêche pas une injection SQL.",
    englishReportLine:
      "We mitigated the SQL injection risk by replacing string concatenation with parameterized queries.",
  },
  {
    id: "soc-firewall-shadow",
    title: "Règle pare-feu masquée (Shadowing)",
    ueTag: "CYU LPRC · Pare-feu & ACL",
    severity: "Haute",
    artifactTitle: "Table ACL (ordre d'évaluation top-down)",
    artifactSnippet: [
      "Rule 1: ALLOW  SRC=ANY          DST=DMZ:443   PROTO=TCP",
      "Rule 2: ALLOW  SRC=ANY          DST=LAN:5432  PROTO=TCP",
      "Rule 3: DENY   SRC=ANY          DST=LAN:ANY   PROTO=ANY",
    ].join("\n"),
    question: "Quel est le défaut critique dans cette politique ACL ?",
    choices: [
      "La règle 2 expose le port PostgreSQL (5432) du LAN interne à tout Internet avant la règle DENY",
      "La règle 1 autorise HTTPS vers la DMZ",
      "La règle 3 bloque le trafic par défaut",
    ],
    correctAnswer:
      "La règle 2 expose le port PostgreSQL (5432) du LAN interne à tout Internet avant la règle DENY",
    explanation:
      "Un pare-feu évalue les règles de haut en bas (first-match). La BDD interne (LAN:5432) ne doit être accessible que depuis le serveur applicatif en DMZ, jamais depuis ANY.",
    englishReportLine:
      "We restricted port 5432 so only the DMZ application tier can reach the internal database.",
  },
  {
    id: "soc-phishing-spf",
    title: "Analyse d'en-têtes d'un e-mail urgent",
    ueTag: "CYU LPRC · Sécurité Messagerie",
    severity: "Haute",
    artifactTitle: "En-têtes SMTP",
    artifactSnippet: [
      "From: \"Direction Financière\" <ceo@entreprise-exemple.fr>",
      "Return-Path: <bounce@promo-externe-xyz.invalid>",
      "Authentication-Results: spf=fail; dkim=none; dmarc=fail",
    ].join("\n"),
    question: "Que prouve l'analyse de ces en-têtes ?",
    choices: [
      "Une usurpation d'adresse expéditeur (spoofing / phishing) confirmée par l'échec SPF et DMARC",
      "Un simple problème de certificat TLS sur le navigateur",
      "Un message légitime envoyé depuis un téléphone mobile",
    ],
    correctAnswer:
      "Une usurpation d'adresse expéditeur (spoofing / phishing) confirmée par l'échec SPF et DMARC",
    explanation:
      "SPF=fail et DMARC=fail indiquent que le serveur émetteur n'est pas autorisé à envoyer au nom du domaine affiché dans le champ From.",
    englishReportLine:
      "Header inspection confirmed domain spoofing (SPF and DMARC failed), so we quarantined the message.",
  },
  {
    id: "soc-password-storage",
    title: "Stockage des mots de passe en base",
    ueTag: "CYU LPRC · Cryptographie",
    severity: "Critique",
    artifactTitle: "Extrait de table users (audit interne)",
    artifactSnippet: `user_id | email              | password_hash\n104     | dev@lab.test       | 5f4dcc3b5aa765d61d8327deb882cf99  (MD5 sans sel)`,
    question: "Quelle pratique cryptographique est attendue pour les mots de passe ?",
    choices: [
      "Hacher avec un algorithme lent et salé dédié (Argon2id ou bcrypt) avec un sel unique par utilisateur",
      "Chiffrer en Base64 pour masquer le mot de passe",
      "Utiliser SHA-1 sans sel car il est plus rapide",
    ],
    correctAnswer:
      "Hacher avec un algorithme lent et salé dédié (Argon2id ou bcrypt) avec un sel unique par utilisateur",
    explanation:
      "MD5/SHA-1 sont trop rapides et vulnérables aux tables arc-en-ciel et GPU. Argon2id ou bcrypt + sel unique ralentissent drastiquement le cassage hors-ligne.",
    englishReportLine:
      "We migrated legacy MD5 hashes to salted Argon2id digests to safeguard user credentials.",
  },
];
