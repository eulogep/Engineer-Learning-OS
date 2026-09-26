import type { AIProvider, AcademicQuizAttempt, AcademicQuizDefinition, AcademicQuizQuestion, AskCourseAnswer, CourseClassificationDraft, CourseFormat, CourseIngestionRecord, RemediationMethodId, RemediationPolicy } from "./types";
import { DEFAULT_REMEDIATION_POLICY } from "./remediation.ts";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim();

export function validateCourseClassification(draft: CourseClassificationDraft) {
  const errors: string[] = [];
  if (!draft.fileName.trim()) errors.push("Le nom du fichier est requis.");
  if (!draft.subjectId) errors.push("La matière est requise.");
  if (!draft.moduleId) errors.push("Le module est requis.");
  if (!draft.language.trim()) errors.push("La langue est requise.");
  if (draft.classification === "UNKNOWN") errors.push("Une classification UNKNOWN bloque l’ingestion.");
  return { valid: errors.length === 0, errors };
}

export const configuredAIProviders: AIProvider[] = [];
export const supportedCourseFormats: CourseFormat[] = ["PDF", "DOCX", "MARKDOWN", "TEXT", "CSV"];

export function courseFormatFromFileName(fileName: string): CourseFormat | null {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return extension === "pdf" ? "PDF" : extension === "docx" ? "DOCX" : extension === "md" ? "MARKDOWN" : extension === "txt" ? "TEXT" : extension === "csv" ? "CSV" : null;
}

export function planCourseIngestion(draft: CourseClassificationDraft, extractorAvailable: boolean): CourseIngestionRecord {
  const validation = validateCourseClassification(draft);
  const supported = supportedCourseFormats.includes(draft.format);
  const canExtract = validation.valid && supported && extractorAvailable;
  return {
    id: `INGESTION-PLAN:${draft.fileName || "UNNAMED"}`,
    sourceId: `LOCAL-METADATA:${draft.fileName || "UNNAMED"}`,
    format: draft.format,
    status: canExtract ? "METADATA_ONLY" : "EXTRACTION_FAILED",
    extractionMethod: "NONE",
    extractedSectionIds: [],
    failureReason: canExtract ? null : validation.errors.join(" ") || "Extracteur local indisponible.",
    binaryCommitted: false,
  };
}

export function academicQuizIsGrounded(definition: AcademicQuizDefinition) {
  return definition.questions.length > 0 && definition.questions.every((question) => question.sourceId && question.sectionId && question.conceptIds.length > 0 && question.verificationStatus === "VERIFIED");
}

export function academicPdfQuizIsGrounded(definition: AcademicQuizDefinition) {
  return academicQuizIsGrounded(definition) && definition.questions.every((question) =>
    Number.isInteger(question.pageStart)
    && Number.isInteger(question.pageEnd)
    && question.pageStart! > 0
    && question.pageEnd! >= question.pageStart!,
  );
}

export function askCourseAnswerIsGrounded(answer: AskCourseAnswer, allowedSourceIds: string[], allowedSectionIds: string[]) {
  return answer.citations.length > 0
    && answer.citations.every((citation) => allowedSourceIds.includes(citation.sourceId) && allowedSectionIds.includes(citation.sectionId))
    && answer.claims.every((claim) => claim.basis === "SOURCE" || claim.basis === "INFERENCE");
}

export function evaluateAcademicQuestion(question: AcademicQuizQuestion, response: string) {
  const answer = normalize(response);
  if (!answer) return false;
  if (question.responseType === "MULTIPLE_CHOICE") return answer === normalize(question.expectedResponse);
  return (question.acceptedKeywords ?? [question.expectedResponse]).some((keyword) => answer.includes(normalize(keyword)));
}

export function createAcademicQuizAttempt(definition: AcademicQuizDefinition, at = Date.now(), id = `academic:${definition.id}:${at}`): AcademicQuizAttempt {
  return { id, definitionId: definition.id, definitionVersion: definition.version, status: "READY", currentQuestionIndex: 0, responses: {}, feedback: {}, attempts: {}, retries: {}, hintsUsed: {}, completedQuestionIds: [], remediations: {}, retrievalQuestionIds: [], startedAt: null, completedAt: null, updatedAt: at };
}

export function startAcademicQuiz(attempt: AcademicQuizAttempt, at = Date.now()): AcademicQuizAttempt {
  if (attempt.status !== "READY") return attempt;
  return { ...attempt, status: "IN_PROGRESS", startedAt: at, updatedAt: at };
}

export function remediationShouldBeOffered(
  signals: { wrongAnswerCount: number; hintCount?: number; sameConceptRecentErrors?: number; confidence?: number | null; reviewHistory?: number },
  policy: RemediationPolicy = DEFAULT_REMEDIATION_POLICY,
) {
  return signals.wrongAnswerCount >= policy.offerAfterWrongAnswers
    || (signals.sameConceptRecentErrors ?? 0) >= policy.offerAfterWrongAnswers
    || ((signals.hintCount ?? 0) >= 2 && signals.wrongAnswerCount >= policy.contextualHintAfterWrongAnswers)
    || ((signals.confidence ?? 5) <= 2 && (signals.reviewHistory ?? 0) >= 1 && signals.wrongAnswerCount >= 2);
}

