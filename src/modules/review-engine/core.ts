import type { EvidenceRecord } from "../learning-records/types";
import type { MissionAttempt } from "../mission-runtime/types";
import { scheduleReview } from "../scientific-pedagogy/core";
import type { ErrorPattern, ErrorSignal, ReviewConcept, ReviewItem, ReviewResultRecord } from "./types";

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;
export const REVIEW_POLICY_VERSION = 1;

function unique(values: string[]) {
  return [...new Set(values)];
}

function uniquePageReferences(values: NonNullable<ErrorSignal["academicPageReferences"]>) {
  return [...new Map(values.map((reference) => [
    `${reference.sourceId}:${reference.pageStart}:${reference.pageEnd}`,
    reference,
  ])).values()];
}

function signal(attempt: MissionAttempt, sourceEvidenceId: string, errorType: ErrorSignal["errorType"], concept: ReviewConcept, description: string, severity: ErrorSignal["severity"], observedAt: number): ErrorSignal {
  return {
    id: `${attempt.id}:${errorType}:${concept}`,
    competencyId: "EXCEL_CSV_IMPORT",
    sourceEvidenceId,
    missionId: attempt.missionId,
    attemptId: attempt.id,
    errorType,
    concept,
    description,
    observedAt,
    severity,
  };
}

export function detectExcelErrorSignals(attempt: MissionAttempt, availableEvidenceIds: string[]): ErrorSignal[] {
  if (attempt.startedAt === null) return [];
  const sourceEvidenceId = `${attempt.id}:MISSION_ATTEMPT`;
  if (!availableEvidenceIds.includes(sourceEvidenceId)) return [];
  const signals: ErrorSignal[] = [];
  const incorrect = attempt.events.filter((event) => event.type === "ANSWER_INCORRECT");
  const strongHints = attempt.events.filter((event) => event.type === "HINT_USED" && (event.value ?? 0) >= 3);
  const retriesByStep = attempt.events.filter((event) => event.type === "RETRY").reduce<Record<string, number>>((counts, event) => {
    const stepId = event.stepId ?? "unknown";
    counts[stepId] = (counts[stepId] ?? 0) + 1;
    return counts;
  }, {});

  if (incorrect.some((event) => event.stepId === "check-columns")) {
    signals.push(signal(attempt, sourceEvidenceId, "PROCEDURAL_ERROR", "CSV_DELIMITER_DIAGNOSIS", "Le diagnostic du délimiteur a nécessité une correction.", "MEDIUM", incorrect.find((event) => event.stepId === "check-columns")!.at));
  }
  if (incorrect.some((event) => event.stepId === "find-anomaly")) {
    signals.push(signal(attempt, sourceEvidenceId, "DATA_INSPECTION_ERROR", "ENERGY_MISSING_VALUE_INSPECTION", "La valeur d’énergie manquante n’a pas été identifiée au premier essai.", "MEDIUM", incorrect.find((event) => event.stepId === "find-anomaly")!.at));
  }
  for (const event of strongHints) {
    const concept = event.stepId === "find-anomaly" ? "ENERGY_MISSING_VALUE_INSPECTION" : "CSV_DELIMITER_DIAGNOSIS";
    signals.push(signal(attempt, sourceEvidenceId, "HINT_DEPENDENCE", concept, "Un indice très explicite a été nécessaire pour réussir cette étape.", "LOW", event.at));
  }
  for (const [stepId, retryCount] of Object.entries(retriesByStep)) {
    if (retryCount < 2) continue;
    const concept = stepId === "find-anomaly" ? "ENERGY_MISSING_VALUE_INSPECTION" : "CSV_DELIMITER_DIAGNOSIS";
    signals.push(signal(attempt, sourceEvidenceId, "RETRY_DEPENDENCE", concept, "Plusieurs nouvelles tentatives ont été nécessaires sur cette notion.", "MEDIUM", attempt.events.filter((event) => event.type === "RETRY" && event.stepId === stepId).at(-1)!.at));
  }
  const confidence = Number(attempt.responses["self-evaluation"]);
  if (attempt.status === "COMPLETED" && Number.isFinite(confidence) && confidence <= 2) {
    signals.push(signal(attempt, sourceEvidenceId, "LOW_CONFIDENCE", "CSV_DELIMITER_DIAGNOSIS", "La réussite est accompagnée d’une confiance déclarée faible.", "LOW", attempt.completedAt ?? attempt.startedAt));
  }
  return signals;
}

