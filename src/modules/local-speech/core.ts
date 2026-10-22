/**
 * On-device speech recognition (Whisper running in the browser).
 *
 * Privacy contract: audio never leaves the device. The only network access is the
 * one-time download of the open-source model weights from Hugging Face, and only
 * after the learner explicitly enables the feature (AGENTS.md: no external service
 * without explicit consent).
 */

export const LOCAL_ASR_MODEL_ID = "Xenova/whisper-base.en";
export const LOCAL_ASR_MODEL_SIZE_LABEL = "≈ 80 Mo";
export const LOCAL_ASR_CONSENT_KEY = "engineer-learning-os:local-asr:v1";
export const WHISPER_SAMPLE_RATE = 16_000;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLocalAsrConsent(storage: KeyValueStorage | null): boolean {
  try {
    return storage?.getItem(LOCAL_ASR_CONSENT_KEY) === "ENABLED";
  } catch {
    return false;
  }
}

export function writeLocalAsrConsent(storage: KeyValueStorage | null, enabled: boolean): void {
  try {
    if (enabled) storage?.setItem(LOCAL_ASR_CONSENT_KEY, "ENABLED");
    else storage?.removeItem(LOCAL_ASR_CONSENT_KEY);
  } catch {
    // Blocked storage: consent simply lasts for this visit.
  }
}

/** Removes Whisper's non-speech markers ([BLANK_AUDIO], (music)…) and normalises spacing. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Mixes the channels down to mono and linearly resamples to 16 kHz, the rate Whisper expects. */
export function toWhisperInput(channels: readonly Float32Array[], sampleRate: number): Float32Array {
  if (channels.length === 0 || channels[0].length === 0) return new Float32Array(0);
  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i += 1) mono[i] += channel[i] / channels.length;
  if (sampleRate === WHISPER_SAMPLE_RATE) return mono;

  const ratio = sampleRate / WHISPER_SAMPLE_RATE;
  const out = new Float32Array(Math.floor(length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, length - 1);
    const weight = position - left;
    out[i] = mono[left] * (1 - weight) + mono[right] * weight;
  }
  return out;
}

export type FileProgress = Readonly<{ file: string; loaded: number; total: number }>;

/** Overall download percentage across the model files (null until sizes are known). */
export function downloadPercent(files: readonly FileProgress[]): number | null {
  const total = files.reduce((sum, file) => sum + (file.total > 0 ? file.total : 0), 0);
  if (total === 0) return null;
  const loaded = files.reduce((sum, file) => sum + Math.min(file.loaded, file.total > 0 ? file.total : 0), 0);
  return Math.round((loaded / total) * 100);
}

export type ReadingWord = Readonly<{ word: string; heard: boolean }>;
export type ReadingComparison = Readonly<{ words: readonly ReadingWord[]; matched: number; total: number; score: number; missed: readonly string[] }>;

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[’`]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

/** Longest-common-subsequence alignment: true for each expected token matched in order in `heard`. */
function einsteinAlignment(expected: readonly string[], heard: readonly string[]): boolean[] {
  const table = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1));
  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = heard.length - 1; j >= 0; j -= 1) {
      table[i][j] = expected[i] && expected[i] === heard[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const matched = new Array<boolean>(expected.length).fill(false);
  for (let i = 0, j = 0; i < expected.length && j < heard.length;) {
    if (expected[i] && expected[i] === heard[j]) { matched[i] = true; i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return matched;
}

/**
 * Word-level comparison of the text the learner had to read and what Whisper heard
 * (longest common subsequence, so one skipped word does not shift everything after it).
 */
export function compareReading(expected: string, heard: string): ReadingComparison {
  const displayWords = expected.split(/\s+/).filter(Boolean);
  const expectedTokens = displayWords.map((word) => tokens(word).join(""));
  const heardTokens = tokens(heard);

  const heardFlags = einsteinAlignment(expectedTokens, heardTokens);

  // Punctuation-only "words" do not count either way.
  const counted = expectedTokens.map((token) => token.length > 0);
  const total = counted.filter(Boolean).length;
  const matched = heardFlags.filter((flag, i) => flag && counted[i]).length;
  const words = displayWords.map((word, i) => ({ word, heard: !counted[i] || heardFlags[i] }));
  return {
    words,
    matched,
    total,
    score: total === 0 ? 0 : Math.round((matched / total) * 100),
    missed: words.filter((word, i) => counted[i] && !word.heard).map((word) => word.word.replace(/[^\p{L}\p{N}'’-]/gu, "")),
  };
}
