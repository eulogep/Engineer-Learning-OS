/**
 * Pure deterministic Networking Lab engine aligned with CYU LPRC (CCNA1) & L3 S5 Réseaux.
 * Covers IPv4/CIDR subnetting with binary breakdowns, routing table Longest Prefix Match,
 * and protocol encapsulation / handshake sequences. 100% synthetic & local.
 */

export type SubnetDifficulty = "B1" | "B2" | "EXPERT";

export type SubnetCalculation = Readonly<{
  ip: string;
  prefix: number;
  cidr: string;
  subnetMask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  binaryIp: string;
  binaryMask: string;
  binaryNetwork: string;
}>;

export type SubnetChallenge = Readonly<{
  id: string;
  difficulty: SubnetDifficulty;
  ip: string;
  prefix: number;
  prompt: string;
  solution: SubnetCalculation;
  stepsExplanation: readonly string[];
}>;

export type SubnetAnswerInput = Readonly<{
  networkAddress: string;
  broadcastAddress: string;
  usableHosts: string;
}>;

export type SubnetEvaluation = Readonly<{
  allCorrect: boolean;
  networkCorrect: boolean;
  broadcastCorrect: boolean;
  usableHostsCorrect: boolean;
}>;

export function ipToUint32(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function uint32ToIp(value: number): string {
  const u = value >>> 0;
  return `${(u >>> 24) & 255}.${(u >>> 16) & 255}.${(u >>> 8) & 255}.${u & 255}`;
}

export function uint32ToBinaryDotted(value: number): string {
  const bits = (value >>> 0).toString(2).padStart(32, "0");
  return `${bits.slice(0, 8)}.${bits.slice(8, 16)}.${bits.slice(16, 24)}.${bits.slice(24, 32)}`;
}

export function prefixToMask(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${prefix}`);
  }
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** Computes exact IPv4 subnet parameters using 32-bit unsigned bitwise operations. */
export function computeSubnet(ip: string, prefix: number): SubnetCalculation {
  const ipNum = ipToUint32(ip);
  const maskNum = prefixToMask(prefix);
  const wildcardNum = (~maskNum) >>> 0;
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | wildcardNum) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);
  const usableHosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.max(0, totalAddresses - 2);
  const firstHostNum = prefix >= 31 ? networkNum : (networkNum + 1) >>> 0;
  const lastHostNum = prefix >= 31 ? broadcastNum : (broadcastNum - 1) >>> 0;

  return {
    ip: uint32ToIp(ipNum),
    prefix,
    cidr: `${uint32ToIp(ipNum)}/${prefix}`,
    subnetMask: uint32ToIp(maskNum),
    wildcardMask: uint32ToIp(wildcardNum),
    networkAddress: uint32ToIp(networkNum),
    broadcastAddress: uint32ToIp(broadcastNum),
    firstHost: uint32ToIp(firstHostNum),
    lastHost: uint32ToIp(lastHostNum),
    totalAddresses,
    usableHosts,
    binaryIp: uint32ToBinaryDotted(ipNum),
    binaryMask: uint32ToBinaryDotted(maskNum),
    binaryNetwork: uint32ToBinaryDotted(networkNum),
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministically generates an IPv4 CIDR subnetting exercise with step-by-step binary solution. */
export function generateSubnetChallenge(seedKey: string, difficulty: SubnetDifficulty): SubnetChallenge {
  const rand = mulberry32(hashSeed(`subnet:${difficulty}:${seedKey}`));
  const prefixes =
    difficulty === "B1"
      ? [24, 25, 26, 27, 28]
      : difficulty === "B2"
        ? [22, 23, 25, 26, 27, 28, 29, 30]
        : [19, 20, 21, 22, 23, 26, 27, 29, 30];
  const prefix = prefixes[Math.floor(rand() * prefixes.length)];

  const bases: readonly [number, number][] = [
    [192, 168],
    [10, 10 + Math.floor(rand() * 80)],
    [172, 16 + Math.floor(rand() * 15)],
  ];
  const [o1, o2] = difficulty === "B1" ? [192, 168] : bases[Math.floor(rand() * bases.length)];
  const o3 = Math.floor(rand() * 200) + 1;
  const o4 = Math.floor(rand() * 250) + 2;
  const ip = `${o1}.${o2}.${o3}.${o4}`;
  const solution = computeSubnet(ip, prefix);
  const hostBits = 32 - prefix;

  const stepsExplanation = [
    `Masque /${prefix} = ${solution.subnetMask} (${prefix} bits réseau à 1, ${hostBits} bits hôte à 0).`,
    `Adresse réseau = IP AND Masque → ${solution.networkAddress}/${prefix}.`,
    `Adresse de broadcast = tous les ${hostBits} bits hôte à 1 → ${solution.broadcastAddress}.`,
    `Nombre d'hôtes utilisables = 2^${hostBits} − 2 = ${solution.totalAddresses} − 2 = ${solution.usableHosts} (plage ${solution.firstHost} → ${solution.lastHost}).`,
  ];

  return {
    id: `subnet-${difficulty}-${seedKey}`,
    difficulty,
    ip,
    prefix,
    prompt: `Calcule les caractéristiques du sous-réseau contenant l'hôte ${solution.cidr}`,
    solution,
    stepsExplanation,
  };
}

