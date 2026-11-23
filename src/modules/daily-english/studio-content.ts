import { VOCABULARY, type CefrLevel, type VocabularyEntry, type VocabularyPackId, type VocabularyWord } from "./vocabulary";

/**
 * Rich, 100% synthetic engineering English content expanding the Daily English Studio:
 *  - 3 bonus advanced vocabulary tracks (+90 unique words → 240 total words)
 *  - 6 interactive workplace stories (dialogues with mid-story checkpoints)
 *  - 16 French-speaker grammar & false-friend guides + interactive error-spotting drills
 *  - Mascot accessories & shop catalog
 *
 * Kept separate from `VOCABULARY_PACKS` (5 packs / 150 words) so the core Leitner
 * seed & existing contracts stay untouched.
 */

export type BonusPackId = "cloud_devops" | "data_apis" | "code_review";
export type StudioPackId = VocabularyPackId | BonusPackId;

export type BonusVocabularyPack = Readonly<{
  id: BonusPackId;
  label: string;
  subtitle: string;
  level: CefrLevel | "B2–C1";
  theme: "indigo" | "cyan" | "violet";
  entries: readonly VocabularyEntry[];
}>;

export type StudioVocabularyWord = VocabularyEntry &
  Readonly<{
    pack: StudioPackId;
    packLabel: string;
    level: CefrLevel | "B2–C1";
  }>;

const e = (word: string, translation: string, category: string, example: string): VocabularyEntry => ({
  word,
  translation,
  category,
  example,
});