export function mergeErrorPatterns(existing: ErrorPattern[], signals: ErrorSignal[]): ErrorPattern[] {
  const byId = new Map(existing.map((pattern) => [pattern.id, pattern]));
  for (const current of signals) {
    const id = `error:${current.competencyId}:${current.errorType}:${current.concept}`;
    const prior = byId.get(id);
    if (!prior) {
      byId.set(id, {
        id,
        competencyId: current.competencyId,
        sourceEvidenceIds: [current.sourceEvidenceId],
        missionId: current.missionId,
        attemptIds: [current.attemptId],
        errorType: current.errorType,
        concept: current.concept,
        description: current.description,
        firstObservedAt: current.observedAt,
        lastObservedAt: current.observedAt,
        occurrenceCount: 1,
        severity: current.severity,
        resolvedStatus: "ACTIVE",
        latestReviewResult: null,
        metadata: {
          observedSignalIds: [current.id],
          successfulReviewCount: 0,
          academicSourceIds: current.academicSourceId ? [current.academicSourceId] : [],
          academicSectionIds: current.academicSectionId ? [current.academicSectionId] : [],
          remediationMethods: current.remediationMethod ? [current.remediationMethod] : [],
          originErrorPatternIds: current.originErrorPatternId ? [current.originErrorPatternId] : [],
          visualAttemptCount: current.visualAttemptCount ?? 0,
          visualHintUsage: current.visualHintUsage ?? 0,
          academicPageReferences: uniquePageReferences(current.academicPageReferences ?? []),
        },
        sourceClassification: "PERSONAL",
      });
      continue;
    }
    if (prior.metadata.observedSignalIds.includes(current.id)) {
      byId.set(id, {
        ...prior,
        metadata: {
          ...prior.metadata,
          academicSourceIds: unique([...(prior.metadata.academicSourceIds ?? []), ...(current.academicSourceId ? [current.academicSourceId] : [])]),
          academicSectionIds: unique([...(prior.metadata.academicSectionIds ?? []), ...(current.academicSectionId ? [current.academicSectionId] : [])]),
          remediationMethods: unique([...(prior.metadata.remediationMethods ?? []), ...(current.remediationMethod ? [current.remediationMethod] : [])]),
          originErrorPatternIds: unique([...(prior.metadata.originErrorPatternIds ?? []), ...(current.originErrorPatternId ? [current.originErrorPatternId] : [])]),
          visualAttemptCount: Math.max(prior.metadata.visualAttemptCount ?? 0, current.visualAttemptCount ?? 0),
          visualHintUsage: Math.max(prior.metadata.visualHintUsage ?? 0, current.visualHintUsage ?? 0),
          academicPageReferences: uniquePageReferences([...(prior.metadata.academicPageReferences ?? []), ...(current.academicPageReferences ?? [])]),
        },
      });
      continue;
    }
    const occurrenceCount = prior.occurrenceCount + 1;
    byId.set(id, {
      ...prior,
      sourceEvidenceIds: unique([...prior.sourceEvidenceIds, current.sourceEvidenceId]),
      attemptIds: unique([...prior.attemptIds, current.attemptId]),
      lastObservedAt: Math.max(prior.lastObservedAt, current.observedAt),
      occurrenceCount,
      severity: occurrenceCount >= 2 ? "HIGH" : prior.severity,
      resolvedStatus: "ACTIVE",
      metadata: {
        ...prior.metadata,
        observedSignalIds: [...prior.metadata.observedSignalIds, current.id],
        academicSourceIds: unique([...(prior.metadata.academicSourceIds ?? []), ...(current.academicSourceId ? [current.academicSourceId] : [])]),
        academicSectionIds: unique([...(prior.metadata.academicSectionIds ?? []), ...(current.academicSectionId ? [current.academicSectionId] : [])]),
        remediationMethods: unique([...(prior.metadata.remediationMethods ?? []), ...(current.remediationMethod ? [current.remediationMethod] : [])]),
        originErrorPatternIds: unique([...(prior.metadata.originErrorPatternIds ?? []), ...(current.originErrorPatternId ? [current.originErrorPatternId] : [])]),
        visualAttemptCount: Math.max(prior.metadata.visualAttemptCount ?? 0, current.visualAttemptCount ?? 0),
        visualHintUsage: Math.max(prior.metadata.visualHintUsage ?? 0, current.visualHintUsage ?? 0),
        academicPageReferences: uniquePageReferences([...(prior.metadata.academicPageReferences ?? []), ...(current.academicPageReferences ?? [])]),
      },
    });
  }
  return [...byId.values()].sort((left, right) => left.firstObservedAt - right.firstObservedAt);
}

