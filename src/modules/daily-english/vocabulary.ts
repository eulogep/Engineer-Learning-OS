/**
 * Single source of truth for the Daily English vocabulary, shared by the
 * SQLite seed (`prisma/seed.ts`) and the browser-only mode. Generic, synthetic
 * learning content only: no personal or company data.
 */

export type VocabularyPackId = "core" | "networking" | "cybersecurity" | "meetings" | "career";
export type CefrLevel = "B1" | "B2";

export type VocabularyEntry = Readonly<{
  word: string;
  translation: string;
  category: string;
  example: string;
}>;

export type VocabularyPack = Readonly<{
  id: VocabularyPackId;
  label: string;
  level: CefrLevel;
  entries: readonly VocabularyEntry[];
}>;

const e = (word: string, translation: string, category: string, example: string): VocabularyEntry => ({ word, translation, category, example });

export const VOCABULARY_PACKS: readonly VocabularyPack[] = [
  {
    id: "core",
    label: "Essentiels",
    level: "B2",
    entries: [
      e("embrace", "accepter / adopter", "verbe", "Our team decided to embrace the new deployment process."),
      e("resilient", "résilient", "adjectif", "A resilient network keeps working when one link fails."),
      e("perspective", "perspective / point de vue", "nom", "Talking to users gave me a new perspective on the problem."),
      e("overcome", "surmonter", "verbe", "I want to overcome my fear of speaking English in meetings."),
      e("genuine", "authentique / sincère", "adjectif", "She showed a genuine interest in my project."),
      e("thrive", "s'épanouir / prospérer", "verbe", "Some people thrive under pressure."),
      e("subtle", "subtil", "adjectif", "There is a subtle difference between these two commands."),
      e("acknowledge", "reconnaître / admettre", "verbe", "He acknowledged the mistake and fixed it quickly."),
      e("meaningful", "significatif / plein de sens", "adjectif", "I want to do meaningful work during my apprenticeship."),
      e("approach", "aborder / approche", "verbe", "Let's approach this bug step by step."),
      e("reflection", "réflexion / reflet", "nom", "After the project, we wrote a short reflection on what went wrong."),
      e("collaborate", "collaborer", "verbe", "I collaborate with two developers on this application."),
      e("challenge", "défi / mettre au défi", "nom", "Learning subnetting was a real challenge for me."),
      e("inspire", "inspirer", "verbe", "My first internship inspired me to study cybersecurity."),
      e("curiosity", "curiosité", "nom", "Curiosity is one of the best qualities of an engineer."),
      e("adapt", "s'adapter / adapter", "verbe", "We had to adapt the plan when the server crashed."),
      e("empathy", "empathie", "nom", "Empathy helps you understand what users really need."),
      e("progress", "progrès / progresser", "nom", "I can see real progress in my listening skills."),
      e("accomplish", "accomplir / réaliser", "verbe", "What do you want to accomplish this semester?"),
      e("insight", "éclairage / compréhension fine", "nom", "The logs gave us useful insight into the attack."),
      e("determination", "détermination", "nom", "It took determination to finish the certification."),
      e("gratitude", "gratitude / reconnaissance", "nom", "I want to express my gratitude to my tutor."),
      e("influence", "influence / influencer", "nom", "Good documentation has a strong influence on a project."),
      e("explore", "explorer", "verbe", "This weekend I will explore a new Linux distribution."),
      e("significant", "important / significatif", "adjectif", "We saw a significant drop in response time."),
      e("struggle", "avoir du mal / lutter", "verbe", "I struggle to understand fast native speakers."),
      e("transform", "transformer", "verbe", "Automation can transform the way we work."),
      e("opportunity", "opportunité / occasion", "nom", "This apprenticeship is a great opportunity for me."),
      e("contribute", "contribuer", "verbe", "I would like to contribute to an open-source project."),
      e("intention", "intention", "nom", "My intention is to work in network security."),
    ],
  },
  {
    id: "networking",
    label: "Réseau",
    level: "B2",
    entries: [
      e("bandwidth", "bande passante", "nom", "Video calls use a lot of bandwidth."),
      e("latency", "latence", "nom", "High latency makes online games unplayable."),
      e("throughput", "débit effectif", "nom", "We measured the throughput between the two sites."),
      e("router", "routeur", "nom", "The router forwards packets between networks."),
      e("switch", "commutateur (switch)", "nom", "Every office computer is connected to the same switch."),
      e("gateway", "passerelle", "nom", "The default gateway is the router's address on the local network."),
      e("subnet", "sous-réseau", "nom", "We split the network into one subnet per floor."),
      e("packet", "paquet", "nom", "Each packet contains a source and a destination address."),
      e("troubleshoot", "dépanner / diagnostiquer", "verbe", "I spent the morning troubleshooting a DNS issue."),
      e("configure", "configurer", "verbe", "You need to configure the interface before enabling it."),
      e("forward", "transférer / acheminer", "verbe", "The firewall forwards traffic on port 443 to the web server."),
      e("outage", "panne (de service)", "nom", "The outage lasted two hours and affected all customers."),
      e("redundancy", "redondance", "nom", "We added redundancy so that one failure does not stop the service."),
      e("topology", "topologie", "nom", "Draw the network topology before you change anything."),
      e("handshake", "négociation (poignée de main)", "nom", "TCP starts every connection with a three-way handshake."),
      e("lease", "bail (DHCP)", "nom", "The DHCP lease expires after twenty-four hours."),
      e("assign", "attribuer", "verbe", "The DHCP server assigns an IP address to each device."),
      e("encapsulate", "encapsuler", "verbe", "Each layer encapsulates the data from the layer above."),
      e("reachable", "joignable", "adjectif", "The server is not reachable from outside the company."),
      e("wireless", "sans fil", "adjectif", "The wireless network is slower in the meeting room."),
      e("backbone", "dorsale (réseau fédérateur)", "nom", "The campus backbone runs on fiber optic cables."),
      e("hop", "saut", "nom", "Traceroute shows every hop between you and the server."),
      e("loopback", "boucle locale", "nom", "Ping the loopback address to test your network stack."),
      e("broadcast", "diffusion (broadcast)", "nom", "An ARP request is sent as a broadcast."),
      e("mask", "masque", "nom", "A /24 network has a subnet mask of 255.255.255.0."),
      e("peer", "pair / homologue", "nom", "The two routers exchange routes with their BGP peers."),
      e("congestion", "congestion / saturation", "nom", "Network congestion causes packet loss at peak hours."),
      e("deploy", "déployer", "verbe", "We will deploy the new access points next week."),
      e("monitor", "surveiller", "verbe", "We monitor link usage with a dashboard."),
      e("rollback", "retour arrière", "nom", "If the update fails, we plan a rollback to the previous configuration."),
    ],
  },
  {
    id: "cybersecurity",
    label: "Cybersécurité",
    level: "B2",
    entries: [
      e("threat", "menace", "nom", "Phishing is still the most common threat for companies."),
      e("vulnerability", "vulnérabilité / faille", "nom", "The update fixes a critical vulnerability."),
      e("breach", "violation (de données)", "nom", "The data breach exposed thousands of passwords."),
      e("exploit", "exploiter (une faille)", "verbe", "Attackers exploited an old version of the web server."),
      e("patch", "corriger (appliquer un correctif)", "verbe", "We patched all servers within forty-eight hours."),
      e("encrypt", "chiffrer", "verbe", "Always encrypt sensitive files before you send them."),
      e("hash", "empreinte (hachage)", "nom", "We store a hash of the password, never the password itself."),
      e("credentials", "identifiants", "nom", "Never share your credentials, even with a colleague."),
      e("phishing", "hameçonnage", "nom", "The phishing email looked exactly like a message from the bank."),
      e("malware", "logiciel malveillant", "nom", "The antivirus detected malware in the attachment."),
      e("firewall", "pare-feu", "nom", "The firewall blocks all incoming traffic by default."),
      e("authenticate", "authentifier", "verbe", "Users must authenticate with a second factor."),
      e("audit", "auditer / audit", "verbe", "An external company audited our security last month."),
      e("mitigate", "atténuer / limiter", "verbe", "We mitigated the attack by blocking the source addresses."),
      e("compliance", "conformité", "nom", "GDPR compliance is mandatory for European companies."),
      e("incident", "incident", "nom", "Report every security incident to the security team."),
      e("leak", "fuite", "nom", "A misconfigured storage bucket caused a leak of customer data."),
      e("privilege", "privilège / droit d'accès", "nom", "Give each user the least privilege they need."),
      e("spoof", "usurper", "verbe", "The attacker spoofed the sender's email address."),
      e("tamper", "falsifier / altérer", "verbe", "Logs must be protected so that nobody can tamper with them."),
      e("backdoor", "porte dérobée", "nom", "The malware installed a backdoor on the server."),
      e("safeguard", "protéger / garantir", "verbe", "Backups safeguard your data against ransomware."),
      e("ransomware", "rançongiciel", "nom", "Ransomware encrypted every file on the shared drive."),
      e("suspicious", "suspect", "adjectif", "I noticed suspicious login attempts during the night."),
      e("harden", "durcir (sécuriser)", "verbe", "We hardened the server by disabling unused services."),
      e("revoke", "révoquer", "verbe", "Revoke the certificate as soon as the key is compromised."),
      e("compromise", "compromettre", "verbe", "One weak password can compromise the whole network."),
      e("detect", "détecter", "verbe", "The IDS detected a port scan from an unknown address."),
      e("awareness", "sensibilisation", "nom", "Security awareness training reduces phishing clicks."),
      e("forensics", "investigation numérique (forensique)", "nom", "The forensics team analysed the infected laptop."),
    ],
  },
  {
    id: "meetings",
    label: "Réunions & travail",
    level: "B1",
    entries: [
      e("agenda", "ordre du jour", "nom", "Let's go through the agenda before we start."),
      e("deadline", "date limite / échéance", "nom", "The deadline for the report is Friday."),
      e("schedule", "planifier / planning", "verbe", "Can we schedule a call for tomorrow morning?"),
      e("postpone", "reporter", "verbe", "We had to postpone the demo to next week."),
      e("clarify", "clarifier", "verbe", "Could you clarify what you mean by urgent?"),
      e("summarize", "résumer", "verbe", "Let me summarize what we decided today."),
      e("prioritize", "prioriser", "verbe", "We need to prioritize the security fixes."),
      e("feedback", "retour / avis", "nom", "Thanks for your feedback on my presentation."),
      e("update", "point d'avancement / mise à jour", "nom", "I'll give you a quick update on the migration."),
      e("delay", "retard", "nom", "Sorry for the delay, my train was late."),
      e("estimate", "estimer", "verbe", "I estimate that the task will take three days."),
      e("assignment", "tâche / mission", "nom", "My first assignment was to document the network."),
      e("stakeholder", "partie prenante", "nom", "We presented the results to all stakeholders."),
      e("workload", "charge de travail", "nom", "My workload is heavy this week because of exams."),
      e("reschedule", "reprogrammer", "verbe", "Can we reschedule our meeting to Thursday?"),
      e("attend", "assister à (faux ami)", "verbe", "I can't attend the meeting because I have a class."),
      e("suggest", "suggérer", "verbe", "I suggest that we test it on a single server first."),
      e("disagree", "ne pas être d'accord", "verbe", "I respectfully disagree with this choice."),
      e("handle", "gérer / traiter", "verbe", "Who will handle the customer's request?"),
      e("issue", "problème / sujet", "nom", "We found an issue with the backup script."),
      e("outcome", "résultat / issue", "nom", "What was the outcome of the meeting?"),
      e("reminder", "rappel", "nom", "I'll send a reminder before the deadline."),
      e("available", "disponible", "adjectif", "Are you available for a quick call at 3 pm?"),
      e("briefly", "brièvement", "adverbe", "Can you briefly explain your solution?"),
      e("achieve", "atteindre / réussir", "verbe", "We achieved our goal two days early."),
      e("milestone", "jalon / étape clé", "nom", "We reached the first milestone of the project."),
      e("accountable", "responsable (qui rend des comptes)", "adjectif", "Who is accountable for this decision?"),
      e("consensus", "consensus", "nom", "We finally reached a consensus on the architecture."),
      e("draft", "brouillon / première version", "nom", "I'll send you a first draft of the report tonight."),
      e("follow-up", "suivi / relance", "nom", "I'll send a follow-up email after the meeting."),
    ],
  },
  {
    id: "career",
    label: "Alternance & carrière",
    level: "B1",
    entries: [
      e("apprenticeship", "alternance / apprentissage", "nom", "I'm looking for an apprenticeship in network administration."),
      e("internship", "stage", "nom", "During my internship, I configured firewalls."),
      e("resume", "CV", "nom", "I updated my resume with my latest project."),
      e("cover letter", "lettre de motivation", "expression", "I wrote a cover letter for each company."),
      e("skill", "compétence", "nom", "Teamwork is a skill I developed at university."),
      e("strength", "point fort", "nom", "My main strength is that I learn quickly."),
      e("weakness", "point faible", "nom", "One weakness I'm working on is public speaking."),
      e("hire", "embaucher", "verbe", "The company plans to hire two apprentices this year."),
      e("apply", "postuler", "verbe", "I applied for a job as a junior network technician."),
      e("candidate", "candidat", "nom", "They interviewed five candidates for the position."),
      e("position", "poste", "nom", "The position requires good English skills."),
      e("requirement", "exigence / prérequis", "nom", "A driving licence is not a requirement for this job."),
      e("salary", "salaire", "nom", "We didn't talk about the salary during the first interview."),
      e("background", "parcours / formation", "nom", "I have a background in electronics."),
      e("motivated", "motivé", "adjectif", "I'm highly motivated to work in cybersecurity."),
      e("reliable", "fiable", "adjectif", "My tutor says I'm reliable and punctual."),
      e("eager", "désireux / impatient de", "adjectif", "I'm eager to learn from experienced engineers."),
      e("supervisor", "responsable / tuteur", "nom", "My supervisor reviews my work every Friday."),
      e("colleague", "collègue", "nom", "My colleagues helped me a lot during my first week."),
      e("onboarding", "intégration (d'un nouvel arrivant)", "nom", "The onboarding lasted two days."),
      e("career", "carrière", "nom", "I want to build a career in cloud security."),
      e("graduate", "obtenir son diplôme", "verbe", "I will graduate in June."),
      e("degree", "diplôme (universitaire)", "nom", "I'm preparing a bachelor's degree in computer science."),
      e("achievement", "réussite / accomplissement", "nom", "My biggest achievement was passing a networking certification."),
      e("responsibility", "responsabilité", "nom", "I had the responsibility of maintaining the school network."),
      e("promote", "promouvoir", "verbe", "She was promoted to team leader after two years."),
      e("negotiate", "négocier", "verbe", "It's sometimes possible to negotiate the start date."),
      e("certification", "certification", "nom", "This certification is well known by employers."),
      e("proactive", "proactif", "adjectif", "Recruiters like proactive candidates."),
      e("improve", "améliorer / progresser", "verbe", "I want to improve my spoken English this year."),
    ],
  },
];

export type VocabularyWord = VocabularyEntry & Readonly<{ pack: VocabularyPackId; packLabel: string; level: CefrLevel }>;

export const VOCABULARY: readonly VocabularyWord[] = VOCABULARY_PACKS.flatMap((pack) =>
  pack.entries.map((entry) => ({ ...entry, pack: pack.id, packLabel: pack.label, level: pack.level })),
);

const BY_WORD = new Map(VOCABULARY.map((entry) => [entry.word.toLowerCase(), entry]));
const RANK = new Map(VOCABULARY.map((entry, index) => [entry.word.toLowerCase(), index]));

/** Curated teaching order; words unknown to the bank (custom rows) come last. */
export function vocabularyRank(word: string): number {
  return RANK.get(word.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
}

/** Looks a word up by its text, so rows from the SQLite database get pack and example too. */
export function vocabularyEntry(word: string): VocabularyWord | null {
  return BY_WORD.get(word.toLowerCase()) ?? null;
}
