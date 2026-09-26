import type { NotebookLMQuizCandidate } from "./types";

type QuizContext = {
  artifactId: string;
  sourceBundleId: string;
  conceptIds: string[];
};

type RawQuestion = {
  question?: unknown;
  prompt?: unknown;
  choices?: unknown;
  options?: unknown;
  answer?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  sourceRefs?: unknown;
  citations?: unknown;
};

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(normalized).filter(Boolean)
    : [];
}

function parseJsonQuestions(content: string): RawQuestion[] | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is RawQuestion => Boolean(item && typeof item === "object"));
    if (parsed && typeof parsed === "object") {
      const questions = (parsed as { questions?: unknown }).questions;
      if (Array.isArray(questions)) return questions.filter((item): item is RawQuestion => Boolean(item && typeof item === "object"));
    }
  } catch {
    return null;
  }
  return null;
}

function parseTextQuestions(content: string): RawQuestion[] {
  const normalizedContent = content.replace(/\r\n?/g, "\n").trim();
  const markers = [...normalizedContent.matchAll(/(?:^|\n)\s*(?:(?:question|q)\s*)?(\d+)[.): -]+\s*/gi)];
  if (markers.length === 0) return [];
  return markers.map((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? normalizedContent.length;
    const block = normalizedContent.slice(start, end).trim();
    const choices = [...block.matchAll(/^\s*(?:[A-Z]|\d+)[.)]\s+(.+)$/gm)].map((match) => normalized(match[1]));
    const answer = block.match(/^\s*(?:correct answer|answer|réponse correcte|réponse)\s*[:\-]\s*(.+)$/im)?.[1];
    const explanation = block.match(/^\s*(?:explanation|explication)\s*[:\-]\s*(.+)$/im)?.[1];
    const sourceRefs = [...block.matchAll(/^\s*(?:source|citation|page|pages)\s*[:\-]\s*(.+)$/gim)].map((match) => normalized(match[1]));
    const firstStructuralLine = block.search(/^\s*(?:[A-Z]|\d+)[.)]\s+|^\s*(?:correct answer|answer|réponse|explanation|explication|source|citation|page)/im);
    const question = normalized(firstStructuralLine >= 0 ? block.slice(0, firstStructuralLine) : block.split("\n")[0] ?? "");
    return { question, choices, answer, explanation, sourceRefs };
  });
}

function resolveAnswer(rawAnswer: unknown, choices: string[]) {
  if (typeof rawAnswer !== "string" || !normalized(rawAnswer)) return null;
  const answer = normalized(rawAnswer);
  const letter = answer.match(/^([A-Z])(?:[.)]|\s|$)/i)?.[1]?.toUpperCase();
  if (letter) {
    const selected = choices[letter.charCodeAt(0) - 65];
    if (selected) return selected;
  }
  return choices.find((choice) => choice.localeCompare(answer, undefined, { sensitivity: "accent" }) === 0) ?? answer;
}

export function normalizeNotebookLMQuizCandidates(content: string | null | undefined, context: QuizContext) {
  if (!content?.trim()) return { candidates: [] as NotebookLMQuizCandidate[], diagnostics: ["QUIZ_PARSE_FAILED"] };
  const rawQuestions = parseJsonQuestions(content) ?? parseTextQuestions(content);
  if (rawQuestions.length === 0) return { candidates: [] as NotebookLMQuizCandidate[], diagnostics: ["QUIZ_PARSE_FAILED"] };

  const seenQuestions = new Set<string>();
  const candidates = rawQuestions.map((raw, index): NotebookLMQuizCandidate => {
    const question = normalized(typeof raw.question === "string" ? raw.question : typeof raw.prompt === "string" ? raw.prompt : "");
    const choices = stringArray(raw.choices ?? raw.options);
    const answer = resolveAnswer(raw.answer ?? raw.correctAnswer, choices);
    const explanation = typeof raw.explanation === "string" ? normalized(raw.explanation) || null : null;
    const sourceRefs = stringArray(raw.sourceRefs ?? raw.citations);
    const diagnostics: string[] = [];
    const questionKey = question.toLocaleLowerCase();
    if (!question) diagnostics.push("QUESTION_EMPTY");
    if (questionKey && seenQuestions.has(questionKey)) diagnostics.push("DUPLICATE_QUESTION");
    if (questionKey) seenQuestions.add(questionKey);
    if (choices.length > 0 && choices.length < 2) diagnostics.push("INSUFFICIENT_OPTIONS");
    if (new Set(choices.map((choice) => choice.toLocaleLowerCase())).size !== choices.length) diagnostics.push("DUPLICATE_OPTIONS");
    if (!answer) diagnostics.push("ANSWER_MISSING");
    if (choices.length > 0 && answer && !choices.includes(answer)) diagnostics.push("ANSWER_NOT_IN_OPTIONS");
    if (sourceRefs.length === 0) diagnostics.push("SOURCE_SUPPORT_UNVERIFIED");
    return {
      id: "notebooklm-quiz:" + hash(context.artifactId + ":" + (question || index)),
      artifactId: context.artifactId,
      question,
      choices,
      answer,
      explanation,
      sourceRefs,
      sourceBundleId: context.sourceBundleId,
      conceptIds: [...context.conceptIds],
      verificationStatus: "DERIVED_UNVERIFIED",
      sourceSupport: sourceRefs.length > 0 ? "PROVIDER_CITED" : "UNVERIFIED",
      validForActiveQuiz: diagnostics.every((code) => code === "SOURCE_SUPPORT_UNVERIFIED"),
      diagnostics,
    };
  });
  return {
    candidates,
    diagnostics: candidates.flatMap((candidate) => candidate.diagnostics.map((code) => candidate.id + ":" + code)),
  };
}

export function attachNotebookLMQuizCandidates<T extends {
  id: string;
  type: string;
  sourceBundleId: string;
  conceptIds: string[];
  recoveredContent?: string | null;
}>(artifact: T) {
  if (artifact.type !== "QUIZ") return artifact;
  const normalizedQuiz = normalizeNotebookLMQuizCandidates(artifact.recoveredContent, {
    artifactId: artifact.id,
    sourceBundleId: artifact.sourceBundleId,
    conceptIds: artifact.conceptIds,
  });
  return {
    ...artifact,
    quizCandidates: normalizedQuiz.candidates,
    quizDiagnostics: normalizedQuiz.diagnostics,
  };
}