function template(concept: ReviewConcept) {
  if (concept === "ENCAPSULATION_PDU_CONFUSION") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Associer couche et unité de données",
      prompt: "Dans l’encapsulation présentée par le cours, quelle unité correspond à la couche liaison ?",
      choices: [{ id: "frame", label: "Trame" }, { id: "segment", label: "Segment" }, { id: "message", label: "Message" }],
      expectedResponse: "frame",
      acceptedKeywords: ["trame", "frame"],
      hint: "La page 20 place cette unité après le datagramme ou paquet.",
      successFeedback: "Exact. La couche liaison manipule la trame dans le schéma étudié.",
      retryFeedback: "Reconstitue l’ordre message, segment, datagramme ou paquet, puis trame.",
    };
  }
  if (concept === "OSI_LAYER_ORDER_CONFUSION") {
    return {
      reviewType: "VISUAL_ORDER_RECONSTRUCTION" as const,
      title: "Reconstituer l’ordre des couches OSI",
      prompt: "Replace les sept couches OSI dans l’ordre, de la couche Application à la couche Physique.",
      choices: [{ id: "application", label: "Application" }, { id: "transport", label: "Transport" }, { id: "physical", label: "Physique" }],
      expectedResponse: "application",
      acceptedKeywords: ["application", "couche 7"],
      hint: "Pars de la couche la plus proche de l’utilisateur.",
      successFeedback: "Exact. Application est la couche supérieure du modèle OSI.",
      retryFeedback: "Repars de l’ordre 7 vers 1 et identifie la couche la plus proche de l’utilisateur.",
      origin: "VISUAL_LEARNING" as const,
      actionRoute: "/learn/visual-lab?task=OSI_TCPIP_RECONSTRUCTION&focus=order",
    };
  }
  if (concept === "OSI_TCPIP_MAPPING_CONFUSION") {
    return {
      reviewType: "VISUAL_MAPPING_RECONSTRUCTION" as const,
      title: "Associer OSI et TCP/IP",
      prompt: "Associe chaque couche OSI à la couche TCP/IP correspondante.",
      choices: [
        { id: "application", label: "Application TCP/IP" },
        { id: "transport", label: "Transport TCP/IP" },
        { id: "network", label: "Réseau TCP/IP" },
      ],
      expectedResponse: "application",
      acceptedKeywords: ["application", "application tcp/ip"],
      hint: "Les trois couches OSI supérieures sont regroupées.",
      successFeedback: "Exact. Présentation est regroupée dans la couche Application de TCP/IP.",
      retryFeedback: "Observe le regroupement des couches Application, Présentation et Session.",
      origin: "VISUAL_LEARNING" as const,
      actionRoute: "/learn/visual-lab?task=OSI_TCPIP_RECONSTRUCTION&focus=mapping",
    };
  }
  if (concept === "OSI_LAYER_MISCLASSIFICATION") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Situer IP dans le modèle OSI",
      prompt: "À quelle couche du modèle OSI rattache-t-on principalement le protocole IP ?",
      choices: [{ id: "network", label: "Couche réseau" }, { id: "transport", label: "Couche transport" }, { id: "physical", label: "Couche physique" }],
      expectedResponse: "network",
      acceptedKeywords: ["réseau", "network", "couche 3"],
      hint: "Cette couche choisit le chemin logique entre réseaux.",
      successFeedback: "Exact. IP relève principalement de la couche réseau.",
      retryFeedback: "Repars du rôle d’IP : adresser et acheminer des paquets entre réseaux.",
    };
  }
  if (concept === "TCP_UDP_CONFUSION") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Choisir TCP ou UDP",
      prompt: "Quel protocole de transport fournit une livraison ordonnée avec contrôle de connexion ?",
      choices: [{ id: "tcp", label: "TCP" }, { id: "udp", label: "UDP" }, { id: "arp", label: "ARP" }],
      expectedResponse: "tcp",
      acceptedKeywords: ["tcp"],
      hint: "Cherche le protocole orienté connexion.",
      successFeedback: "Exact. TCP fournit une livraison ordonnée et contrôlée.",
      retryFeedback: "Distingue le protocole orienté connexion du transport sans connexion.",
    };
  }
  if (concept === "MISSED_DATA_ANOMALY") {
    return {
      reviewType: "SHORT_TEXT" as const,
      title: "Repérer l’anomalie utile",
      prompt: "Dans un échantillon de lots, quelle métrique compares-tu pour repérer un écart énergétique indépendant du volume produit ?",
      expectedResponse: "Energy_kWh_per_Ton",
      acceptedKeywords: ["energy_kwh_per_ton", "energy kwh per ton", "énergie par tonne", "kwh/t"],
      hint: "Rapporte l’énergie au tonnage produit.",
      successFeedback: "Exact. L’énergie par tonne rend les lots plus directement comparables.",
      retryFeedback: "Cherche une métrique qui neutralise la différence de tonnage.",
    };
  }
  if (concept === "CONFUSED_FACT_AND_ASSUMPTION" || concept === "OVERCLAIM_WITHOUT_EVIDENCE") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Fait ou conclusion prématurée",
      prompt: "Un lot affiche une énergie par tonne très supérieure aux lots voisins. Que peux-tu affirmer immédiatement ?",
      choices: [
        { id: "observed-gap", label: "L’écart est observé dans l’échantillon; sa cause reste à vérifier." },
        { id: "machine-failure", label: "La machine est forcément en panne." },
        { id: "site-inefficient", label: "Le site est inefficace." },
      ],
      expectedResponse: "observed-gap",
      acceptedKeywords: ["écart observé", "cause reste à vérifier", "a verifier"],
      hint: "Sépare la valeur visible de l’explication encore inconnue.",
      successFeedback: "Exact. Le fait porte sur l’écart; la cause reste une hypothèse.",
      retryFeedback: "Cette réponse attribue une cause sans preuve suffisante.",
    };
  }
  if (concept === "NO_NEXT_ACTION") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Prochaine action vérifiable",
      prompt: "Après avoir repéré un KPI inhabituel, quelle action réduit le mieux l’incertitude ?",
      choices: [
        { id: "verify-source", label: "Vérifier la source, l’unité et le calcul." },
        { id: "ignore", label: "Ignorer le lot." },
        { id: "announce-failure", label: "Annoncer une panne certaine." },
      ],
      expectedResponse: "verify-source",
      acceptedKeywords: ["vérifier", "source", "unité", "calcul"],
      hint: "Choisis une action concrète qui teste la qualité de la donnée.",
      successFeedback: "Exact. Cette vérification est proportionnée et actionnable.",
      retryFeedback: "L’action doit réduire l’incertitude sans inventer de cause.",
    };
  }
  if (concept === "ENERGY_MISSING_VALUE_INSPECTION") {
    return {
      reviewType: "SHORT_TEXT" as const,
      title: "Inspection d’une valeur d’énergie",
      prompt: "Dans un tableau de production, une mesure d’énergie semble incomplète. Quelle colonne inspectes-tu en priorité ?",
      expectedResponse: "Energy_kWh",
      acceptedKeywords: ["energy_kwh", "energy kwh", "énergie", "energie"],
      hint: "Cherche la colonne qui porte directement la mesure d’énergie.",
      successFeedback: "Exact. Inspecter Energy_kWh permet de repérer une mesure absente avant tout calcul.",
      retryFeedback: "Ce n’est pas encore la colonne la plus directe. Repère celle qui contient les valeurs d’énergie.",
    };
  }
  if (concept === "CSV_DELIMITER_VS_ENCODING") {
    return {
      reviewType: "MULTIPLE_CHOICE" as const,
      title: "Délimiteur ou encodage ?",
      prompt: "Quel réglage agit directement sur la répartition des champs en colonnes ?",
      choices: [{ id: "delimiter", label: "Le délimiteur" }, { id: "encoding", label: "L’encodage" }],
      expectedResponse: "delimiter",
      acceptedKeywords: ["délimiteur", "delimiteur", "séparateur", "separateur"],
      hint: "L’encodage agit surtout sur la représentation des caractères.",
      successFeedback: "Exact. Le délimiteur sépare les champs; l’encodage représente les caractères.",
      retryFeedback: "Compare un problème de colonnes à un problème de caractères illisibles.",
    };
  }
  if (concept === "CSV_SEPARATOR_TRANSFER") {
    return {
      reviewType: "SHORT_TEXT" as const,
      title: "Reconnaître un nouveau séparateur",
      prompt: "Dans Name;Site;Energy, quel séparateur faut-il choisir à l’import ?",
      expectedResponse: "point-virgule",
      acceptedKeywords: ["point-virgule", "point virgule", ";", "semicolon"],
      hint: "Observe le caractère placé entre chaque nom de colonne.",
      successFeedback: "Exact. Le point-virgule est le délimiteur de ce fichier.",
      retryFeedback: "Relis le caractère répété entre Name, Site et Energy.",
    };
  }
  return {
    reviewType: "MULTIPLE_CHOICE" as const,
    title: "Diagnostic du délimiteur",
    prompt: "Un nouveau CSV s’ouvre dans une seule colonne dans Excel. Quelle est la première chose à vérifier ?",
    choices: [
      { id: "delimiter", label: "Le délimiteur choisi pendant l’import" },
      { id: "alignment", label: "L’alignement horizontal des cellules" },
      { id: "font", label: "La police utilisée dans le classeur" },
    ],
    expectedResponse: "delimiter",
    acceptedKeywords: ["délimiteur", "delimiteur", "virgule", "separator", "séparateur", "separateur"],
    hint: "Pense au caractère qui sépare les champs dans le fichier brut.",
    successFeedback: "Exact. Le délimiteur est le premier contrôle quand toutes les données restent dans une colonne.",
    retryFeedback: "Cette action ne corrige pas la séparation des champs. Réessaie en pensant à l’import du fichier.",
  };
}

