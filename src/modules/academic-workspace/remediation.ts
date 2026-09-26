import type {
  AcademicQuizQuestion,
  RemediationMethod,
  RemediationMethodId,
  RemediationPolicy,
  SectionQuizCoverage,
} from "./types";

export const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
  contextualHintAfterWrongAnswers: 2,
  offerAfterWrongAnswers: 3,
};

const method = (
  id: RemediationMethodId,
  label: string,
  purpose: string,
  generationMethod: RemediationMethod["generationMethod"] = "DETERMINISTIC_SOURCE_GROUNDED",
  route?: string,
): RemediationMethod => ({
  id,
  label,
  purpose,
  conceptIds: ["OSI_REFERENCE_MODEL", "TCP_IP_STACK", "LAYER_RESPONSIBILITIES", "NETWORK_ENCAPSULATION"],
  sourceIds: ["ACADEMIC-NETWORK-CH01-001"],
  generationMethod,
  requiresAI: false,
  evidencePolicy: "GUIDED_PRACTICE_ONLY",
  route,
});

export const ACADEMIC_REMEDIATION_METHODS: RemediationMethod[] = [
  method("SIMPLE_EXPLANATION", "Réexplique-moi simplement", "Reformuler les faits vérifiés en étapes courtes."),
  method("ANALOGY", "Montre-moi une analogie", "Créer un pont mental sans présenter l’analogie comme un fait du cours.", "PEDAGOGICAL_DERIVATION"),
  method("WORKED_EXAMPLE", "Donne-moi un exemple", "Appliquer pas à pas les unités et responsabilités des couches."),
  method("FEYNMAN", "Méthode Feynman", "Préparer une explication personnelle puis la restituer support fermé.", "PEDAGOGICAL_DERIVATION"),
  method("MIND_MAP", "Carte mentale", "Visualiser les relations entre couches et unités.", "PEDAGOGICAL_DERIVATION"),
  method("MNEMONIC", "Technique de mémorisation", "Mémoriser un ordre avant un rappel actif.", "PEDAGOGICAL_DERIVATION"),
  method("FLASHCARDS", "Flashcards", "Transformer les associations couche-unité en rappel actif.", "PEDAGOGICAL_DERIVATION"),
  method("SOURCE_REVIEW", "Revoir le passage du cours", "Retourner au passage canonique cité."),
  method("GUIDED_PRACTICE", "Mini-exercice guidé", "Reconstruire l’enchaînement avec une aide progressive."),
  method("VISUAL_RECONSTRUCTION", "Reconstruction visuelle", "Réordonner les couches et leurs correspondances dans le laboratoire visuel.", "PEDAGOGICAL_DERIVATION", "/learn/visual-lab"),
];

export type AcademicErrorKind =
  | "ORDER_SEQUENCE"
  | "CONCEPT_CONFUSION"
  | "DEFINITION_FAILURE"
  | "SYSTEM_RELATIONSHIP_FAILURE"
  | "APPLICATION_FAILURE"
  | "REPEATED_MEMORY_FAILURE";

export function recommendedRemediation(errorKind: AcademicErrorKind): RemediationMethodId[] {
  if (errorKind === "ORDER_SEQUENCE") return ["VISUAL_RECONSTRUCTION", "MIND_MAP", "MNEMONIC"];
  if (errorKind === "CONCEPT_CONFUSION") return ["ANALOGY", "WORKED_EXAMPLE", "MIND_MAP"];
  if (errorKind === "DEFINITION_FAILURE") return ["SIMPLE_EXPLANATION", "FLASHCARDS", "FEYNMAN"];
  if (errorKind === "SYSTEM_RELATIONSHIP_FAILURE") return ["MIND_MAP", "VISUAL_RECONSTRUCTION", "GUIDED_PRACTICE"];
  if (errorKind === "APPLICATION_FAILURE") return ["WORKED_EXAMPLE", "GUIDED_PRACTICE", "FEYNMAN"];
  return ["FLASHCARDS", "MNEMONIC", "SOURCE_REVIEW"];
}

