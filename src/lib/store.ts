import { create } from "zustand";
import type {
  Word,
  DailyMission,
  MissionStep,
  SpeakingSession,
  ParsedFeedback,
} from "@/types";

interface MissionState {
  // Data
  words: Word[];
  mission: DailyMission | null;
  personalSentences: Record<string, string>; // wordId → sentence

  // Speaking
  transcription: string | null;
  correctedText: string | null;
  feedback: ParsedFeedback | null;
  speakingSession: SpeakingSession | null;
  isRecording: boolean;
  recordingDuration: number;

  // UI state
  currentStep: MissionStep;
  isLoading: boolean;
  error: string | null;

  // Actions
  setWords: (words: Word[]) => void;
  setMission: (mission: DailyMission) => void;
  setPersonalSentence: (wordId: string, sentence: string) => void;
  setStep: (step: MissionStep) => void;
  setTranscription: (text: string | null) => void;
  setCorrectedText: (text: string | null) => void;
  setFeedback: (feedback: ParsedFeedback | null) => void;
  setSpeakingSession: (session: SpeakingSession | null) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  words: [],
  mission: null,
  personalSentences: {},
  transcription: null,
  correctedText: null,
  feedback: null,
  speakingSession: null,
  isRecording: false,
  recordingDuration: 0,
  currentStep: "words" as MissionStep,
  isLoading: false,
  error: null,
};

export const useMissionStore = create<MissionState>((set) => ({
  ...initialState,

  setWords: (words) => set({ words }),
  setMission: (mission) => set({ mission }),
  setPersonalSentence: (wordId, sentence) =>
    set((state) => ({
      personalSentences: { ...state.personalSentences, [wordId]: sentence },
    })),
  setStep: (step) => set({ currentStep: step }),
  setTranscription: (text) => set({ transcription: text }),
  setCorrectedText: (text) => set({ correctedText: text }),
  setFeedback: (feedback) => set({ feedback }),
  setSpeakingSession: (session) => set({ speakingSession: session }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));