export function generateReviewItems(existing: ReviewItem[], patterns: ErrorPattern[], now: number): ReviewItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const grouped = new Map<string, ErrorPattern[]>();
  patterns.filter((pattern) => pattern.resolvedStatus !== "RESOLVED" && pattern.concept !== "TECHNICAL_CSV_EXPLANATION").forEach((pattern) => {
    const key = `${pattern.competencyId}:${pattern.concept}`;
    grouped.set(key, [...(grouped.get(key) ?? []), pattern]);
  });
  for (const conceptPatterns of grouped.values()) {
    const concept = conceptPatterns[0].concept;
    const competencyId = conceptPatterns[0].competencyId;
    const id = `review:${competencyId}:${concept}`;
    const prior = byId.get(id);
    const sourceEvidenceIds = unique(conceptPatterns.flatMap((pattern) => pattern.sourceEvidenceIds));
    const errorPatternIds = conceptPatterns.map((pattern) => pattern.id);
    const academicSourceIds = unique(conceptPatterns.flatMap((pattern) => pattern.metadata.academicSourceIds ?? []));
    const academicSectionIds = unique(conceptPatterns.flatMap((pattern) => pattern.metadata.academicSectionIds ?? []));
    const remediationMethods = unique(conceptPatterns.flatMap((pattern) => pattern.metadata.remediationMethods ?? []));
    const academicPageReferences = uniquePageReferences(conceptPatterns.flatMap((pattern) => pattern.metadata.academicPageReferences ?? []));
    const content = template(concept);
    const visualWhyDue = content.origin === "VISUAL_LEARNING"
      ? "À revoir maintenant car une difficulté a été observée dans ta reconstruction visuelle."
      : null;
    if (!prior) {
      byId.set(id, {
        id,
        competencyId,
        errorPatternIds,
        sourceEvidenceIds,
        missionId: conceptPatterns[0].missionId,
        concept,
        ...content,
        createdAt: now,
        dueAt: now,
        intervalMinutes: 0,
        status: "DUE",
        attemptCount: 0,
        successCount: 0,
        lastReviewedAt: null,
        nextReviewAt: now,
        whyDue: visualWhyDue ?? (competencyId === "EXCEL_CSV_IMPORT"
          ? "À revoir maintenant car une difficulté a été observée dans ta mission Excel."
          : competencyId === "NETWORK_FUNDAMENTALS" || competencyId === "OSI_TCP_IP_REASONING"
          ? "À revoir maintenant car une difficulté a été observée dans ton quiz de réseau."
          : "À revoir maintenant car une difficulté a été observée dans ton scénario professionnel."),
        academicSourceIds,
        academicSectionIds,
        remediationMethods,
        academicPageReferences,
        sourceClassification: "PERSONAL",
      });
      continue;
    }
    const hasNewSource = sourceEvidenceIds.some((sourceId) => !prior.sourceEvidenceIds.includes(sourceId));
    byId.set(id, {
      ...prior,
      ...content,
      ...(visualWhyDue ? { whyDue: visualWhyDue } : {}),
      errorPatternIds: unique([...prior.errorPatternIds, ...errorPatternIds]),
      sourceEvidenceIds: unique([...prior.sourceEvidenceIds, ...sourceEvidenceIds]),
      academicSourceIds: unique([...(prior.academicSourceIds ?? []), ...academicSourceIds]),
      academicSectionIds: unique([...(prior.academicSectionIds ?? []), ...academicSectionIds]),
      remediationMethods: unique([...(prior.remediationMethods ?? []), ...remediationMethods]),
      academicPageReferences: uniquePageReferences([...(prior.academicPageReferences ?? []), ...academicPageReferences]),
      ...(hasNewSource ? { dueAt: Math.min(prior.dueAt, now), nextReviewAt: Math.min(prior.nextReviewAt, now), status: "DUE" as const, whyDue: visualWhyDue ?? "À revoir maintenant car une nouvelle difficulté a été observée." } : {}),
    });
  }
  return [...byId.values()].sort((left, right) => left.dueAt - right.dueAt);
}

