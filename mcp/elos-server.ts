// ELOS MCP server (stdio): exposes Engineer Learning OS study tools to a local
// agent such as Hermes. Everything runs on this machine; no network access.
//
// Privacy: tool results are sent by the calling agent to ITS model provider.
// Course files are therefore read only from ELOS_SOURCES_DIR, which must be set
// explicitly; without it the server uses the synthetic demo documents.
// knowledge-private/, secret files and paths outside the root are refused.
//
// Run: node --experimental-strip-types --import ./tests/register-loader.mjs mcp/elos-server.ts
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { answerFromSources, deriveFlashcards, deriveQuiz, revisionSheet, socraticPrompt } from "../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS } from "../src/modules/learning-studio/fixtures.ts";
import { buildImportedDocument, pagesNeedingOcr, textToSections, type RawPage } from "../src/modules/learning-studio/import.ts";
import { buildAudioOverview } from "../src/modules/learning-studio/overview.ts";
import { derivePrerequisites, remediationPath } from "../src/modules/learning-studio/prerequisites.ts";
import type { StudioDocument } from "../src/modules/learning-studio/types.ts";
import { analyzeProduction } from "../src/modules/daily-english/local-mission.ts";
import { ROLEPLAY_SCENARIOS, evaluateTurn } from "../src/modules/daily-english/roleplay.ts";
import { VOCABULARY, VOCABULARY_PACKS } from "../src/modules/daily-english/vocabulary.ts";
import { replaySchedulers, type ReviewEvent } from "../src/modules/scientific-pedagogy/replay.ts";
import { parseLearnerSnapshot, type LearnerSnapshot } from "../src/modules/learner-snapshot/core.ts";

const MAX_FILES = 1000;
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

export function listFiles(root: string): string[] {
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

// --- On-device OCR for scanned PDFs (macOS Vision via mcp/ocr-vision.swift) -------------------
// Results are cached outside the shared folder (ELOS_CACHE_DIR, default <sources>/../.elos-cache)
// and computed in the background so a first question never waits for a long OCR run.

export function cacheDir(root: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.ELOS_CACHE_DIR?.trim() || path.join(path.dirname(root), ".elos-cache"));
}

let ocrBinary: string | null | undefined;
function ensureOcrBinary(cache: string, env: NodeJS.ProcessEnv): string | null {
  if (ocrBinary !== undefined) return ocrBinary;
  ocrBinary = null;
  if (process.platform !== "darwin" || env.ELOS_OCR === "off") return null;
  const source = path.join(path.dirname(new URL(import.meta.url).pathname), "ocr-vision.swift");
  const hash = createHash("sha256").update(readFileSync(source)).digest("hex").slice(0, 12);
  const binary = path.join(cache, `elos-ocr-${hash}`);
  try {
    if (!existsSync(binary)) { mkdirSync(cache, { recursive: true, mode: 0o700 }); execFileSync("swiftc", ["-O", source, "-o", binary], { stdio: "ignore", timeout: 300_000 }); }
    ocrBinary = binary;
  } catch { ocrBinary = null; }
  return ocrBinary;
}

const run = promisify(execFile);
const ocrQueue: string[] = [];
let ocrRunning = false;

function ocrCacheFile(cache: string, file: string): string {
  return path.join(cache, "ocr", `${createHash("sha256").update(readFileSync(file)).digest("hex")}.json`);
}

export function cachedOcr(cache: string, file: string): RawPage[] | null {
  try { return (JSON.parse(readFileSync(ocrCacheFile(cache, file), "utf8")) as { pages: RawPage[] }).pages; } catch { return null; }
}

