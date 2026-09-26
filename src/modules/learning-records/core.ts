import type { MissionAttempt, MissionDefinition } from "../mission-runtime/types";
import type { CompetencyId, CompetencyRecord, CompetencyStatus, EvidenceRecord } from "./types";

const rank: Record<CompetencyStatus, number> = { NOT_SEEN: 0, INTRODUCED: 1, FRAGILE: 2, PRACTICED: 3, DEMONSTRATED: 4, RETAINED: 5 };
const rationale: Record<CompetencyStatus, string> = {
  NOT_SEEN: "Aucune preuve significative.",
  INTRODUCED: "Notion rencontrée sans performance autonome réussie.",
  FRAGILE: "Performance incomplète, irrégulière ou fortement assistée.",
  PRACTICED: "Pratiquée lors de ta mission Excel CSV Foundations.",
  DEMONSTRATED: "Compétence réalisée avec un soutien réduit ou dans un contexte indépendant.",
  RETAINED: "Compétence démontrée de nouveau après un délai significatif.",
};

function practicedRationale(competencyId: CompetencyId) {
  if (competencyId === "DAILY_ENGLISH_GUIDED_PRACTICE") return "Pratiquée lors d’une mission quotidienne guidée avec production orale.";
  if (competencyId === "TECHNICAL_ENGLISH_EXPLANATION") return "Pratiquée lors d’une explication technique guidée en anglais.";
  if (["DATA_ANOMALY_IDENTIFICATION", "FACT_VS_ASSUMPTION", "PROFESSIONAL_STATUS_UPDATE", "ACTIONABLE_NEXT_STEP"].includes(competencyId)) {
    return "Pratiquée dans un scénario professionnel guidé avec preuve locale.";
  }
  if (["NETWORK_FUNDAMENTALS", "OSI_TCP_IP_REASONING"].includes(competencyId)) return "Pratiquée dans une activité académique guidée reliée à une section de cours locale.";
  return rationale.PRACTICED;
}

export interface EvidenceRepository {
  list(): EvidenceRecord[];
  upsert(records: EvidenceRecord[]): void;
  remove(id: string): void;
}

export interface CompetencyRepository {
  list(): CompetencyRecord[];
  replace(records: CompetencyRecord[]): void;
}

