import type { PathNodeKind } from "./gamification";
import { VOCABULARY, type VocabularyWord } from "./vocabulary";
import { GRAMMAR_TRAPS, type GrammarTrap } from "./studio-content";

/**
 * Deterministic interactive exercise generator for Daily English.
 * Produces gamified micro-exercises directly from the curated
 * engineering vocabulary bank without calling any external service.
 */

export type ExerciseKind =
  | "translate_choice"
  | "word_bank"
  | "match_pairs"
  | "listening_choice"
  | "fill_blank"
  | "type_answer"
  | "spot_error";

export type TranslateChoiceExercise = Readonly<{
  id: string;
  kind: "translate_choice";
  direction: "en_to_fr" | "fr_to_en";
  prompt: string;
  targetWord: string;
  speakText: string;
  category: string;
  example: string;
  choices: readonly string[];
  correctAnswer: string;
}>;

export type WordBankExercise = Readonly<{
  id: string;
  kind: "word_bank";
  prompt: string;
  cueFrench: string;
  targetWord: string;
  speakText: string;
  expectedTokens: readonly string[];
  bankTokens: readonly string[];
  correctSentence: string;
}>;

export type MatchPairItem = Readonly<{
  id: string;
  english: string;
  french: string;
}>;

export type MatchPairsExercise = Readonly<{
  id: string;
  kind: "match_pairs";
  prompt: string;
  pairs: readonly MatchPairItem[];
  shuffledFrench: readonly string[];
}>;

export type ListeningChoiceExercise = Readonly<{
  id: string;
  kind: "listening_choice";
  prompt: string;
  speakText: string;
  translationHint: string;
  example: string;
  choices: readonly string[];
  correctAnswer: string;
}>;

export type FillBlankExercise = Readonly<{
  id: string;
  kind: "fill_blank";
  prompt: string;
  sentenceBefore: string;
  sentenceAfter: string;
  translationHint: string;
  speakText: string;
  choices: readonly string[];
  correctAnswer: string;
}>;

export type TypeAnswerExercise = Readonly<{
  id: string;
  kind: "type_answer";
  prompt: string;
  cueFrench: string;
  category: string;
  speakText: string;
  example: string;
  correctAnswer: string;
  firstLetterHint: string;
}>;

export type SpotErrorExercise = Readonly<{
  id: string;
  kind: "spot_error";
  prompt: string;
  trapTitle: string;
  trapCategory: string;
  wrongSentence: string;
  choices: readonly string[];
  correctAnswer: string;
  explanation: string;
  mnemonic: string;
}>;

export type InteractiveExercise =
  | TranslateChoiceExercise
  | WordBankExercise
  | MatchPairsExercise
  | ListeningChoiceExercise
  | FillBlankExercise
  | TypeAnswerExercise
  | SpotErrorExercise;

