import type { EvidenceRecord } from "../learning-records/types";
import type { DailyMission } from "@/types";

/**
 * Maps only the durable completion fact. Personal sentences, vocabulary,
 * transcription, correction, feedback, audio and their identifiers stay in
 * the legacy local database and never enter the learning-record shadow.
 */
export function dailyEnglishEvidenceFromMission(mission: DailyMission | null): EvidenceRecord | null {
  if (!mission?.completed || !mission.speakingSessionId) return null;
  const createdAt = new Date(mission.date).getTime();
  if (!Number.isFinite(createdAt)) return null;
  return {
    id: `${mission.id}:DAILY_ENGLISH_COMPLETION`,
    attemptId: mission.speakingSessionId,
    missionId: "daily-english-guided-v1",
    missionVersion: 1,
    competencyIds: ["DAILY_ENGLISH_GUIDED_PRACTICE"],
    createdAt,
    evidenceType: "MISSION_COMPLETION",
    artifactReference: null,
    learnerResponses: {},
    evaluationResult: {
      outcome: "SUCCESSFUL_GUIDED",
      delimiterDiagnostic: "PENDING",
      anomalyIdentification: "PENDING",
      missionCompletion: "VALID",
      independence: "GUIDED",
      assistanceMode: "IN_APP_SCAFFOLD",
    },
    assistance: { hintCount: 0, retryCount: 0 },
    selfEvaluation: null,
    sourceClassification: "PERSONAL",
    verificationStatus: "VALID",
  };
}