export const BONUS_VOCABULARY_PACKS: readonly BonusVocabularyPack[] = [
  {
    id: "cloud_devops",
    label: "Cloud & DevOps",
    subtitle: "Conteneurs, pipelines CI/CD, haute disponibilité et observabilité",
    level: "B2",
    theme: "indigo",
    entries: [
      e("containerize", "conteneuriser", "verbe", "We containerized the API so it runs identically on every machine."),
      e("orchestrate", "orchestrer", "verbe", "Kubernetes orchestrates dozens of services across the cluster."),
      e("pipeline", "chaîne CI/CD (pipeline)", "nom", "The pipeline runs unit tests automatically on every commit."),
      e("scalability", "passage à l'échelle (scalabilité)", "nom", "Horizontal scalability lets us handle traffic spikes smoothly."),
      e("downtime", "temps d'indisponibilité", "nom", "Our goal is to deploy the database upgrade with zero downtime."),
      e("provision", "provisionner (allouer)", "verbe", "Terraform provisions the virtual networks in two minutes."),
      e("immutable", "immuable", "adjectif", "An immutable image prevents configuration drift in production."),
      e("observability", "observabilité", "nom", "Good observability combines logs, metrics, and distributed traces."),
      e("artifact", "artefact (livrable compilé)", "nom", "The build step publishes a signed artifact to the registry."),
      e("staging", "préproduction (staging)", "nom", "Always validate the release in staging before pushing to production."),
      e("canary", "déploiement canari", "nom", "A canary release sends five percent of traffic to the new version."),
      e("autoscaling", "mise à l'échelle automatique", "nom", "Autoscaling adds new instances when CPU load exceeds seventy percent."),
      e("idempotent", "idempotent", "adjectif", "An idempotent script can run twice without breaking the server."),
      e("serverless", "sans serveur (serverless)", "adjectif", "We use serverless functions to resize uploaded images on demand."),
      e("telemetry", "télémétrie", "nom", "Telemetry showed a sudden memory spike right after the deploy."),
      e("cluster", "grappe (cluster)", "nom", "Each node in the cluster shares the workload evenly."),
      e("ingress", "trafic entrant (ingress)", "nom", "The ingress controller routes HTTPS requests to the right service."),
      e("ephemeral", "éphémère", "adjectif", "Preview environments are ephemeral and destroyed once merged."),
      e("replica", "réplique (instance miroir)", "nom", "Running three replicas keeps the service online if one pod crashes."),
      e("failover", "basculement de secours", "nom", "Automatic failover switched traffic to the secondary region in seconds."),
      e("manifest", "manifeste (fichier déclaratif)", "nom", "The deployment manifest defines CPU limits and environment variables."),
      e("daemon", "démon (service d'arrière-plan)", "nom", "A background daemon rotates the log files every midnight."),
      e("webhook", "rappel HTTP (webhook)", "nom", "GitHub sends a webhook to trigger the build server."),
      e("throttling", "bridage (limitation de débit)", "nom", "API throttling protects the backend from abusive bursts."),
      e("load balancer", "répartiteur de charge", "nom", "The load balancer distributes requests across healthy servers."),
      e("rate limit", "limite de requêtes", "nom", "We added a rate limit of sixty requests per minute per client."),
      e("drift", "dérive de configuration", "nom", "Manual SSH edits caused configuration drift between servers."),
      e("container", "conteneur", "nom", "Each container packages the application with its exact libraries."),
      e("rollback plan", "plan de retour arrière", "nom", "Never start a Friday release without a tested rollback plan."),
      e("uptime", "disponibilité (temps de marche)", "nom", "The status page reports ninety-nine point nine percent uptime."),
    ],
  },
  {
    id: "data_apis",
    label: "Data, SQL & APIs",
    subtitle: "Modélisation, requêtes, contrats d'interface et performance",
    level: "B2",
    theme: "cyan",
    entries: [
      e("endpoint", "point de terminaison (endpoint)", "nom", "The login endpoint validates credentials and returns a session token."),
      e("payload", "charge utile (corps de requête)", "nom", "Keep the JSON payload small to speed up mobile responses."),
      e("schema", "schéma (structure de données)", "nom", "Every incoming request is validated against a strict schema."),
      e("query", "requête (SQL/API)", "nom", "That single query took four seconds because it scanned the whole table."),
      e("index", "index (base de données)", "nom", "Adding an index on the email column made lookups ten times faster."),
      e("pagination", "pagination", "nom", "Use cursor pagination instead of returning ten thousand rows at once."),
      e("cache", "mémoire cache", "nom", "The cache stores frequent read results to reduce database load."),
      e("serialize", "sérialiser", "verbe", "The server serializes the object into JSON before sending it."),
      e("migration", "migration (de schéma)", "nom", "Always test the database migration on a copy of the data first."),
      e("constraint", "contrainte (d'intégrité)", "nom", "A unique constraint guarantees no two users share the same handle."),
      e("normalize", "normaliser", "verbe", "We normalized the tables to eliminate duplicate customer addresses."),
      e("aggregate", "agréger", "verbe", "The analytics job aggregates daily events into hourly totals."),
      e("transaction", "transaction (atomique)", "nom", "Wrap both balance updates in a single transaction so nothing is lost."),
      e("deadlock", "interblocage (deadlock)", "nom", "Two concurrent updates caused a deadlock on the orders table."),
      e("sharding", "partitionnement horizontal", "nom", "Sharding splits huge datasets across multiple database nodes."),
      e("replication", "réplication", "nom", "Read replication lets reporting queries run without slowing writes."),
      e("batch", "lot (traitement par lots)", "nom", "Inserting records in a batch is much faster than one by one."),
      e("stream", "flux continu", "nom", "We process sensor readings as a real-time stream of events."),
      e("parse", "analyser syntaxiquement (parser)", "verbe", "The worker parses incoming CSV files and flags malformed rows."),
      e("sanitize", "assainir (nettoyer une entrée)", "verbe", "Always sanitize user input before rendering HTML."),
      e("validate", "valider", "verbe", "The gateway validates every parameter before calling the service."),
      e("deprecate", "déprécier (rendre obsolète)", "verbe", "We will deprecate version one of the API in six months."),
      e("versioning", "gestion de versions", "nom", "Clear API versioning prevents breaking existing client integrations."),
      e("contract", "contrat d'interface", "nom", "Both teams agreed on the API contract before writing any code."),
      e("mock", "bouchon / simulation (mock)", "nom", "Unit tests mock the payment gateway so they run offline."),
      e("fixture", "jeu de données de test", "nom", "We use synthetic fixtures instead of real production data."),
      e("regression", "régression", "nom", "The integration suite caught a regression before release."),
      e("latency spike", "pic de latence", "nom", "We investigated a latency spike on the search endpoint."),
      e("status code", "code de statut HTTP", "nom", "Return a 404 status code when the requested record does not exist."),
      e("backfill", "rattrapage de données", "nom", "We ran a backfill script to populate the new column safely."),
    ],
  },
  {
    id: "code_review",
    label: "Code Review & Architecture",
    subtitle: "Qualité logicielle, arbitrages techniques et revues constructives",
    level: "B2–C1",
    theme: "violet",
    entries: [
      e("refactor", "refactoriser", "verbe", "Let's refactor this giant function into smaller testable helpers."),
      e("maintainable", "maintenable", "adjectif", "Clear naming makes the codebase much more maintainable."),
      e("decouple", "découpler", "verbe", "We decoupled the domain rules from the Next.js routes."),
      e("bottleneck", "goulet d'étranglement", "nom", "Profiling revealed that image decoding was the main bottleneck."),
      e("trade-off", "compromis technique", "nom", "Every architecture choice involves a trade-off between speed and simplicity."),
      e("abstraction", "abstraction", "nom", "Avoid adding an abstraction until you have at least two real use cases."),
      e("edge case", "cas limite", "nom", "Did you add a unit test for the empty-list edge case?"),
      e("technical debt", "dette technique", "nom", "We reserved one sprint day to pay down critical technical debt."),
      e("boilerplate", "code répétitif (boilerplate)", "nom", "A tiny helper removed fifty lines of boilerplate."),
      e("idiomatic", "idiomatique (naturel dans le langage)", "adjectif", "This solution is concise and idiomatic TypeScript."),
      e("readable", "lisible", "adjectif", "Prefer readable code over clever one-liners."),
      e("modular", "modulaire", "adjectif", "A modular layout lets teams work independently without conflicts."),
      e("extensible", "extensible", "adjectif", "The plugin interface makes the engine extensible."),
      e("legacy", "existant ancien (legacy)", "adjectif", "We wrapped the legacy module behind a clean adapter."),
      e("workaround", "solution de contournement", "nom", "This patch is a temporary workaround until the upstream bug is fixed."),
      e("root cause", "cause racine", "nom", "Don't just hide the error; find the root cause first."),
      e("side effect", "effet de bord", "nom", "Pure functions have no hidden side effects and are easy to test."),
      e("race condition", "situation de compétition", "nom", "Two overlapping requests triggered a race condition in the cache."),
      e("memory leak", "fuite mémoire", "nom", "Forgetting to remove the event listener created a memory leak."),
      e("asynchronous", "asynchrone", "adjectif", "File uploads run asynchronously so the interface stays responsive."),
      e("deterministic", "déterministe", "adjectif", "A deterministic generator returns the exact same lesson for a given seed."),
      e("dependency", "dépendance", "nom", "Audit every new dependency before adding it to package.json."),
      e("invariant", "invariant (règle toujours vraie)", "nom", "This check enforces the invariant that hearts never drop below zero."),
      e("scope", "périmètre", "nom", "Let's keep this pull request focused on a small scope."),
      e("nitpick", "détail mineur (nit)", "nom", "Just a small nitpick: could we rename this variable for clarity?"),
      e("blocker", "point bloquant", "nom", "Missing authentication on the admin route is a hard blocker."),
      e("approve", "approuver (valider une PR)", "verbe", "Once the tests pass, I will approve the pull request."),
      e("cohesion", "cohésion", "nom", "High cohesion means related rules live together in one module."),
      e("coupling", "couplage", "nom", "Loose coupling makes replacing the storage adapter straightforward."),
      e("benchmark", "banc d'essai (mesure de perf)", "nom", "Always run a benchmark before claiming an optimization is faster."),
    ],
  },
];

