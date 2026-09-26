export type HeldOutExcelStatus = "READY" | "IN_PROGRESS" | "PAUSED" | "SUBMITTED";

export type HeldOutExcelAnswers = {
  delimiter: string;
  anomalyId: string;
  explanation: string;
};

export type HeldOutExcelResult = {
  passed: boolean;
  delimiterValid: boolean;
  anomalyValid: boolean;
  explanationValid: boolean;
  evaluatedAt: number;
};

export type HeldOutExcelAttempt = HeldOutExcelAnswers & {
  id: string;
  status: HeldOutExcelStatus;
  createdAt: number;
  startedAt: number | null;
  updatedAt: number;
  submittedAt: number | null;
  result: HeldOutExcelResult | null;
};