export function submitAcademicAnswer(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, response: string, at = Date.now(), policy: RemediationPolicy = DEFAULT_REMEDIATION_POLICY): AcademicQuizAttempt {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  const question = definition.questions[attempt.currentQuestionIndex];
  if (!question) return attempt;
  const correct = evaluateAcademicQuestion(question, response);
  const attemptCount = (attempt.attempts[question.id] ?? 0) + 1;
  const priorRemediation = attempt.remediations?.[question.id];
  const offerRemediation = !correct && !priorRemediation && remediationShouldBeOffered({
    wrongAnswerCount: attemptCount,
    hintCount: attempt.hintsUsed[question.id] ?? 0,
  }, policy);
  const contextual = !correct && attemptCount >= policy.contextualHintAfterWrongAnswers
    ? ` ${question.hint}`
    : "";
  const remediations = { ...(attempt.remediations ?? {}) };
  if (offerRemediation) {
    remediations[question.id] = {
      questionId: question.id,
      conceptIds: question.conceptIds,
      sourceId: question.sourceId,
      sectionId: question.sectionId,
      offeredAt: at,
      selectedMethod: null,
      selectedAt: null,
      supportClosedAt: null,
      postRemediationResult: "PENDING",
    };
  } else if (priorRemediation?.supportClosedAt) {
    remediations[question.id] = {
      ...priorRemediation,
      postRemediationResult: correct ? "SUCCESS" : "FAILURE",
    };
  }
  return {
    ...attempt,
    responses: { ...attempt.responses, [question.id]: response },
    attempts: { ...attempt.attempts, [question.id]: attemptCount },
    feedback: { ...attempt.feedback, [question.id]: { correct, message: correct ? question.successFeedback : `${question.retryFeedback}${contextual}` } },
    remediations,
    updatedAt: at,
  };
}

export function retryAcademicQuestion(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, at = Date.now()): AcademicQuizAttempt {
  const question = definition.questions[attempt.currentQuestionIndex];
  if (!question) return attempt;
  const feedback = { ...attempt.feedback }; delete feedback[question.id];
  return { ...attempt, feedback, responses: { ...attempt.responses, [question.id]: "" }, retries: { ...attempt.retries, [question.id]: (attempt.retries[question.id] ?? 0) + 1 }, updatedAt: at };
}

export function selectAcademicRemediation(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, methodId: RemediationMethodId, at = Date.now()): AcademicQuizAttempt {
  const question = definition.questions[attempt.currentQuestionIndex];
  const remediation = question ? attempt.remediations?.[question.id] : undefined;
  if (!question || !remediation) return attempt;
  return {
    ...attempt,
    remediations: {
      ...(attempt.remediations ?? {}),
      [question.id]: { ...remediation, selectedMethod: methodId, selectedAt: at },
    },
    updatedAt: at,
  };
}

export function closeAcademicRemediation(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, at = Date.now()): AcademicQuizAttempt {
  const question = definition.questions[attempt.currentQuestionIndex];
  const remediation = question ? attempt.remediations?.[question.id] : undefined;
  if (!question || !remediation?.selectedMethod) return attempt;
  const feedback = { ...attempt.feedback };
  delete feedback[question.id];
  return {
    ...attempt,
    feedback,
    responses: { ...attempt.responses, [question.id]: "" },
    retries: { ...attempt.retries, [question.id]: (attempt.retries[question.id] ?? 0) + 1 },
    remediations: {
      ...(attempt.remediations ?? {}),
      [question.id]: { ...remediation, supportClosedAt: at, postRemediationResult: "PENDING" },
    },
    retrievalQuestionIds: [...new Set([...(attempt.retrievalQuestionIds ?? []), question.id])],
    updatedAt: at,
  };
}

export function revealAcademicHint(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, at = Date.now()): AcademicQuizAttempt {
  const question = definition.questions[attempt.currentQuestionIndex];
  if (!question) return attempt;
  return { ...attempt, hintsUsed: { ...attempt.hintsUsed, [question.id]: 1 }, updatedAt: at };
}

export function continueAcademicQuiz(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition, at = Date.now()): AcademicQuizAttempt {
  const question = definition.questions[attempt.currentQuestionIndex];
  if (!question || !attempt.feedback[question.id]?.correct) return attempt;
  const completedQuestionIds = [...new Set([...attempt.completedQuestionIds, question.id])];
  if (attempt.currentQuestionIndex === definition.questions.length - 1) return { ...attempt, status: "COMPLETED", completedQuestionIds, completedAt: at, updatedAt: at };
  return { ...attempt, currentQuestionIndex: attempt.currentQuestionIndex + 1, completedQuestionIds, updatedAt: at };
}

export function pauseAcademicQuiz(attempt: AcademicQuizAttempt, at = Date.now()): AcademicQuizAttempt {
  return attempt.status === "IN_PROGRESS" ? { ...attempt, status: "PAUSED", updatedAt: at } : attempt;
}

export function resumeAcademicQuiz(attempt: AcademicQuizAttempt, at = Date.now()): AcademicQuizAttempt {
  return attempt.status === "PAUSED" ? { ...attempt, status: "IN_PROGRESS", updatedAt: at } : attempt;
}

export function academicQuizOutcome(attempt: AcademicQuizAttempt, definition: AcademicQuizDefinition) {
  const completed = attempt.status === "COMPLETED" && definition.questions.every((question) => attempt.completedQuestionIds.includes(question.id));
  return { completed, maxState: completed ? "PRACTICED" as const : attempt.startedAt ? "INTRODUCED" as const : "NOT_SEEN" as const };
}

export function nextAcademicDifficulty(attempt: AcademicQuizAttempt) {
  const hints = Object.values(attempt.hintsUsed).reduce((sum, value) => sum + value, 0);
  const retries = Object.values(attempt.retries).reduce((sum, value) => sum + value, 0);
  return hints === 0 && retries <= 1 ? "INCREASE" as const : hints + retries >= 4 ? "REINFORCE" as const : "MAINTAIN" as const;
}