export const BONUS_VOCABULARY: readonly StudioVocabularyWord[] = BONUS_VOCABULARY_PACKS.flatMap((pack) =>
  pack.entries.map((entry) => ({
    ...entry,
    pack: pack.id,
    packLabel: pack.label,
    level: pack.level,
  })),
);

/** Full studio bank (150 core Leitner words + 90 bonus engineering words = 240 words). */
export const ALL_STUDIO_VOCABULARY: readonly StudioVocabularyWord[] = [
  ...VOCABULARY,
  ...BONUS_VOCABULARY,
];

/** Converts a studio word into the VocabularyWord shape expected by the exercise generator. */
export function asGeneratorWords(words: readonly StudioVocabularyWord[]): VocabularyWord[] {
  return words.map((item) => ({
    word: item.word,
    translation: item.translation,
    category: item.category,
    example: item.example,
    pack: (item.pack === "cloud_devops"
      ? "networking"
      : item.pack === "data_apis"
        ? "core"
        : item.pack === "code_review"
          ? "meetings"
          : item.pack) as VocabularyPackId,
    packLabel: item.packLabel,
    level: item.level === "B2–C1" ? "B2" : item.level,
  }));
}

// ---------------------------------------------------------------------------
// Interactive Workplace Stories (Duolingo Stories style)
// ---------------------------------------------------------------------------

export type StoryStep =
  | Readonly<{
      id: string;
      kind: "line";
      speaker: string;
      role: string;
      avatarColor: string;
      text: string;
      frenchHint: string;
    }>
  | Readonly<{
      id: string;
      kind: "checkpoint";
      prompt: string;
      choices: readonly string[];
      correctAnswer: string;
      explanation: string;
    }>;

export type EngineeringStory = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  level: "B1" | "B2";
  durationMinutes: number;
  theme: "emerald" | "indigo" | "violet" | "orange" | "cyan";
  xpReward: number;
  keyWords: readonly Readonly<{ word: string; translation: string }>[];
  steps: readonly StoryStep[];
}>;