export function reviewStatusAt(item: ReviewItem, now: number): ReviewItem["status"] {
  if (item.status === "SUSPENDED") return "SUSPENDED";
  return item.dueAt <= now ? "DUE" : "UPCOMING";
}

export function evaluateReviewResponse(item: ReviewItem, response: string) {
  const normalized = response.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) return false;
  if (item.reviewType === "MULTIPLE_CHOICE") return normalized === item.expectedResponse.toLocaleLowerCase("fr-FR");
  return (item.acceptedKeywords ?? [item.expectedResponse]).some((keyword) => normalized.includes(keyword.toLocaleLowerCase("fr-FR")));
}

export function reviewIsTraceable(item: ReviewItem, patterns: ErrorPattern[], evidence: EvidenceRecord[]) {
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const evidenceIds = new Set(evidence.map((record) => record.id));
  const linkedPatterns = patterns.filter((pattern) => item.errorPatternIds.includes(pattern.id));
  return item.errorPatternIds.length > 0
    && item.sourceEvidenceIds.length > 0
    && item.errorPatternIds.every((id) => patternIds.has(id))
    && item.sourceEvidenceIds.every((id) => evidenceIds.has(id))
    && linkedPatterns.every((pattern) => pattern.sourceEvidenceIds.length > 0 && pattern.sourceEvidenceIds.every((id) => evidenceIds.has(id)));
}