export function remediationMethod(id: RemediationMethodId) {
  return ACADEMIC_REMEDIATION_METHODS.find((item) => item.id === id)!;
}

export function coverageFromGroundedQuestions(sectionId: string, questions: AcademicQuizQuestion[]): SectionQuizCoverage {
  const grounded = questions.filter((question) =>
    question.sectionId === sectionId
    && question.sourceId
    && question.conceptIds.length > 0
    && question.verificationStatus === "VERIFIED",
  );
  if (grounded.length >= 2) return "FULL";
  if (grounded.length === 1) return "PARTIAL";
  return "INSUFFICIENT";
}

export function remediationSupport(methodId: RemediationMethodId, question: AcademicQuizQuestion) {
  const encapsulation = question.conceptIds.includes("NETWORK_ENCAPSULATION");
  const sourceFacts = encapsulation
    ? [
        "Page 20 : les unités présentées suivent message → segment → datagramme ou paquet → trame.",
        "Chaque couche ajoute ou interprète des informations de contrôle adaptées à son rôle.",
      ]
    : [
        "Pages 17–19 : le cours distingue application, transport, réseau, liaison et physique.",
        "La page 18 associe TCP et UDP au transport, et IP à la couche réseau.",
      ];
  const derived = methodId === "VISUAL_RECONSTRUCTION"
    ? "Reconstruction visuelle : réordonne les couches OSI et associe-les à la pile TCP/IP, puis reviens au rappel actif."
    : methodId === "ANALOGY"
    ? "Analogie pédagogique : imagine des enveloppes imbriquées. Chaque enveloppe ajoute les informations nécessaires à une étape; cette image n’est pas une formulation littérale du cours."
    : methodId === "MIND_MAP"
    ? encapsulation
      ? "Carte pédagogique : Message ↓ Segment ↓ Datagramme/paquet ↓ Trame ↓ Bits."
      : "Carte pédagogique : Application ↓ Transport ↓ Réseau ↓ Liaison ↓ Physique."
    : methodId === "MNEMONIC"
    ? "Technique pédagogique : regroupe les éléments par paires, puis reconstruis l’ordre sans regarder."
    : methodId === "FLASHCARDS"
    ? "Rappel actif : cache les réponses et associe successivement chaque couche à son unité ou à son rôle."
    : methodId === "FEYNMAN"
    ? "Explique le mécanisme en trois phrases simples, ferme le support, puis recommence sans vocabulaire appris par cœur."
    : methodId === "GUIDED_PRACTICE"
    ? "Mini-exercice : pars du message, ajoute une couche à la fois et nomme la nouvelle unité avant de continuer."
    : methodId === "WORKED_EXAMPLE"
    ? encapsulation
      ? "Exemple guidé : un message applicatif descend vers le transport et devient segment, puis paquet/datagramme au réseau, puis trame à la liaison."
      : "Exemple guidé : une application confie ses données au transport; IP intervient ensuite au niveau réseau avant la liaison."
    : methodId === "SOURCE_REVIEW"
    ? `Relis uniquement ${question.pageStart === question.pageEnd ? `la page ${question.pageStart}` : `les pages ${question.pageStart}–${question.pageEnd}`} puis ferme le support.`
    : encapsulation
    ? "Explication simple : en descendant la pile, les données changent d’unité parce que chaque couche ajoute ses informations de contrôle."
    : "Explication simple : chaque couche a une responsabilité distincte et transmet le résultat à la couche voisine.";
  return {
    sourceFacts,
    pedagogicalSupport: derived,
    pedagogicalSupportKind: methodId,
    sourceId: question.sourceId,
    sectionId: question.sectionId,
    pageStart: question.pageStart,
    pageEnd: question.pageEnd,
  };
}