export function evaluateSubnetAnswer(
  challenge: SubnetChallenge,
  answer: SubnetAnswerInput,
): SubnetEvaluation {
  const networkCorrect = answer.networkAddress.trim() === challenge.solution.networkAddress;
  const broadcastCorrect = answer.broadcastAddress.trim() === challenge.solution.broadcastAddress;
  const parsedHosts = Number(answer.usableHosts.trim());
  const usableHostsCorrect =
    Number.isInteger(parsedHosts) && parsedHosts === challenge.solution.usableHosts;
  return {
    allCorrect: networkCorrect && broadcastCorrect && usableHostsCorrect,
    networkCorrect,
    broadcastCorrect,
    usableHostsCorrect,
  };
}

// ---------------------------------------------------------------------------
// Routing Table — Longest Prefix Match Simulator
// ---------------------------------------------------------------------------

export type RouteEntry = Readonly<{
  id: string;
  network: string;
  prefix: number;
  nextHop: string;
  iface: string;
  metric: string;
}>;

export type RoutingChallenge = Readonly<{
  id: string;
  title: string;
  context: string;
  destinationIp: string;
  routes: readonly RouteEntry[];
  expectedRouteId: string;
  explanation: string;
}>;

/** Exact IPv4 Longest Prefix Match resolution. */
export function solveLongestPrefixMatch(
  destinationIp: string,
  routes: readonly RouteEntry[],
): RouteEntry | null {
  const dest = ipToUint32(destinationIp);
  let best: RouteEntry | null = null;
  for (const route of routes) {
    const mask = prefixToMask(route.prefix);
    const routeNet = (ipToUint32(route.network) & mask) >>> 0;
    if (((dest & mask) >>> 0) === routeNet) {
      if (!best || route.prefix > best.prefix) {
        best = route;
      }
    }
  }
  return best;
}

export const ROUTING_CHALLENGES: readonly RoutingChallenge[] = [
  {
    id: "route-lpm-1",
    title: "Longest Prefix Match · Chevauchement /24 et /26",
    context: "Un routeur d'entreprise reçoit un paquet vers un serveur applicatif interne.",
    destinationIp: "10.20.4.75",
    routes: [
      { id: "r0", network: "0.0.0.0", prefix: 0, nextHop: "198.51.100.1", iface: "eth0 (WAN)", metric: "Static" },
      { id: "r1", network: "10.20.4.0", prefix: 24, nextHop: "10.0.0.2", iface: "eth1 (LAN-Core)", metric: "OSPF" },
      { id: "r2", network: "10.20.4.64", prefix: 26, nextHop: "10.0.0.9", iface: "eth2 (DMZ-Apps)", metric: "OSPF" },
      { id: "r3", network: "10.20.4.128", prefix: 26, nextHop: "10.0.0.14", iface: "eth3 (Admin)", metric: "OSPF" },
    ],
    expectedRouteId: "r2",
    explanation:
      "10.20.4.75 correspond à 0.0.0.0/0, 10.20.4.0/24 et 10.20.4.64/26 (plage .64–.127). Le routeur choisit toujours le préfixe le plus long (/26 → eth2).",
  },
  {
    id: "route-lpm-2",
    title: "Route par défaut vers Internet",
    context: "Un poste étudiant interroge un serveur DNS public externe.",
    destinationIp: "9.9.9.9",
    routes: [
      { id: "r0", network: "0.0.0.0", prefix: 0, nextHop: "203.0.113.1", iface: "wan0 (ISP)", metric: "Static" },
      { id: "r1", network: "172.16.0.0", prefix: 16, nextHop: "172.16.0.254", iface: "vlan10", metric: "Connected" },
      { id: "r2", network: "192.168.10.0", prefix: 24, nextHop: "172.16.0.2", iface: "vlan20", metric: "OSPF" },
    ],
    expectedRouteId: "r0",
    explanation:
      "Aucune route privée ne couvre 9.9.9.9 ; le paquet suit la passerelle par défaut 0.0.0.0/0 vers wan0.",
  },
  {
    id: "route-lpm-3",
    title: "Route hôte /32 prioritaire sur un /24",
    context: "Un pare-feu redirige le trafic d'un bastion spécifique vers un tunnel VPN dédié.",
    destinationIp: "192.168.50.10",
    routes: [
      { id: "r0", network: "192.168.0.0", prefix: 16, nextHop: "10.1.0.1", iface: "eth0", metric: "Summary" },
      { id: "r1", network: "192.168.50.0", prefix: 24, nextHop: "10.1.0.5", iface: "eth1", metric: "OSPF" },
      { id: "r2", network: "192.168.50.10", prefix: 32, nextHop: "10.99.0.1", iface: "wg0 (VPN)", metric: "Static" },
    ],
    expectedRouteId: "r2",
    explanation:
      "Une route /32 cible exactement une adresse IP unique et l'emporte sur toute route /24 ou /16.",
  },
];

