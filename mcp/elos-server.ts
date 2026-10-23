// ELOS MCP server (stdio): exposes Engineer Learning OS study tools to a local
// agent such as Hermes. Everything runs on this machine; no network access.
//
// Privacy: tool results are sent by the calling agent to ITS model provider.
// Course files are therefore read only from ELOS_SOURCES_DIR, which must be set
// explicitly; without it the server uses the synthetic demo documents.
// knowledge-private/, secret files and paths outside the root are refused.
//
// Run: node --experimental-strip-types --import ./tests/register-loader.mjs mcp/elos-server.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { answerFromSources, deriveFlashcards, deriveQuiz, revisionSheet, socraticPrompt } from "../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS } from "../src/modules/learning-studio/fixtures.ts";
import { buildImportedDocument, textToSections, type RawPage } from "../src/modules/learning-studio/import.ts";
import { buildAudioOverview } from "../src/modules/learning-studio/overview.ts";
import { derivePrerequisites, remediationPath } from "../src/modules/learning-studio/prerequisites.ts";
import type { StudioDocument } from "../src/modules/learning-studio/types.ts";
import { analyzeProduction } from "../src/modules/daily-english/local-mission.ts";
import { ROLEPLAY_SCENARIOS, evaluateTurn } from "../src/modules/daily-english/roleplay.ts";
import { VOCABULARY, VOCABULARY_PACKS } from "../src/modules/daily-english/vocabulary.ts";
import { replaySchedulers, type ReviewEvent } from "../src/modules/scientific-pedagogy/replay.ts";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const FORBIDDEN = /(^|[\\/])(knowledge-private|\.git|node_modules)([\\/]|$)|\.(secret|private|env)$|(^|[\\/])\.env/i;

export function sourcesRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const root = env.ELOS_SOURCES_DIR?.trim();
  return root ? path.resolve(root) : null;
}

/** Resolves a path inside the allowed root, refusing traversal and private locations. */
export function allowedPath(root: string, candidate: string): string {
  const resolved = path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error("PATH_OUTSIDE_SOURCES_DIR");
  if (FORBIDDEN.test(path.relative(root, resolved))) throw new Error("PATH_FORBIDDEN");
  return resolved;
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (out.length >= MAX_FILES) return;
      const full = path.join(dir, name);
      if (FORBIDDEN.test(path.relative(root, full)) || name.startsWith(".")) continue;
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (/\.(pdf|md|markdown|txt)$/i.test(name) && info.size <= MAX_FILE_BYTES) out.push(full);
    }
  };
  walk(root);
  return out;
}

async function pdfPages(file: string): Promise<RawPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages: RawPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      let text = "";
      for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      pages.push({ pageNumber, text });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** Loads the learner's course files (or the synthetic demo documents when no root is configured). */
