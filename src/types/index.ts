// ============================================
// Daily English Mission — Core TypeScript Types
// ============================================

/** Word status lifecycle */
export type WordStatus = "nouveau" | "actif" | "maitrise";

/** A vocabulary word with personal context */
export interface Word {
  id: string;
  word: string;
  translation: string;
  category: string;
  personalSentence: string | null;
  mentalImage: string | null;
  emotion: string | null;
  status: WordStatus;
  nextReviewDate: Date | string | null;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
}

/** A single speaking session (recording + transcription + correction) */
export interface SpeakingSession {
  id: string;
  date: Date | string;
  audioUrl: string | null;
  transcription: string | null;
  correctedText: string | null;
  feedback: string | null; // JSON string: { errors: [{ original, corrected, explanation }] }
  repeated: boolean;
  durationSeconds: number | null;
  repeatDurationSeconds: number | null;
  wordsUsedJson: string | null; // JSON array of word IDs
  createdAt: Date | string;
}

/** The daily mission tying words + sentences + speaking session together */
export interface DailyMission {
  id: string;
  date: Date | string;
  wordIdsJson: string; // JSON array of word IDs
  personalSentencesJson: string; // JSON object { [wordId]: sentence }
  speakingSessionId: string | null;
  completed: boolean;
  createdAt: Date | string;
}

// ============================================
// Parsed JSON helpers (runtime types)
// ============================================

/** Parsed feedback from LLM */
export interface FeedbackError {
  original: string;
  corrected: string;
  explanation: string;
}

/** Parsed feedback structure */
export interface ParsedFeedback {
  errors: FeedbackError[];
}

// ============================================
// API request/response types
// ============================================

export interface DailyWordsResponse {
  words: Word[];
  mission: DailyMission | null;
}

export interface TranscriptionRequest {
  audioBlob?: string; // base64 audio data
  missionId: string;
}

export interface CorrectionRequest {
  transcription: string;
  wordsUsed: string[]; // word IDs
}

export interface CorrectionResponse {
  correctedText: string;
  feedback: ParsedFeedback;
}

export interface RepeatSessionRequest {
  sessionId: string;
  audioBlob?: string; // base64 audio data for repeated version
}

// ============================================
// Daily mission step tracker
// ============================================

export type MissionStep =
  | "words"       // Step 1: See 10 words
  | "sentences"   // Step 2: Write personal sentences
  | "speaking"    // Step 3: Record audio
  | "correction"  // Step 4-6: Review correction + feedback
  | "repeat"      // Step 7: Repeat corrected version
  | "done";       // Session saved, mission complete