/** Simple deterministic PRNG (Mulberry32) so tests & sessions are reproducible. */
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

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tokenizeSentence(sentence: string): string[] {
  return sentence
    .replace(/[.!?]+$/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function pickDistractors(
  target: VocabularyWord,
  pool: readonly VocabularyWord[],
  count: number,
  rand: () => number,
): VocabularyWord[] {
  const sameCategory = pool.filter(
    (item) => item.word.toLowerCase() !== target.word.toLowerCase() && item.category === target.category,
  );
  const others = pool.filter(
    (item) => item.word.toLowerCase() !== target.word.toLowerCase() && item.category !== target.category,
  );
  const combined = [...shuffle(sameCategory, rand), ...shuffle(others, rand)];
  const unique: VocabularyWord[] = [];
  const seen = new Set<string>([target.word.toLowerCase(), target.translation.toLowerCase()]);
  for (const item of combined) {
    const wKey = item.word.toLowerCase();
    const tKey = item.translation.toLowerCase();
    if (seen.has(wKey) || seen.has(tKey)) continue;
    seen.add(wKey);
    seen.add(tKey);
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique;
}

function createTranslateChoice(
  word: VocabularyWord,
  distractorPool: readonly VocabularyWord[],
  direction: "en_to_fr" | "fr_to_en",
  index: number,
  rand: () => number,
): TranslateChoiceExercise {
  const distractors = pickDistractors(word, distractorPool, 3, rand);
  const correctAnswer = direction === "en_to_fr" ? word.translation : word.word;
  const wrongChoices = distractors.map((d) => (direction === "en_to_fr" ? d.translation : d.word));
  return {
    id: `ex-translate-${index}-${word.word.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "translate_choice",
    direction,
    prompt:
      direction === "en_to_fr"
        ? "Choisis la bonne traduction"
        : "Comment dit-on ceci en anglais ?",
    targetWord: direction === "en_to_fr" ? word.word : word.translation,
    speakText: word.word,
    category: word.category,
    example: word.example,
    choices: shuffle([correctAnswer, ...wrongChoices], rand),
    correctAnswer,
  };
}

function createWordBank(
  word: VocabularyWord,
  distractorPool: readonly VocabularyWord[],
  index: number,
  rand: () => number,
): WordBankExercise {
  const expectedTokens = tokenizeSentence(word.example);
  // Add 2 believable English distractor words to raise active recall.
  const distractorWords = pickDistractors(word, distractorPool, 2, rand)
    .map((item) => item.word.split(/\s+/)[0])
    .filter((token) => !expectedTokens.some((existing) => existing.toLowerCase() === token.toLowerCase()));
  const bankTokens = shuffle([...expectedTokens, ...distractorWords], rand);

  return {
    id: `ex-wordbank-${index}-${word.word.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "word_bank",
    prompt: "Reconstruis la phrase en anglais",
    cueFrench: `${word.word} → ${word.translation}`,
    targetWord: word.word,
    speakText: word.example,
    expectedTokens,
    bankTokens,
    correctSentence: expectedTokens.join(" "),
  };
}

export const MATCH_PAIRS_SIZE = 5;

/**
 * Picks up to MATCH_PAIRS_SIZE words whose English terms and French
 * translations are all distinct (duplicates would make a match ambiguous),
 * topping up from the distractor pool when the target words run short.
 */
function uniquePairWords(
  words: readonly VocabularyWord[],
  pool: readonly VocabularyWord[],
  rand: () => number,
): VocabularyWord[] {
  const picked: VocabularyWord[] = [];
  const seenEnglish = new Set<string>();
  const seenFrench = new Set<string>();
  const tryAdd = (item: VocabularyWord) => {
    const en = normalizeAnswer(item.word);
    const fr = normalizeAnswer(item.translation);
    if (seenEnglish.has(en) || seenFrench.has(fr)) return;
    seenEnglish.add(en);
    seenFrench.add(fr);
    picked.push(item);
  };
  for (const item of words) {
    if (picked.length >= MATCH_PAIRS_SIZE) break;
    tryAdd(item);
  }
  if (picked.length < MATCH_PAIRS_SIZE) {
    const sameTrack = new Set(words.map((item) => item.pack));
    const preferred = pool.filter((item) => sameTrack.has(item.pack));
    for (const item of [...shuffle(preferred, rand), ...shuffle(pool, rand)]) {
      if (picked.length >= MATCH_PAIRS_SIZE) break;
      tryAdd(item);
    }
  }
  return picked;
}

function createMatchPairs(
  words: readonly VocabularyWord[],
  pool: readonly VocabularyWord[],
  index: number,
  rand: () => number,
): MatchPairsExercise {
  const slice = uniquePairWords(words, pool, rand);
  const pairs: MatchPairItem[] = slice.map((item, i) => ({
    id: `pair-${index}-${i}`,
    english: item.word,
    french: item.translation,
  }));
  return {
    id: `ex-pairs-${index}`,
    kind: "match_pairs",
    prompt: "Associe chaque mot anglais à sa traduction",
    pairs,
    shuffledFrench: shuffle(pairs.map((p) => p.french), rand),
  };
}

function createListeningChoice(
  word: VocabularyWord,
  distractorPool: readonly VocabularyWord[],
  index: number,
  rand: () => number,
): ListeningChoiceExercise {
  const distractors = pickDistractors(word, distractorPool, 3, rand);
  return {
    id: `ex-listen-${index}-${word.word.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "listening_choice",
    prompt: "Écoute et choisis le mot entendu",
    speakText: word.word,
    translationHint: word.translation,
    example: word.example,
    choices: shuffle([word.word, ...distractors.map((d) => d.word)], rand),
    correctAnswer: word.word,
  };
}

function createFillBlank(
  word: VocabularyWord,
  distractorPool: readonly VocabularyWord[],
  index: number,
  rand: () => number,
): FillBlankExercise | TranslateChoiceExercise {
  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lower = word.word.toLowerCase();
  const stem = lower.endsWith("e") ? lower.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : escaped;
  const regex = new RegExp(`\\b(${escaped}(?:s|es|d|ed)?|${stem}(?:ing|ed|es))\\b`, "i");
  const match = word.example.match(regex);
  if (!match || match.index === undefined) {
    return createTranslateChoice(word, distractorPool, "fr_to_en", index, rand);
  }
  const exactForm = match[1];
  const before = word.example.slice(0, match.index);
  const after = word.example.slice(match.index + exactForm.length);
  const distractors = pickDistractors(word, distractorPool, 3, rand).map((d) => d.word);

  return {
    id: `ex-blank-${index}-${word.word.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "fill_blank",
    prompt: "Complète la phrase avec le bon terme",
    sentenceBefore: before,
    sentenceAfter: after,
    translationHint: word.translation,
    speakText: word.example,
    choices: shuffle([exactForm, ...distractors], rand),
    correctAnswer: exactForm,
  };
}

function createTypeAnswer(
  word: VocabularyWord,
  index: number,
): TypeAnswerExercise {
  const firstChar = word.word.slice(0, 1);
  const masked = word.word
    .split(" ")
    .map((part) => (part.length <= 2 ? part[0] + "•" : `${part[0]}${"•".repeat(part.length - 1)}`))
    .join(" ");
  return {
    id: `ex-type-${index}-${word.word.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "type_answer",
    prompt: "Écris le terme anglais exact",
    cueFrench: word.translation,
    category: word.category,
    speakText: word.word,
    example: word.example,
    correctAnswer: word.word,
    firstLetterHint: `${firstChar.toUpperCase()}… (${masked})`,
  };
}

function createSpotError(
  trap: GrammarTrap,
  index: number,
  rand: () => number,
): SpotErrorExercise {
  return {
    id: `ex-spot-${index}-${trap.id}`,
    kind: "spot_error",
    prompt: "Corrige ce piège francophone fréquent",
    trapTitle: trap.title,
    trapCategory: trap.category,
    wrongSentence: trap.wrongExample,
    choices: shuffle([trap.rightExample, ...trap.distractors], rand),
    correctAnswer: trap.rightExample,
    explanation: trap.explanation,
    mnemonic: trap.mnemonic,
  };
}

/**
 * Generates a dedicated 8-exercise Grammar & French False-Friends drill
 * combining Spot-the-Error challenges and active recall typing.
 */
export function generateGrammarDrillExercises(
  seedKey: string,
  vocabularyPool: readonly VocabularyWord[] = VOCABULARY,
): InteractiveExercise[] {
  const rand = mulberry32(hashSeed(`grammar-drill:${seedKey}`));
  const traps = shuffle(GRAMMAR_TRAPS, rand).slice(0, 6);
  const words = shuffle(vocabularyPool, rand).slice(0, 2);
  const exercises: InteractiveExercise[] = [];
  traps.forEach((trap, idx) => {
    exercises.push(createSpotError(trap, idx, rand));
    if (idx === 2 && words[0]) {
      exercises.push(createTypeAnswer(words[0], 10));
    }
    if (idx === 5 && words[1]) {
      exercises.push(createTypeAnswer(words[1], 11));
    }
  });
  return exercises;
}

/**
 * Generates an interactive 7-to-8-step gamified lesson tailored to the
 * selected path node kind. Pure & deterministic for a given seed.
 */
export function generateLessonExercises(
  targetWords: readonly VocabularyWord[],
  nodeKind: PathNodeKind,
  seedKey: string,
  distractorPool: readonly VocabularyWord[] = VOCABULARY,
): InteractiveExercise[] {
  const source = targetWords.length > 0 ? targetWords : distractorPool.slice(0, 6);
  const rand = mulberry32(hashSeed(`${seedKey}:${nodeKind}`));
  const picked = shuffle(source, rand);
  const at = (i: number) => picked[i % picked.length];
  const randomTrap = shuffle(GRAMMAR_TRAPS, rand)[0];

  const exercises: InteractiveExercise[] = [];

  if (nodeKind === "warmup") {
    exercises.push(
      createTranslateChoice(at(0), distractorPool, "en_to_fr", 0, rand),
      createListeningChoice(at(1), distractorPool, 1, rand),
      createTranslateChoice(at(2), distractorPool, "fr_to_en", 2, rand),
      createMatchPairs(picked, distractorPool, 3, rand),
      createFillBlank(at(3), distractorPool, 4, rand),
      createWordBank(at(4), distractorPool, 5, rand),
      createTranslateChoice(at(5), distractorPool, "en_to_fr", 6, rand),
    );
  } else if (nodeKind === "word_bank") {
    exercises.push(
      createTranslateChoice(at(0), distractorPool, "fr_to_en", 0, rand),
      createWordBank(at(1), distractorPool, 1, rand),
      createFillBlank(at(2), distractorPool, 2, rand),
      createWordBank(at(3), distractorPool, 3, rand),
      createMatchPairs(picked, distractorPool, 4, rand),
      createTypeAnswer(at(4), 5),
      createFillBlank(at(5), distractorPool, 6, rand),
    );
  } else if (nodeKind === "match_pairs") {
    exercises.push(
      createMatchPairs(picked, distractorPool, 0, rand),
      createTranslateChoice(at(0), distractorPool, "en_to_fr", 1, rand),
      createTranslateChoice(at(2), distractorPool, "fr_to_en", 2, rand),
      createMatchPairs(picked.slice(Math.min(3, Math.max(0, picked.length - 5))), distractorPool, 3, rand),
      createFillBlank(at(4), distractorPool, 4, rand),
      createListeningChoice(at(1), distractorPool, 5, rand),
    );
  } else if (nodeKind === "listening") {
    exercises.push(
      createListeningChoice(at(0), distractorPool, 0, rand),
      createListeningChoice(at(1), distractorPool, 1, rand),
      createTypeAnswer(at(2), 2),
      createFillBlank(at(3), distractorPool, 3, rand),
      createListeningChoice(at(4), distractorPool, 4, rand),
      createMatchPairs(picked, distractorPool, 5, rand),
      createWordBank(at(5), distractorPool, 6, rand),
    );
  } else {
    // checkpoint / mixed mastery challenge
    exercises.push(
      createTranslateChoice(at(0), distractorPool, "en_to_fr", 0, rand),
      createListeningChoice(at(1), distractorPool, 1, rand),
      createWordBank(at(2), distractorPool, 2, rand),
      createFillBlank(at(3), distractorPool, 3, rand),
      createMatchPairs(picked, distractorPool, 4, rand),
      createTypeAnswer(at(4), 5),
      createSpotError(randomTrap, 6, rand),
      createFillBlank(at(6), distractorPool, 7, rand),
    );
  }

  return exercises;
}

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

/** Bounded Levenshtein edit distance for gentle typo detection on free-typed answers. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = temp;
    }
  }
  return prev[b.length];
}

/** Evaluates a learner's answer for choice, listening, fill-blank, word-bank, spot-error, or typed exercises. */
export function evaluateExerciseAnswer(
  exercise: InteractiveExercise,
  answer: string | readonly string[],
): { correct: boolean; expected: string; almostCorrect?: boolean } {
  if (exercise.kind === "match_pairs") {
    return { correct: answer === "MATCHED_ALL", expected: "Toutes les paires associées" };
  }
  if (exercise.kind === "word_bank") {
    const joined = Array.isArray(answer) ? answer.join(" ") : String(answer);
    const correct = normalizeAnswer(joined) === normalizeAnswer(exercise.correctSentence);
    return { correct, expected: exercise.correctSentence };
  }
  if (exercise.kind === "type_answer") {
    const given = normalizeAnswer(Array.isArray(answer) ? answer.join(" ") : String(answer));
    const expected = normalizeAnswer(exercise.correctAnswer);
    if (given === expected) {
      return { correct: true, expected: exercise.correctAnswer };
    }
    // Single-character typo on words of 5+ letters is accepted with a friendly spelling reminder.
    if (expected.length >= 5 && editDistance(given, expected) === 1) {
      return { correct: true, expected: exercise.correctAnswer, almostCorrect: true };
    }
    return { correct: false, expected: exercise.correctAnswer };
  }
  const given = Array.isArray(answer) ? answer.join(" ") : String(answer);
  const correct = normalizeAnswer(given) === normalizeAnswer(exercise.correctAnswer);
  return { correct, expected: exercise.correctAnswer };
}