export async function loadSources(root: string | null): Promise<StudioDocument[]> {
  if (!root) return [...SYNTHETIC_DOCUMENTS];
  const documents: StudioDocument[] = [];
  for (const file of listFiles(root)) {
    const relative = path.relative(root, file);
    const metadata = { title: relative, subjectLabel: path.dirname(relative) === "." ? "Mes cours" : path.dirname(relative), chapter: "", docType: "COURS" as const };
    try {
      const pdf = /\.pdf$/i.test(file);
      const pages = pdf ? await pdfPages(file) : textToSections(readFileSync(file, "utf8"));
      documents.push(buildImportedDocument(`file:${relative}`, metadata, pages, pdf ? "page" : "section", new Date(statSync(file).mtimeMs)));
    } catch {
      // Unreadable or scanned file: skipped (no OCR in the agent server, nothing invented).
    }
  }
  return documents;
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const cite = (documents: readonly StudioDocument[], citation: { documentId: string; pageNumber: number; quote: string }) => {
  const document = documents.find((item) => item.id === citation.documentId);
  return { source: document?.title ?? citation.documentId, [document?.unit === "section" ? "section" : "page"]: citation.pageNumber, quote: citation.quote };
};

export function createServer(env: NodeJS.ProcessEnv = process.env): McpServer {
  const root = sourcesRoot(env);
  const server = new McpServer({ name: "elos", version: "0.3.0" });
  const sourceNote = root ? `Sources: course files under ELOS_SOURCES_DIR (${path.basename(root)}).` : "Sources: synthetic demo documents (ELOS_SOURCES_DIR not set).";
  const privacy = "Passages returned here are sent by the agent to its model provider.";

  server.registerTool("elos_ask_sources", {
    title: "Ask the course sources",
    description: `Answer a question ONLY with sentences quoted from the learner's course sources, with page/section citations; says so when the sources do not contain the answer. mode "socratic" returns a guiding question and graduated hints instead of the answer. ${sourceNote} ${privacy}`,
    inputSchema: { question: z.string().min(2), mode: z.enum(["sourced", "socratic"]).default("sourced") },
  }, async ({ question, mode }) => {
    const documents = await loadSources(root);
    if (mode === "socratic") {
      const prompt = socraticPrompt(documents, question);
      return json(prompt ? { question: prompt.question, hints: prompt.hints.map((hint) => hint.text), citations: prompt.citations.map((c) => cite(documents, c)) }
        : { answer: "Not found in the sources." });
    }
    const answer = answerFromSources(documents, question);
    return json({ answer: answer.answer, grounded: answer.citations.length > 0, uncertainty: answer.uncertainty, citations: answer.studioCitations.map((c) => cite(documents, c)) });
  });

  server.registerTool("elos_study_pack", {
    title: "Build study material from the sources",
    description: `Derive study material from the course sources: flashcards, quiz, revision sheet, audio overview script or prerequisite paths. Every item is cited and DERIVED (never counts as mastery). ${sourceNote} ${privacy}`,
    inputSchema: { kind: z.enum(["flashcards", "quiz", "sheet", "audio_overview", "prerequisites"]), limit: z.number().int().min(1).max(50).default(10) },
  }, async ({ kind, limit }) => {
    const documents = await loadSources(root);
    const cards = deriveFlashcards(documents);
    if (kind === "flashcards") return json(cards.slice(0, limit).map((card) => ({ front: card.term, back: card.definition, citation: cite(documents, card.citations[0]) })));
    if (kind === "quiz") return json(deriveQuiz(documents, limit).map((q) => ({ prompt: q.prompt, choices: q.choices, answer: q.answer, citation: cite(documents, q.citations[0]) })));
    if (kind === "sheet") return json(revisionSheet(documents).slice(0, limit).map((entry) => ({ term: entry.term, definition: entry.definition, citation: cite(documents, entry.citations[0]) })));
    if (kind === "audio_overview") return json(buildAudioOverview(documents).segments.map((segment) => ({ kind: segment.kind, text: segment.text, pauseAfterMs: segment.pauseAfterMs })));
    const relations = derivePrerequisites(cards);
    return json(cards.map((card) => remediationPath(card.term, cards, relations))
      .filter((pathItem) => pathItem.prerequisites.length || pathItem.confusedWith.length).slice(0, limit)
      .map((pathItem) => ({ notion: pathItem.term, reviewFirst: pathItem.prerequisites.map((step) => step.term), confusedWith: pathItem.confusedWith })));
  });

  server.registerTool("elos_correct_english", {
    title: "Correct English (local rules)",
    description: "Correct frequent French-speaker errors in an English text with deterministic local rules; explanations in French. Optionally checks which target words were used.",
    inputSchema: { text: z.string().min(1).max(5000), target_words: z.array(z.string()).max(50).default([]) },
  }, async ({ text, target_words }) => {
    const result = analyzeProduction(text, target_words.map((word) => ({ id: word, word })));
    return json({ corrected: result.correctedText, errors: result.feedback.errors, targetWordsUsed: result.usedWordIds, targetWordsMissing: result.missingWords });
  });

  server.registerTool("elos_roleplay", {
    title: "Oral roleplay scenarios",
    description: "Hand-written professional English roleplays (stand-up, incident report, apprenticeship interview). Without arguments: list scenarios. With scenario_id and turn: the interlocutor line and task. With answer: local evaluation (communicative goals, vocabulary, corrections).",
    inputSchema: { scenario_id: z.string().optional(), turn: z.number().int().min(1).default(1), answer: z.string().max(3000).optional() },
  }, async ({ scenario_id, turn, answer }) => {
    if (!scenario_id) return json(ROLEPLAY_SCENARIOS.map((s) => ({ id: s.id, title: s.title, level: s.level, context: s.context, turns: s.turns.length })));
    const scenario = ROLEPLAY_SCENARIOS.find((s) => s.id === scenario_id);
    const step = scenario?.turns[turn - 1];
    if (!scenario || !step) return json({ error: "Unknown scenario or turn." });
    if (!answer) return json({ interlocutor: step.interlocutor, task: step.task, suggestedVocabulary: step.vocabulary, turnsTotal: scenario.turns.length });
    const feedback = evaluateTurn(step, answer);
    return json({ score: feedback.score, goals: feedback.goals, vocabularyUsed: feedback.vocabularyUsed, corrections: feedback.corrections, corrected: feedback.correctedText, modelAnswer: step.modelAnswer });
  });

  server.registerTool("elos_vocabulary", {
    title: "Daily English vocabulary",
    description: "Look up the Daily English vocabulary (150 words in 5 packs: core, networking, cybersecurity, meetings, career) with French translation and example sentence.",
    inputSchema: { pack: z.enum(["core", "networking", "cybersecurity", "meetings", "career"]).optional(), word: z.string().optional() },
  }, async ({ pack, word }) => {
    if (word) return json(VOCABULARY.filter((entry) => entry.word.toLowerCase() === word.toLowerCase()));
    if (pack) return json(VOCABULARY.filter((entry) => entry.pack === pack));
    return json(VOCABULARY_PACKS.map((item) => ({ id: item.id, label: item.label, level: item.level, words: item.entries.length })));
  });

  server.registerTool("elos_compare_schedulers", {
    title: "Compare spaced-repetition schedulers",
    description: "Replay review logs (open-spaced-repetition TSV format: review_time, card_id, review_rating) located under ELOS_SOURCES_DIR, comparing FSRS-4.5 with the current ELOS Leitner ladder (log-loss, Brier; lower is better).",
    inputSchema: { files: z.array(z.string()).min(1).max(20) },
  }, async ({ files }) => {
    if (!root) return json({ error: "ELOS_SOURCES_DIR is not set." });
    return json(files.map((file) => {
      const resolved = allowedPath(root, file);
      const [header, ...lines] = readFileSync(resolved, "utf8").trim().split("\n");
      const columns = header.split("\t");
      const [at, card, rating] = ["review_time", "card_id", "review_rating"].map((name) => columns.indexOf(name));
      if (at < 0 || card < 0 || rating < 0) return { file, error: "Unexpected columns." };
      const events: ReviewEvent[] = lines.map((line) => { const c = line.split("\t"); return { itemId: c[card], at: Number(c[at]), success: Number(c[rating]) > 1 }; });
      return { file, ...replaySchedulers(events) };
    }));
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createServer().connect(new StdioServerTransport());
}