/** OCRs one PDF now (used by the background queue and by `npm run mcp:ocr`). */
export async function ocrNow(cache: string, file: string, env: NodeJS.ProcessEnv = process.env): Promise<RawPage[] | null> {
  const existing = cachedOcr(cache, file);
  if (existing) return existing;
  const binary = ensureOcrBinary(cache, env);
  if (!binary) return null;
  const { stdout } = await run(binary, [file], { maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const pages = (JSON.parse(stdout) as { pages: RawPage[] }).pages;
  mkdirSync(path.join(cache, "ocr"), { recursive: true, mode: 0o700 });
  writeFileSync(ocrCacheFile(cache, file), JSON.stringify({ file: path.basename(file), pages }), { mode: 0o600 });
  return pages;
}

function scheduleOcr(cache: string, file: string, env: NodeJS.ProcessEnv): void {
  if (ocrQueue.includes(file)) return;
  ocrQueue.push(file);
  if (ocrRunning) return;
  ocrRunning = true;
  void (async () => {
    while (ocrQueue.length) {
      const next = ocrQueue.shift() as string;
      try { await ocrNow(cache, next, env); extracted.delete(next); } catch { /* unreadable: stays text-only */ }
    }
    ocrRunning = false;
  })();
}

/** Merges OCR text into the pages that have no text layer; flags them as OCR. */
function withOcr(pages: RawPage[], ocr: RawPage[] | null): RawPage[] {
  if (!ocr) return pages;
  const missing = new Set(pagesNeedingOcr(pages));
  return pages.map((page) => (missing.has(page.pageNumber) ? { pageNumber: page.pageNumber, text: ocr.find((item) => item.pageNumber === page.pageNumber)?.text ?? "", ocr: true } : page));
}

/** Extraction cache: a file is parsed again only when its size or modification time changes. */
const extracted = new Map<string, { key: string; document: StudioDocument | null }>();

/**
 * Loads the learner's course files (or the synthetic demo documents when no root is configured).
 * Folder layout: <subject>/<origin or year>/... — the first folder becomes the subject.
 */
export async function loadSources(root: string | null, env: NodeJS.ProcessEnv = process.env): Promise<StudioDocument[]> {
  if (!root) return [...SYNTHETIC_DOCUMENTS];
  const cache = cacheDir(root, env);
  const documents: StudioDocument[] = [];
  const seen = new Set<string>();
  for (const file of listFiles(root)) {
    seen.add(file);
    const info = statSync(file);
    const key = `${info.size}:${info.mtimeMs}`;
    const cached = extracted.get(file);
    if (cached?.key === key) { if (cached.document) documents.push(cached.document); continue; }
    const relative = path.relative(root, file);
    const [subject, origin] = relative.split(path.sep);
    const metadata = { title: relative, subjectLabel: relative.includes(path.sep) ? subject : "Mes cours", chapter: relative.split(path.sep).length > 2 ? origin : "", docType: "COURS" as const };
    let document: StudioDocument | null = null;
    try {
      const pdf = /\.pdf$/i.test(file);
      let pages = pdf ? await pdfPages(file) : textToSections(readFileSync(file, "utf8"));
      if (pdf && pagesNeedingOcr(pages).length > 0) {
        const ocr = cachedOcr(cache, file);
        if (ocr) pages = withOcr(pages, ocr);
        else scheduleOcr(cache, file, env);
      }
      document = buildImportedDocument(`file:${relative}`, metadata, pages, pdf ? "page" : "section", new Date(info.mtimeMs));
    } catch {
      document = null; // unreadable or scanned file: skipped (no OCR in the agent server, nothing invented)
    }
    extracted.set(file, { key, document });
    if (document) documents.push(document);
  }
  for (const file of extracted.keys()) if (!seen.has(file)) extracted.delete(file);
  return documents;
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const cite = (documents: readonly StudioDocument[], citation: { documentId: string; pageNumber: number; quote: string }) => {
  const document = documents.find((item) => item.id === citation.documentId);
  const ocr = document?.pages.find((page) => page.pageNumber === citation.pageNumber)?.ocr === true;
  return { source: document?.title ?? citation.documentId, [document?.unit === "section" ? "section" : "page"]: citation.pageNumber, quote: citation.quote, ...(ocr ? { ocr: "text recognised from a scan: verify against the page" } : {}) };
};

const STALE_MS = 24 * 3_600_000;

/** Reads the learner snapshot written by the app (ELOS_STATE_FILE); read-only, strictly validated. */
export function readSnapshot(env: NodeJS.ProcessEnv): { snapshot: LearnerSnapshot; stale: boolean } | { error: string } {
  const file = env.ELOS_STATE_FILE?.trim();
  if (!file) return { error: "ELOS_STATE_FILE is not set: in the ELOS app, open Données → Agent local (Hermes) and choose the shared folder, then point ELOS_STATE_FILE to elos-state.json." };
  try {
    const snapshot = parseLearnerSnapshot(readFileSync(path.resolve(file), "utf8"));
    return { snapshot, stale: Date.now() - Date.parse(snapshot.generatedAt) > STALE_MS };
  } catch {
    return { error: "The learner snapshot is missing or invalid. Open the ELOS app once so it can write elos-state.json." };
  }
}

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
    const documents = await loadSources(root, env);
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
    const documents = await loadSources(root, env);
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

  const freshness = (stale: boolean, snapshot: LearnerSnapshot) => (stale ? `Snapshot from ${snapshot.generatedAt} (older than 24 h): ask the learner to open ELOS to refresh it.` : null);

  server.registerTool("elos_today", {
    title: "What to study today",
    description: "Read-only view of the learner's day from the ELOS snapshot: today's Daily English words and status, words and course cards due, top difficulties and the closest exam. Suggests an order; never grants mastery.",
    inputSchema: {},
  }, async () => {
    const read = readSnapshot(env);
    if ("error" in read) return json(read);
    const { snapshot, stale } = read;
    const nextExam = snapshot.exams[0] ?? null;
    const plan = [
      snapshot.dailyEnglish.todayMission && !snapshot.dailyEnglish.todayMission.completed ? `Daily English mission (${snapshot.dailyEnglish.todayMission.words.length} words)` : null,
      snapshot.dailyEnglish.dueWords.length ? `Review ${snapshot.dailyEnglish.dueWords.length} English word(s) due` : null,
      snapshot.studio.dueToday.length ? `Review ${snapshot.studio.dueToday.length} course card(s) in the Studio` : null,
      snapshot.studio.difficulties.length ? `Retrieval practice on difficulties: ${snapshot.studio.difficulties.slice(0, 3).map((item) => item.term).join(", ")}` : null,
      nextExam && nextExam.daysLeft <= 14 ? `Mock exam for ${nextExam.course} (in ${nextExam.daysLeft} days)` : null,
    ].filter(Boolean);
    return json({ today: snapshot.today, warning: freshness(stale, snapshot), suggestedOrder: plan, dailyEnglish: snapshot.dailyEnglish.todayMission,
      dueWords: snapshot.dailyEnglish.dueWords, dueCards: snapshot.studio.dueToday, difficulties: snapshot.studio.difficulties, nextExam });
  });

  server.registerTool("elos_progress", {
    title: "Learning progress overview",
    description: "Read-only progress from the ELOS snapshot: Daily English streak and words seen/mastered, Studio workload for the next 7 days, difficulties, scheduler comparison (FSRS vs Leitner) on the learner's own history when enough data exists.",
    inputSchema: {},
  }, async () => {
    const read = readSnapshot(env);
    if ("error" in read) return json(read);
    const { snapshot, stale } = read;
    return json({ generatedAt: snapshot.generatedAt, warning: freshness(stale, snapshot), dailyEnglish: { streak: snapshot.dailyEnglish.streak, wordsSeen: snapshot.dailyEnglish.wordsSeen, wordsMastered: snapshot.dailyEnglish.wordsMastered, totalWords: snapshot.dailyEnglish.totalWords },
      studio: { scheduler: snapshot.studio.scheduler, next7Days: snapshot.studio.next7Days, difficulties: snapshot.studio.difficulties, schedulerReplay: snapshot.studio.schedulerReplay } });
  });

  server.registerTool("elos_exam_plan", {
    title: "Exam countdown and revision plan",
    description: "Upcoming exams from the ELOS snapshot with days left and a spaced revision schedule (review sessions at J-14, J-7, J-3, J-1 when still ahead). Read-only.",
    inputSchema: {},
  }, async () => {
    const read = readSnapshot(env);
    if ("error" in read) return json(read);
    const { snapshot, stale } = read;
    const offsets = [14, 7, 3, 1];
    return json({ warning: freshness(stale, snapshot), exams: snapshot.exams.map((exam) => ({
      ...exam,
      sessions: offsets.filter((offset) => exam.daysLeft >= offset).map((offset) => {
        const day = new Date(Date.parse(`${exam.date}T00:00:00Z`) - offset * 86_400_000).toISOString().slice(0, 10);
        return { day, label: `J-${offset}`, activity: offset === 1 ? "light review + flashcards" : offset === 3 ? "timed mock exam" : "Studio retrieval practice on the course" };
      }),
    })) });
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createServer().connect(new StdioServerTransport());
}