export const ENGINEERING_STORIES: readonly EngineeringStory[] = [
  {
    id: "story-midnight-outage",
    title: "The Midnight Outage",
    subtitle: "Diagnostiquer une panne réseau en astreinte avec un collègue",
    level: "B2",
    durationMinutes: 3,
    theme: "indigo",
    xpReward: 30,
    keyWords: [
      { word: "outage", translation: "panne de service" },
      { word: "reachable", translation: "joignable" },
      { word: "rollback", translation: "retour arrière" },
      { word: "root cause", translation: "cause racine" },
    ],
    steps: [
      {
        id: "mo-1",
        kind: "line",
        speaker: "Sam",
        role: "On-call SRE",
        avatarColor: "#6366F1",
        text: "Hey, sorry to wake you up. We have an outage on the European API gateway.",
        frenchHint: "Salut, désolé de te réveiller. On a une panne sur la passerelle API européenne.",
      },
      {
        id: "mo-2",
        kind: "line",
        speaker: "Lina",
        role: "Network Engineer",
        avatarColor: "#059669",
        text: "No worries, I am opening the dashboard now. Is the primary router reachable?",
        frenchHint: "Pas de souci, j'ouvre le tableau de bord. Est-ce que le routeur principal est joignable ?",
      },
      {
        id: "mo-q1",
        kind: "checkpoint",
        prompt: "Que demande Lina à propos du routeur principal ?",
        choices: [
          "S'il est encore joignable",
          "S'il a été remplacé hier",
          "Combien de bande passante il coûte",
        ],
        correctAnswer: "S'il est encore joignable",
        explanation: "« reachable » signifie joignable / accessible sur le réseau.",
      },
      {
        id: "mo-3",
        kind: "line",
        speaker: "Sam",
        role: "On-call SRE",
        avatarColor: "#6366F1",
        text: "Ping works, but latency jumped to two seconds right after the 11 PM firewall update.",
        frenchHint: "Le ping répond, mais la latence a bondi à 2 secondes juste après la mise à jour pare-feu de 23h.",
      },
      {
        id: "mo-4",
        kind: "line",
        speaker: "Lina",
        role: "Network Engineer",
        avatarColor: "#059669",
        text: "That sounds like a bad routing rule. Let's trigger an immediate rollback first.",
        frenchHint: "Ça ressemble à une mauvaise règle de routage. Lançons d'abord un retour arrière immédiat.",
      },
      {
        id: "mo-q2",
        kind: "checkpoint",
        prompt: "Quelle action immédiate propose Lina pour rétablir le service ?",
        choices: [
          "Déclencher un retour arrière (rollback)",
          "Redémarrer les postes clients",
          "Attendre le stand-up du matin",
        ],
        correctAnswer: "Déclencher un retour arrière (rollback)",
        explanation: "En production, un « rollback » rétablit la version stable avant d'analyser la cause racine.",
      },
      {
        id: "mo-5",
        kind: "line",
        speaker: "Sam",
        role: "On-call SRE",
        avatarColor: "#6366F1",
        text: "Done! Traffic is green again. Tomorrow morning we will document the root cause and add a staging check.",
        frenchHint: "Fait ! Le trafic est de nouveau au vert. Demain matin on documentera la cause racine et on ajoutera un test en préprod.",
      },
      {
        id: "mo-q3",
        kind: "checkpoint",
        prompt: "Que feront-ils demain matin ?",
        choices: [
          "Documenter la cause racine et ajouter un contrôle en préproduction",
          "Désactiver le pare-feu définitivement",
          "Supprimer les journaux de la nuit",
        ],
        correctAnswer: "Documenter la cause racine et ajouter un contrôle en préproduction",
        explanation: "« root cause » = cause racine, « staging check » = vérification en préproduction.",
      },
    ],
  },
  {
    id: "story-first-standup",
    title: "First Daily Stand-up",
    subtitle: "Faire un point d'avancement clair et signaler un blocage",
    level: "B1",
    durationMinutes: 2,
    theme: "emerald",
    xpReward: 25,
    keyWords: [
      { word: "update", translation: "point d'avancement" },
      { word: "blocker", translation: "point bloquant" },
      { word: "deadline", translation: "date limite" },
      { word: "follow-up", translation: "suivi / relance" },
    ],
    steps: [
      {
        id: "fs-1",
        kind: "line",
        speaker: "Maya",
        role: "Tech Lead",
        avatarColor: "#F97316",
        text: "Good morning everyone! Alex, could you give us a quick update on the login ticket?",
        frenchHint: "Bonjour tout le monde ! Alex, peux-tu nous faire un rapide point sur le ticket de connexion ?",
      },
      {
        id: "fs-2",
        kind: "line",
        speaker: "Alex",
        role: "Apprentice Engineer",
        avatarColor: "#059669",
        text: "Sure! Yesterday I fixed the password validation bug and wrote three unit tests.",
        frenchHint: "Bien sûr ! Hier j'ai corrigé le bug de validation de mot de passe et écrit trois tests unitaires.",
      },
      {
        id: "fs-q1",
        kind: "checkpoint",
        prompt: "Quel temps utilise Alex pour parler d'hier (« Yesterday ») ?",
        choices: [
          "Le prétérit (I fixed / wrote)",
          "Le présent continu (I am fixing)",
          "Le futur (I will fix)",
        ],
        correctAnswer: "Le prétérit (I fixed / wrote)",
        explanation: "Avec un repère passé précis comme « yesterday », l'anglais utilise toujours le prétérit simple.",
      },
      {
        id: "fs-3",
        kind: "line",
        speaker: "Alex",
        role: "Apprentice Engineer",
        avatarColor: "#059669",
        text: "Today I plan to deploy to staging, but I have a small blocker: I am still waiting for database credentials.",
        frenchHint: "Aujourd'hui je prévois de déployer en préprod, mais j'ai un petit blocage : j'attends encore les identifiants de base.",
      },
      {
        id: "fs-q2",
        kind: "checkpoint",
        prompt: "Qu'est-ce qui bloque Alex aujourd'hui ?",
        choices: [
          "Il attend des identifiants d'accès à la base de données",
          "Son ordinateur ne démarre plus",
          "Les tests unitaires ont tous échoué",
        ],
        correctAnswer: "Il attend des identifiants d'accès à la base de données",
        explanation: "« credentials » désigne les identifiants / accès techniques.",
      },
      {
        id: "fs-4",
        kind: "line",
        speaker: "Maya",
        role: "Tech Lead",
        avatarColor: "#F97316",
        text: "Thanks for raising that early! I will send a follow-up to ops right after this meeting so we don't miss Friday's deadline.",
        frenchHint: "Merci de l'avoir signalé tôt ! J'envoie une relance aux ops juste après la réunion pour ne pas rater l'échéance de vendredi.",
      },
      {
        id: "fs-q3",
        kind: "checkpoint",
        prompt: "Que signifie « send a follow-up » dans ce contexte ?",
        choices: [
          "Envoyer un message de suivi / relance",
          "Annuler la réunion suivante",
          "Repousser le projet d'un mois",
        ],
        correctAnswer: "Envoyer un message de suivi / relance",
        explanation: "Un « follow-up » est une relance ou un récapitulatif envoyé après un échange.",
      },
    ],
  },
  {
    id: "story-phishing-alert",
    title: "Phishing Alert at 9 AM",
    subtitle: "Repérer une tentative d'hameçonnage et réagir en sécurité",
    level: "B2",
    durationMinutes: 3,
    theme: "violet",
    xpReward: 30,
    keyWords: [
      { word: "suspicious", translation: "suspect" },
      { word: "spoof", translation: "usurper" },
      { word: "revoke", translation: "révoquer" },
      { word: "mitigate", translation: "atténuer / limiter" },
    ],
    steps: [
      {
        id: "pa-1",
        kind: "line",
        speaker: "Claire",
        role: "Finance Analyst",
        avatarColor: "#06B6D4",
        text: "Hi! I received an urgent email asking me to verify my VPN password before noon. It looks slightly suspicious.",
        frenchHint: "Salut ! J'ai reçu un e-mail urgent me demandant de vérifier mon mot de passe VPN avant midi. Il a l'air un peu suspect.",
      },
      {
        id: "pa-2",
        kind: "line",
        speaker: "Noah",
        role: "Security Analyst",
        avatarColor: "#A855F7",
        text: "Good catch! Do not click the link. Can you forward the headers so I can check if the sender spoofed our domain?",
        frenchHint: "Bien vu ! Ne clique pas sur le lien. Peux-tu transférer les en-têtes pour que je vérifie si l'expéditeur a usurpé notre domaine ?",
      },
      {
        id: "pa-q1",
        kind: "checkpoint",
        prompt: "Que veut vérifier Noah en regardant les en-têtes ?",
        choices: [
          "Si l'expéditeur a usurpé le domaine de l'entreprise",
          "Si la pièce jointe est trop lourde",
          "Si le VPN est en maintenance",
        ],
        correctAnswer: "Si l'expéditeur a usurpé le domaine de l'entreprise",
        explanation: "« to spoof » signifie usurper une identité, un domaine ou une adresse.",
      },
      {
        id: "pa-3",
        kind: "line",
        speaker: "Claire",
        role: "Finance Analyst",
        avatarColor: "#06B6D4",
        text: "I just sent it. One colleague already opened the page, though he didn't type his password.",
        frenchHint: "Je viens de te l'envoyer. Un collègue a déjà ouvert la page, même s'il n'a pas saisi son mot de passe.",
      },
      {
        id: "pa-4",
        kind: "line",
        speaker: "Noah",
        role: "Security Analyst",
        avatarColor: "#A855F7",
        text: "Just to be safe, we will revoke his active session tokens and block the URL on the firewall to mitigate any risk.",
        frenchHint: "Par précaution, on va révoquer ses jetons de session actifs et bloquer l'URL sur le pare-feu pour limiter tout risque.",
      },
      {
        id: "pa-q2",
        kind: "checkpoint",
        prompt: "Quelle paire d'actions lance Noah ?",
        choices: [
          "Révoquer les jetons de session et bloquer l'URL sur le pare-feu",
          "Effacer le disque dur de toute l'équipe",
          "Répondre à l'attaquant par e-mail",
        ],
        correctAnswer: "Révoquer les jetons de session et bloquer l'URL sur le pare-feu",
        explanation: "« revoke » = révoquer, « mitigate » = limiter/atténuer un risque ou un incident.",
      },
    ],
  },
  {
    id: "story-pr-review",
    title: "The Pull Request Review",
    subtitle: "Donner un retour constructif en revue de code sans brusquer",
    level: "B2",
    durationMinutes: 3,
    theme: "cyan",
    xpReward: 30,
    keyWords: [
      { word: "refactor", translation: "refactoriser" },
      { word: "edge case", translation: "cas limite" },
      { word: "nitpick", translation: "détail mineur" },
      { word: "trade-off", translation: "compromis technique" },
    ],
    steps: [
      {
        id: "pr-1",
        kind: "line",
        speaker: "Eliot",
        role: "Senior Dev",
        avatarColor: "#06B6D4",
        text: "Thanks for the clean pull request! The new caching layer is very readable.",
        frenchHint: "Merci pour cette pull request propre ! La nouvelle couche de cache est très lisible.",
      },
      {
        id: "pr-2",
        kind: "line",
        speaker: "Eliot",
        role: "Senior Dev",
        avatarColor: "#06B6D4",
        text: "I spotted one edge case: what happens if the API returns an empty array?",
        frenchHint: "J'ai repéré un cas limite : que se passe-t-il si l'API renvoie un tableau vide ?",
      },
      {
        id: "pr-q1",
        kind: "checkpoint",
        prompt: "Que signifie « edge case » en développement ?",
        choices: [
          "Un cas limite ou inhabituel à gérer",
          "Une erreur de syntaxe dans un fichier",
          "La dernière version en production",
        ],
        correctAnswer: "Un cas limite ou inhabituel à gérer",
        explanation: "Un « edge case » est une situation aux bornes (liste vide, valeur nulle, fuseau horaire…).",
      },
      {
        id: "pr-3",
        kind: "line",
        speaker: "Nadia",
        role: "Backend Dev",
        avatarColor: "#059669",
        text: "Good point! I will add a guard and a regression test. Did you see anything else?",
        frenchHint: "Bien vu ! Je vais ajouter une garde et un test de non-régression. Tu as vu autre chose ?",
      },
      {
        id: "pr-4",
        kind: "line",
        speaker: "Eliot",
        role: "Senior Dev",
        avatarColor: "#06B6D4",
        text: "Only a tiny nitpick on variable naming — totally optional. Once the empty-list test passes, I'll approve!",
        frenchHint: "Juste un tout petit détail sur le nommage d'une variable — totalement optionnel. Dès que le test passe, j'approuve !",
      },
      {
        id: "pr-q2",
        kind: "checkpoint",
        prompt: "Pourquoi Eliot précise-t-il « tiny nitpick » ?",
        choices: [
          "Pour indiquer que la remarque est mineure et non bloquante",
          "Pour rejeter complètement la pull request",
          "Pour demander de tout réécrire en Python",
        ],
        correctAnswer: "Pour indiquer que la remarque est mineure et non bloquante",
        explanation: "En code review anglaise, « nit » / « nitpick » signale une suggestion stylistique non bloquante.",
      },
    ],
  },
  {
    id: "story-apprenticeship-interview",
    title: "Apprenticeship Interview",
    subtitle: "Réussir son entretien d'alternance ingénieur en anglais",
    level: "B1",
    durationMinutes: 3,
    theme: "orange",
    xpReward: 25,
    keyWords: [
      { word: "apprenticeship", translation: "alternance" },
      { word: "reliable", translation: "fiable" },
      { word: "overcome", translation: "surmonter" },
      { word: "eager", translation: "désireux / motivé" },
    ],
    steps: [
      {
        id: "ai-1",
        kind: "line",
        speaker: "Jordan",
        role: "Engineering Manager",
        avatarColor: "#F97316",
        text: "Welcome! What motivated you to apply for this cybersecurity apprenticeship?",
        frenchHint: "Bienvenue ! Qu'est-ce qui t'a motivé à postuler pour cette alternance en cybersécurité ?",
      },
      {
        id: "ai-2",
        kind: "line",
        speaker: "Théo",
        role: "Candidate",
        avatarColor: "#6366F1",
        text: "I am eager to learn on real production systems. Last year I built a home lab to practice firewall rules and log analysis.",
        frenchHint: "J'ai vraiment envie d'apprendre sur de vrais systèmes en production. L'an dernier j'ai monté un lab personnel pour pratiquer le pare-feu et l'analyse de logs.",
      },
      {
        id: "ai-q1",
        kind: "checkpoint",
        prompt: "Comment traduire « I am eager to learn » ?",
        choices: [
          "J'ai très envie / hâte d'apprendre",
          "J'ai peur d'apprendre",
          "J'ai déjà fini d'apprendre",
        ],
        correctAnswer: "J'ai très envie / hâte d'apprendre",
        explanation: "« eager to + verbe » exprime une motivation sincère et dynamique en entretien.",
      },
      {
        id: "ai-3",
        kind: "line",
        speaker: "Jordan",
        role: "Engineering Manager",
        avatarColor: "#F97316",
        text: "That's awesome. How would your previous tutor describe your work style?",
        frenchHint: "C'est super. Comment ton précédent tuteur décrirait-il ta façon de travailler ?",
      },
      {
        id: "ai-4",
        kind: "line",
        speaker: "Théo",
        role: "Candidate",
        avatarColor: "#6366F1",
        text: "He said I am reliable and proactive. When I face a difficult bug, I document what I tried before asking for help.",
        frenchHint: "Il a dit que je suis fiable et proactif. Face à un bug difficile, je documente ce que j'ai essayé avant de demander de l'aide.",
      },
      {
        id: "ai-q2",
        kind: "checkpoint",
        prompt: "Quelle qualité concrète illustre l'exemple de Théo ?",
        choices: [
          "Il est fiable et autonome avant de demander de l'aide",
          "Il ne demande jamais d'aide même bloqué",
          "Il préfère éviter le débogage",
        ],
        correctAnswer: "Il est fiable et autonome avant de demander de l'aide",
        explanation: "« reliable » = fiable, « proactive » = qui prend des initiatives constructives.",
      },
    ],
  },
  {
    id: "story-slow-query",
    title: "The Slow Production Query",
    subtitle: "Résoudre un pic de latence SQL avec un index et un benchmark",
    level: "B2",
    durationMinutes: 3,
    theme: "emerald",
    xpReward: 30,
    keyWords: [
      { word: "bottleneck", translation: "goulet d'étranglement" },
      { word: "index", translation: "index SQL" },
      { word: "pagination", translation: "pagination" },
      { word: "benchmark", translation: "mesure de performance" },
    ],
    steps: [
      {
        id: "sq-1",
        kind: "line",
        speaker: "Priya",
        role: "Data Engineer",
        avatarColor: "#059669",
        text: "Customers are reporting that the reports page takes six seconds to load today.",
        frenchHint: "Des clients signalent que la page des rapports met six secondes à charger aujourd'hui.",
      },
      {
        id: "sq-2",
        kind: "line",
        speaker: "Lucas",
        role: "Full-Stack Dev",
        avatarColor: "#6366F1",
        text: "I ran an explain plan: the bottleneck is a missing index on the created_at column, and the endpoint has no pagination.",
        frenchHint: "J'ai lancé un EXPLAIN : le goulet d'étranglement est un index manquant sur created_at, et l'endpoint n'a pas de pagination.",
      },
      {
        id: "sq-q1",
        kind: "checkpoint",
        prompt: "Quels sont les deux problèmes identifiés par Lucas ?",
        choices: [
          "Un index manquant et l'absence de pagination",
          "Un disque plein et une coupure DNS",
          "Un certificat TLS expiré",
        ],
        correctAnswer: "Un index manquant et l'absence de pagination",
        explanation: "« bottleneck » = goulet d'étranglement qui ralentit toute la chaîne.",
      },
      {
        id: "sq-3",
        kind: "line",
        speaker: "Priya",
        role: "Data Engineer",
        avatarColor: "#059669",
        text: "Let's add the index in a safe migration and run a quick benchmark in staging to verify the gain.",
        frenchHint: "Ajoutons l'index dans une migration sûre et lançons un benchmark rapide en préprod pour vérifier le gain.",
      },
      {
        id: "sq-4",
        kind: "line",
        speaker: "Lucas",
        role: "Full-Stack Dev",
        avatarColor: "#6366F1",
        text: "Done! Response time dropped from six seconds down to forty-five milliseconds.",
        frenchHint: "Fait ! Le temps de réponse est passé de six secondes à quarante-cinq millisecondes.",
      },
      {
        id: "sq-q2",
        kind: "checkpoint",
        prompt: "Pourquoi font-ils un « benchmark » en préprod ?",
        choices: [
          "Pour mesurer objectivement le gain de performance",
          "Pour supprimer les anciennes tables",
          "Pour envoyer un e-mail aux clients",
        ],
        correctAnswer: "Pour mesurer objectivement le gain de performance",
        explanation: "Un « benchmark » mesure une performance avant/après une optimisation.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Grammar & French-Speaker False Friends (16 Micro-Guides + Spot-Error Drills)
// ---------------------------------------------------------------------------

export type GrammarTrap = Readonly<{
  id: string;
  title: string;
  category: "Faux-ami" | "Préposition" | "Temps" | "Indénombrable" | "Politesse pro" | "Syntaxe";
  wrongExample: string;
  rightExample: string;
  explanation: string;
  mnemonic: string;
  distractors: readonly [string, string];
}>;

export const GRAMMAR_TRAPS: readonly GrammarTrap[] = [
  {
    id: "trap-agree",
    title: "I agree (jamais « I am agree »)",
    category: "Syntaxe",
    wrongExample: "I am agree with this architecture.",
    rightExample: "I agree with this architecture.",
    explanation: "« agree » est un verbe complet en anglais, pas un adjectif. On n'ajoute jamais « am » devant.",
    mnemonic: "I agree / I don't agree / Do you agree?",
    distractors: ["I am agreed with this architecture.", "I agreeing with this architecture."],
  },
  {
    id: "trap-depend-on",
    title: "Depend ON (jamais « depend of »)",
    category: "Préposition",
    wrongExample: "The latency depends of the region.",
    rightExample: "The latency depends on the region.",
    explanation: "Le verbe « depend » se construit toujours avec « on » (ou « upon »), jamais « of ».",
    mnemonic: "It depends ON the context.",
    distractors: ["The latency depends from the region.", "The latency depends to the region."],
  },
  {
    id: "trap-for-since",
    title: "For (durée) vs Since (point de départ)",
    category: "Temps",
    wrongExample: "I have worked here since two years.",
    rightExample: "I have worked here for two years.",
    explanation: "Utilise « for » pour une durée (for two years) et « since » pour une date précise (since 2024).",
    mnemonic: "FOR = durée · SINCE = date/moment",
    distractors: ["I work here since two years.", "I have worked here during two years ago."],
  },
  {
    id: "trap-explain-to",
    title: "Explain TO me (jamais « explain me »)",
    category: "Préposition",
    wrongExample: "Could you explain me the pipeline?",
    rightExample: "Could you explain the pipeline to me?",
    explanation: "Contrairement à « tell me », le verbe « explain » exige toujours « to » devant la personne.",
    mnemonic: "Explain [something] TO [someone].",
    distractors: ["Could you explain for me the pipeline?", "Could you explained me the pipeline?"],
  },
  {
    id: "trap-discuss",
    title: "Discuss (sans « about »)",
    category: "Préposition",
    wrongExample: "Let's discuss about the rollback plan.",
    rightExample: "Let's discuss the rollback plan.",
    explanation: "« discuss » est transitif direct : on dit « discuss the topic » (ou « talk about the topic »).",
    mnemonic: "DISCUSS X = TALK ABOUT X.",
    distractors: ["Let's discuss of the rollback plan.", "Let's discuss on the rollback plan."],
  },
  {
    id: "trap-uncountable-info",
    title: "Information / Feedback / Advice (invariables)",
    category: "Indénombrable",
    wrongExample: "Thanks for these useful feedbacks and informations.",
    rightExample: "Thanks for this useful feedback and information.",
    explanation: "« information », « feedback », « advice », « software » et « equipment » ne prennent jamais de « s ».",
    mnemonic: "A piece of advice / some feedback (jamais de -s).",
    distractors: ["Thanks for a useful feedbacks and information.", "Thanks for these useful feedback and informations."],
  },
  {
    id: "trap-actually",
    title: "Actually ≠ Actuellement",
    category: "Faux-ami",
    wrongExample: "Actually, I am studying network security.",
    rightExample: "Currently, I am studying network security.",
    explanation: "« actually » veut dire « en fait / en réalité ». Pour dire « actuellement », utilise « currently ».",
    mnemonic: "Currently = en ce moment · Actually = en fait.",
    distractors: ["Eventually, I am studying network security.", "Actuality, I am studying network security."],
  },
  {
    id: "trap-attend",
    title: "Attend ≠ Attendre",
    category: "Faux-ami",
    wrongExample: "I will assist to the security meeting.",
    rightExample: "I will attend the security meeting.",
    explanation: "« attend » = assister à (un cours, une réunion). « assist » = aider quelqu'un.",
    mnemonic: "Attend a meeting · Wait for a reply.",
    distractors: ["I will attend at the security meeting.", "I will wait the security meeting."],
  },
  {
    id: "trap-eventually",
    title: "Eventually ≠ Éventuellement",
    category: "Faux-ami",
    wrongExample: "We could eventually meet tomorrow if you want.",
    rightExample: "We could possibly meet tomorrow if you want.",
    explanation: "« eventually » signifie « finalement / à terme », pas « éventuellement » (« possibly / maybe »).",
    mnemonic: "Eventually = finalement · Possibly = éventuellement.",
    distractors: ["We could ultimately meet tomorrow if you want.", "We could eventual meet tomorrow if you want."],
  },
  {
    id: "trap-make-do",
    title: "Make a decision vs Do a task",
    category: "Syntaxe",
    wrongExample: "I need to do a quick decision before noon.",
    rightExample: "I need to make a quick decision before noon.",
    explanation: "On « make » une décision, un plan, une erreur ; on « do » une tâche, un test, du travail.",
    mnemonic: "MAKE a decision/change · DO work/a task.",
    distractors: ["I need to take a quick decision before noon.", "I need to made a quick decision before noon."],
  },
  {
    id: "trap-people-are",
    title: "People ARE (toujours pluriel)",
    category: "Syntaxe",
    wrongExample: "Many people is using the new dashboard.",
    rightExample: "Many people are using the new dashboard.",
    explanation: "« people » est déjà un pluriel en anglais : accorde toujours le verbe au pluriel.",
    mnemonic: "One person IS · Many people ARE.",
    distractors: ["Much people are using the new dashboard.", "Many peoples are using the new dashboard."],
  },
  {
    id: "trap-polite-request",
    title: "Politesse en réunion & sur Slack",
    category: "Politesse pro",
    wrongExample: "Send me the logs now.",
    rightExample: "Could you please share the logs when you have a moment?",
    explanation: "L'impératif sec paraît brusque en anglais pro. Préfère « Could you… » ou « Would you mind… ».",
    mnemonic: "Could you + verbe / Would you mind + -ing.",
    distractors: ["You must send to me the logs now.", "Can you to send me the logs?"],
  },
  {
    id: "trap-standup-tense",
    title: "Hier = Prétérit simple (pas Present Perfect)",
    category: "Temps",
    wrongExample: "Yesterday I have deployed the hotfix.",
    rightExample: "Yesterday I deployed the hotfix.",
    explanation: "Dès qu'un moment passé révolu est mentionné (yesterday, last week), utilise le prétérit simple.",
    mnemonic: "Yesterday / last week → V-ed (sans « have »).",
    distractors: ["Yesterday I was deploy the hotfix.", "Yesterday I deploy the hotfix."],
  },
  {
    id: "trap-say-tell",
    title: "Tell someone vs Say something",
    category: "Syntaxe",
    wrongExample: "He said me that the server was down.",
    rightExample: "He told me that the server was down.",
    explanation: "On dit « tell + personne » (« told me ») et « say + chose » (« said to me that… »).",
    mnemonic: "TELL me · SAY that…",
    distractors: ["He told to me that the server was down.", "He say me that the server was down."],
  },
  {
    id: "trap-at-the-same-time",
    title: "AT the same time (pas « in »)",
    category: "Préposition",
    wrongExample: "Two jobs ran in the same time.",
    rightExample: "Two jobs ran at the same time.",
    explanation: "L'expression idiomatique est toujours « at the same time ».",
    mnemonic: "AT the same time.",
    distractors: ["Two jobs ran on the same time.", "Two jobs ran to the same time."],
  },
  {
    id: "trap-fewer-less",
    title: "Fewer (comptable) vs Less (non comptable)",
    category: "Indénombrable",
    wrongExample: "The patch caused less errors than yesterday.",
    rightExample: "The patch caused fewer errors than yesterday.",
    explanation: "Utilise « fewer » devant un pluriel comptable (fewer errors/bugs) et « less » devant un indénombrable (less latency).",
    mnemonic: "FEWER bugs · LESS latency.",
    distractors: ["The patch caused lesser errors than yesterday.", "The patch caused few errors than yesterday."],
  },
];

// ---------------------------------------------------------------------------
// Shop & Mascot Accessories
// ---------------------------------------------------------------------------

export type MascotAccessoryId = "headphones" | "visor" | "crown" | "scarf";
export type ShopItemId = "streak_freeze" | "xp_boost" | "heart_refill" | MascotAccessoryId;

export type StudioShopItem = Readonly<{
  id: ShopItemId;
  name: string;
  description: string;
  costGems: number;
  kind: "consumable" | "accessory";
  badge: string;
}>;

export const STUDIO_SHOP_ITEMS: readonly StudioShopItem[] = [
  {
    id: "streak_freeze",
    name: "Gel de série",
    description: "Protège automatiquement ta série si tu manques une journée.",
    costGems: 40,
    kind: "consumable",
    badge: "Bouclier",
  },
  {
    id: "xp_boost",
    name: "Boost XP ×2",
    description: "Double les XP de ta prochaine leçon, histoire ou chrono.",
    costGems: 35,
    kind: "consumable",
    badge: "Bonus",
  },
  {
    id: "heart_refill",
    name: "Recharge Cœurs",
    description: "Remplit immédiatement tes 5 cœurs pour enchaîner les défis.",
    costGems: 25,
    kind: "consumable",
    badge: "Énergie",
  },
  {
    id: "headphones",
    name: "Casque Studio",
    description: "Équipe Bit d'un casque audio pro pour tes sessions d'écoute.",
    costGems: 30,
    kind: "accessory",
    badge: "Style",
  },
  {
    id: "scarf",
    name: "Écharpe Ingénieur",
    description: "Une écharpe indigo stylée portée par Bit sur tout le studio.",
    costGems: 35,
    kind: "accessory",
    badge: "Style",
  },
  {
    id: "visor",
    name: "Visière Cyber",
    description: "Lunettes néon cybernétiques pour les unités Sécurité & Cloud.",
    costGems: 45,
    kind: "accessory",
    badge: "Style",
  },
  {
    id: "crown",
    name: "Couronne Or",
    description: "L'accessoire prestige pour récompenser ta régularité.",
    costGems: 80,
    kind: "accessory",
    badge: "Prestige",
  },
];

export const VALID_MASCOT_ACCESSORIES: readonly MascotAccessoryId[] = [
  "headphones",
  "visor",
  "crown",
  "scarf",
];

// ---------------------------------------------------------------------------
// Achievements / Badges
// ---------------------------------------------------------------------------

export type StudioAchievement = Readonly<{
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unlocked: boolean;
  tier: "bronze" | "silver" | "gold";
}>;

export type AchievementMetrics = Readonly<{
  xp: number;
  streak: number;
  completedNodesCount: number;
  completedStoriesCount: number;
  bestBlitzScore: number;
  perfectLessonsCount: number;
  grammarDrillsCompleted: number;
  ownedAccessoriesCount: number;
  missionCompletedToday: boolean;
}>;

export function computeStudioAchievements(m: AchievementMetrics): StudioAchievement[] {
  const defs: ReadonlyArray<Omit<StudioAchievement, "unlocked">> = [
    {
      id: "ach-first-step",
      title: "Premier Déclic",
      description: "Terminer ta première leçon sur le parcours",
      current: Math.min(1, m.completedNodesCount),
      target: 1,
      tier: "bronze",
    },
    {
      id: "ach-streak-3",
      title: "Flamme Régulière",
      description: "Maintenir une série de 3 jours consécutifs",
      current: Math.min(3, m.streak),
      target: 3,
      tier: "silver",
    },
    {
      id: "ach-xp-250",
      title: "Chasseur d'XP",
      description: "Cumuler 250 XP dans le studio Daily English",
      current: Math.min(250, m.xp),
      target: 250,
      tier: "silver",
    },
    {
      id: "ach-xp-1000",
      title: "Ingénieur Bilingue",
      description: "Atteindre 1 000 XP au total",
      current: Math.min(1000, m.xp),
      target: 1000,
      tier: "gold",
    },
    {
      id: "ach-perfect-3",
      title: "Précision Chirurgicale",
      description: "Réussir 3 leçons sans aucune erreur (100 %)",
      current: Math.min(3, m.perfectLessonsCount),
      target: 3,
      tier: "gold",
    },
    {
      id: "ach-stories-3",
      title: "Lecteur d'Histoires",
      description: "Compléter 3 dialogues interactifs en contexte pro",
      current: Math.min(3, m.completedStoriesCount),
      target: 3,
      tier: "silver",
    },
    {
      id: "ach-stories-all",
      title: "Collection Complète",
      description: "Terminer les 6 histoires ingénieur",
      current: Math.min(ENGINEERING_STORIES.length, m.completedStoriesCount),
      target: ENGINEERING_STORIES.length,
      tier: "gold",
    },
    {
      id: "ach-blitz-10",
      title: "Éclair 60s",
      description: "Atteindre un score de 10 bonnes réponses au Chrono 60s",
      current: Math.min(10, m.bestBlitzScore),
      target: 10,
      tier: "silver",
    },
    {
      id: "ach-grammar-2",
      title: "Zéro Faux-Ami",
      description: "Réussir 2 sessions d'entraînement Pièges Francophones",
      current: Math.min(2, m.grammarDrillsCompleted),
      target: 2,
      tier: "bronze",
    },
    {
      id: "ach-style",
      title: "Style de Bit",
      description: "Débloquer un accessoire pour Bit dans la boutique",
      current: Math.min(1, m.ownedAccessoriesCount),
      target: 1,
      tier: "bronze",
    },
  ];

  return defs.map((item) => ({
    ...item,
    unlocked: item.current >= item.target,
  }));
}