function count(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

function common(attempt: MissionAttempt, mission: MissionDefinition) {
  const metadata = attempt.evidence["submit-evidence"];
  const selfEvaluationValue = Number(attempt.responses["self-evaluation"]);
  return {
    attemptId: attempt.id,
    missionId: mission.id,
    missionVersion: mission.version,
    competencyIds: ["EXCEL_CSV_IMPORT" as const],
    artifactReference: metadata ? { ...metadata, verificationStatus: "UNVERIFIED" as const } : null,
    learnerResponses: { ...attempt.responses },
    assistance: { hintCount: count(attempt.hintsUsed), retryCount: attempt.events.filter((event) => event.type === "RETRY").length },
    selfEvaluation: Number.isInteger(selfEvaluationValue) && selfEvaluationValue >= 1 && selfEvaluationValue <= 5 ? selfEvaluationValue : null,
    sourceClassification: "PERSONAL" as const,
  };
}

export function evidenceFromExcelAttempt(attempt: MissionAttempt, mission: MissionDefinition): EvidenceRecord[] {
  if (mission.competency !== "EXCEL_CSV_IMPORT" || attempt.startedAt === null) return [];
  const delimiterValid = attempt.feedback["check-columns"]?.correct === true;
  const anomalyValid = attempt.feedback["find-anomaly"]?.correct === true;
  const hasFailure = Object.values(attempt.feedback).some((feedback) => !feedback.correct);
  const records: EvidenceRecord[] = [{
    ...common(attempt, mission),
    id: `${attempt.id}:MISSION_ATTEMPT`,
    createdAt: attempt.startedAt,
    evidenceType: "MISSION_ATTEMPT",
    evaluationResult: {
      outcome: hasFailure ? "INCOMPLETE" : "ENCOUNTERED",
      delimiterDiagnostic: delimiterValid ? "VALID" : "PENDING",
      anomalyIdentification: anomalyValid ? "VALID" : "PENDING",
      missionCompletion: "PENDING",
    },
    verificationStatus: "VALID",
  }];
  if (attempt.status === "COMPLETED" && attempt.completedAt !== null) {
    records.push({
      ...common(attempt, mission),
      id: `${attempt.id}:MISSION_COMPLETION`,
      createdAt: attempt.completedAt,
      evidenceType: "MISSION_COMPLETION",
      evaluationResult: {
        outcome: "SUCCESSFUL_GUIDED",
        delimiterDiagnostic: delimiterValid ? "VALID" : "INVALID",
        anomalyIdentification: anomalyValid ? "VALID" : "INVALID",
        missionCompletion: "VALID",
      },
      verificationStatus: delimiterValid && anomalyValid ? "VALID" : "INVALID",
    });
  }
  return records;
}

function supportedStatus(evidence: EvidenceRecord): CompetencyStatus {
  if (evidence.verificationStatus === "INVALID") return "NOT_SEEN";
  if (evidence.evaluationResult.outcome === "SUCCESSFUL_TRANSFER") return "DEMONSTRATED";
  if (evidence.evaluationResult.outcome === "SUCCESSFUL_GUIDED") return "PRACTICED";
  if (evidence.evaluationResult.outcome === "REVIEW_SUCCESS") return "PRACTICED";
  if (evidence.evaluationResult.outcome === "REVIEW_FAILURE") return "FRAGILE";
  if (evidence.evaluationResult.outcome === "INCOMPLETE") return "FRAGILE";
  return "INTRODUCED";
}

export function deriveCompetencyRecord(competencyId: CompetencyId, records: EvidenceRecord[]): CompetencyRecord {
  const valid = records.filter((record) => record.competencyIds.includes(competencyId) && record.verificationStatus !== "INVALID").sort((left, right) => left.createdAt - right.createdAt);
  if (valid.length === 0) return { competencyId, status: "NOT_SEEN", updatedAt: null, supportingEvidenceIds: [], latestEvidenceId: null, confidence: "NONE", rationale: rationale.NOT_SEEN };
  const status = valid.reduce<CompetencyStatus>((strongest, record) => rank[supportedStatus(record)] > rank[strongest] ? supportedStatus(record) : strongest, "NOT_SEEN");
  const latest = valid.at(-1)!;
  return {
    competencyId,
    status,
    updatedAt: latest.createdAt,
    supportingEvidenceIds: valid.filter((record) => supportedStatus(record) === status).map((record) => record.id),
    latestEvidenceId: latest.id,
    confidence: status === "DEMONSTRATED" ? "HIGH" : status === "PRACTICED" ? "MEDIUM" : "LOW",
    rationale: status === "PRACTICED" ? practicedRationale(competencyId) : rationale[status],
  };
}

export function competencyIsTraceable(record: CompetencyRecord, evidence: EvidenceRecord[]) {
  if (record.status === "NOT_SEEN") return true;
  const ids = new Set(evidence.map((item) => item.id));
  return record.supportingEvidenceIds.length > 0 && record.supportingEvidenceIds.every((id) => ids.has(id));
}

export function upsertEvidence(existing: EvidenceRecord[], incoming: EvidenceRecord[]) {
  const byId = new Map(existing.map((record) => [record.id, record]));
  incoming.forEach((record) => byId.set(record.id, record));
  return [...byId.values()].sort((left, right) => left.createdAt - right.createdAt);
}

export function reconcileExcelAttempt(existing: EvidenceRecord[], attempt: MissionAttempt, mission: MissionDefinition) {
  const evidence = upsertEvidence(existing, evidenceFromExcelAttempt(attempt, mission));
  return { evidence, competency: deriveCompetencyRecord("EXCEL_CSV_IMPORT", evidence) };
}

export function rebuildCompetencies(evidence: EvidenceRecord[], competencyIds: CompetencyId[] = [
  "DAILY_ENGLISH_GUIDED_PRACTICE",
  "EXCEL_CSV_IMPORT",
  "TECHNICAL_ENGLISH_EXPLANATION",
  "DATA_ANOMALY_IDENTIFICATION",
  "FACT_VS_ASSUMPTION",
  "PROFESSIONAL_STATUS_UPDATE",
  "ACTIONABLE_NEXT_STEP",
  "NETWORK_FUNDAMENTALS",
  "OSI_TCP_IP_REASONING",
]) {
  return competencyIds.map((competencyId) => deriveCompetencyRecord(competencyId, evidence));
}
