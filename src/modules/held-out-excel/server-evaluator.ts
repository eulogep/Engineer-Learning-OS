import "server-only";
import type { HeldOutExcelAnswers, HeldOutExcelResult } from "./types";

const EXPECTED_DELIMITER = "semicolon";
const EXPECTED_ANOMALY_ID = "HX-206";
const EXPLANATION_CONCEPTS = ["preview", "aperçu"];
const STRUCTURE_CONCEPTS = ["column", "colonne", "field", "champ"];

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr");
}

export function evaluateHeldOutExcel(answers: HeldOutExcelAnswers, evaluatedAt = Date.now()): HeldOutExcelResult {
  const explanation = normalized(answers.explanation);
  const delimiterValid = normalized(answers.delimiter) === EXPECTED_DELIMITER;
  const anomalyValid = normalized(answers.anomalyId) === normalized(EXPECTED_ANOMALY_ID);
  const explanationValid = answers.explanation.trim().length >= 35
    && EXPLANATION_CONCEPTS.some((concept) => explanation.includes(concept))
    && STRUCTURE_CONCEPTS.some((concept) => explanation.includes(concept));
  return { passed: delimiterValid && anomalyValid && explanationValid, delimiterValid, anomalyValid, explanationValid, evaluatedAt };
}