export function countDueReviews(items: ReviewItem[], patterns: ErrorPattern[], evidence: EvidenceRecord[], now: number) {
  return items.filter((item) => reviewStatusAt(item, now) === "DUE" && reviewIsTraceable(item, patterns, evidence)).length;
}

export function selectVisibleReviewItems(
  items: ReviewItem[],
  patterns: ErrorPattern[],
  evidence: EvidenceRecord[],
  now: number,
) {
  const visible = items.filter((item) => reviewIsTraceable(item, patterns, evidence) && reviewStatusAt(item, now) !== "SUSPENDED");
  return {
    due: visible.filter((item) => reviewStatusAt(item, now) === "DUE"),
    upcoming: visible.filter((item) => reviewStatusAt(item, now) === "UPCOMING"),
  };
}

export function applyReviewResult(item: ReviewItem, patterns: ErrorPattern[], result: ReviewResultRecord) {
  const successCount = item.successCount + (result.correct ? 1 : 0);
  const schedule = scheduleReview({
    correct: result.correct,
    successfulReviewCount: successCount,
    confidence: result.confidence,
    hintCount: result.hintCount,
    retryCount: result.retryCount,
    recurringErrorCount: Math.max(0, ...patterns
      .filter((pattern) => item.errorPatternIds.includes(pattern.id))
      .map((pattern) => pattern.occurrenceCount)),
  });
  const intervalMinutes = schedule.intervalMinutes;
  const nextReviewAt = result.completedAt + intervalMinutes * MINUTE_MS;
  const reviewItem: ReviewItem = {
    ...item,
    attemptCount: item.attemptCount + 1,
    successCount,
    lastReviewedAt: result.completedAt,
    dueAt: nextReviewAt,
    nextReviewAt,
    intervalMinutes,
    status: "UPCOMING",
    whyDue: result.correct
      ? `Prochaine vérification dans ${intervalMinutes / (24 * 60)} jour(s) après une réponse correcte.`
      : "À revoir bientôt car la dernière réponse n’était pas encore correcte.",
  };
  const errorPatterns = patterns.map((pattern) => {
    if (!item.errorPatternIds.includes(pattern.id)) return pattern;
    const successfulReviewCount = (pattern.metadata.successfulReviewCount ?? 0) + (result.correct ? 1 : 0);
    return { ...pattern, latestReviewResult: result.correct ? "CORRECT" as const : "INCORRECT" as const, resolvedStatus: result.correct ? (successfulReviewCount >= 3 ? "RESOLVED" as const : "IMPROVING" as const) : "ACTIVE" as const, metadata: { ...pattern.metadata, successfulReviewCount } };
  });
  return { reviewItem, errorPatterns };
}

export function reviewEvidenceFromResult(item: ReviewItem, result: ReviewResultRecord): EvidenceRecord {
  const delimiter = item.concept === "CSV_DELIMITER_DIAGNOSIS";
  return {
    id: `${item.id}:result:${item.attemptCount + 1}`,
    attemptId: result.id,
    missionId: item.missionId,
    missionVersion: REVIEW_POLICY_VERSION,
    competencyIds: [item.competencyId],
    createdAt: result.completedAt,
    evidenceType: "REVIEW_RESULT",
    artifactReference: null,
    learnerResponses: { reviewResponse: result.response },
    evaluationResult: {
      outcome: result.correct ? "REVIEW_SUCCESS" : "REVIEW_FAILURE",
      delimiterDiagnostic: delimiter ? (result.correct ? "VALID" : "INVALID") : "PENDING",
      anomalyIdentification: delimiter ? "PENDING" : (result.correct ? "VALID" : "INVALID"),
      missionCompletion: "PENDING",
    },
    assistance: { hintCount: result.hintCount, retryCount: result.retryCount },
    selfEvaluation: result.confidence,
    sourceClassification: "PERSONAL",
    verificationStatus: "VALID",
    relatedEvidenceIds: item.sourceEvidenceIds,
  };
}