// ---------------------------------------------------------------------------
// Interactive Protocol & Encapsulation Sequences (Visual Learning Extension)
// ---------------------------------------------------------------------------

export type ProtocolSequenceChallenge = Readonly<{
  id: string;
  title: string;
  ueTag: string;
  description: string;
  steps: readonly Readonly<{ id: string; label: string; detail: string }>[];
  initialOrder: readonly string[];
  expectedOrder: readonly string[];
  hint: string;
}>;

export const PROTOCOL_SEQUENCES: readonly ProtocolSequenceChallenge[] = [
  {
    id: "seq-encapsulation",
    title: "Encapsulation réseau (Émetteur → Câble)",
    ueTag: "CYU L3 / CCNA1 · Modèle OSI",
    description: "Remets dans l'ordre exact les unités de données lors de la descente dans la pile TCP/IP.",
    steps: [
      { id: "message", label: "Données / Message", detail: "Couche Application (HTTP, DNS, SSH)" },
      { id: "segment", label: "Segment (ou Datagramme UDP)", detail: "Couche Transport : ajout des ports source/dest" },
      { id: "packet", label: "Paquet IP", detail: "Couche Réseau : ajout des adresses IP source/dest" },
      { id: "frame", label: "Trame Ethernet", detail: "Couche Liaison : ajout des adresses MAC + FCS" },
      { id: "bits", label: "Bits (Signal physique)", detail: "Couche Physique : cuivre, fibre ou radio" },
    ],
    initialOrder: ["frame", "message", "bits", "packet", "segment"],
    expectedOrder: ["message", "segment", "packet", "frame", "bits"],
    hint: "Pars de l'application utilisateur vers le câble physique.",
  },
  {
    id: "seq-tcp-handshake",
    title: "Établissement TCP (3-Way Handshake)",
    ueTag: "CYU LPRC · Transport TCP",
    description: "Ordonne les étapes d'ouverture fiable d'une connexion TCP entre client et serveur.",
    steps: [
      { id: "syn", label: "1. Client → Serveur : SYN (seq=x)", detail: "Le client demande l'ouverture et propose son numéro de séquence" },
      { id: "syn-ack", label: "2. Serveur → Client : SYN-ACK (seq=y, ack=x+1)", detail: "Le serveur acquitte x et propose son propre numéro y" },
      { id: "ack", label: "3. Client → Serveur : ACK (ack=y+1)", detail: "Le client confirme la réception de y" },
      { id: "est", label: "4. État ESTABLISHED · Transfert de données", detail: "Le canal full-duplex est prêt" },
    ],
    initialOrder: ["ack", "syn", "est", "syn-ack"],
    expectedOrder: ["syn", "syn-ack", "ack", "est"],
    hint: "SYN d'abord, puis SYN-ACK du serveur, puis ACK final avant l'envoi de données.",
  },
  {
    id: "seq-dhcp-dora",
    title: "Attribution d'adresse IP (DHCP · DORA)",
    ueTag: "CYU LPRC · Services Réseaux",
    description: "Reconstruis l'échange complet permettant à un poste neuf d'obtenir une configuration IP.",
    steps: [
      { id: "discover", label: "DHCP Discover (Broadcast)", detail: "Le client sans IP cherche un serveur DHCP sur le LAN" },
      { id: "offer", label: "DHCP Offer", detail: "Le serveur propose une IP disponible + masque + passerelle" },
      { id: "request", label: "DHCP Request", detail: "Le client demande officiellement le bail proposé" },
      { id: "ack", label: "DHCP Acknowledge (ACK)", detail: "Le serveur valide et enregistre le bail (lease)" },
    ],
    initialOrder: ["request", "discover", "ack", "offer"],
    expectedOrder: ["discover", "offer", "request", "ack"],
    hint: "Pense à l'acronyme D-O-R-A : Discover, Offer, Request, Acknowledge.",
  },
  {
    id: "seq-https-flow",
    title: "Requête HTTPS sécurisée (DNS → TLS)",
    ueTag: "CYU LPRC · Sécurité & Web",
    description: "Ordonne le cycle complet lorsqu'un navigateur accède à https://api.example.test.",
    steps: [
      { id: "dns", label: "Résolution DNS (Nom → IP)", detail: "Obtention de l'adresse IP du serveur" },
      { id: "tcp", label: "Poignée de main TCP (Port 443)", detail: "Ouverture de la connexion transport" },
      { id: "tls", label: "Négociation TLS & vérification certificat", detail: "Authentification du serveur + échange de clés symétriques" },
      { id: "http", label: "Requête HTTP GET chiffrée", detail: "Envoi sécurisé des en-têtes et réception de la réponse" },
    ],
    initialOrder: ["tls", "dns", "http", "tcp"],
    expectedOrder: ["dns", "tcp", "tls", "http"],
    hint: "Il faut d'abord l'IP (DNS), puis le tuyau TCP, puis le chiffrement TLS, enfin la requête HTTP.",
  },
];
