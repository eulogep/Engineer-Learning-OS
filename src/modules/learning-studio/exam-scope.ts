import { verifyCitation } from "./core";
import type { StudioCitation, StudioDocument } from "./types";

/** A learner's explicit reading of an exam instruction, not automated teacher verification. */
export type ExamScopeConfirmation = Readonly<{
  subjectId: string;
  instruction: StudioCitation;
  passages: readonly StudioCitation[];
  confirmedAt: string;
  confirmation: "LEARNER_ATTESTED_FROM_SOURCE";
}>;

function exactReference(documents: readonly StudioDocument[], citation: StudioCitation, subjectId: string): boolean {
  const document = documents.find((item) => item.id === citation.documentId);
  const text = document?.pages.find((page) => page.pageNumber === citation.pageNumber)?.passages.find((passage) => passage.id === citation.passageId)?.text;
  return !!document && document.subjectId === subjectId && citation.documentVersion === document.version
    && document.academicSource?.status !== "PROGRAM_ONLY" && document.academicSource?.status !== "UNVERIFIED"
    && !!document.provenance && citation.sourceSha256 === document.provenance.sha256
    && citation.quote === text
    && verifyCitation(documents, citation);
}

/** Fail closed: no whole-document fallback or lexical expansion beyond the selected passages. */
export function documentsForExamScope(documents: readonly StudioDocument[], scope: ExamScopeConfirmation): readonly StudioDocument[] {
  if (scope.confirmation !== "LEARNER_ATTESTED_FROM_SOURCE" || !Number.isFinite(Date.parse(scope.confirmedAt))
    || !scope.subjectId || !scope.passages.length || !exactReference(documents, scope.instruction, scope.subjectId)
    || scope.passages.some((citation) => !exactReference(documents, citation, scope.subjectId))) throw new Error("INVALID_EXAM_SCOPE");
  const key = (citation: Pick<StudioCitation, "documentId" | "pageNumber" | "passageId">) => JSON.stringify([citation.documentId, citation.pageNumber, citation.passageId]);
  const allowed = new Set(scope.passages.map(key));
  return documents.filter((document) => document.subjectId === scope.subjectId).flatMap((document) => {
    if (document.academicSource?.status === "PROGRAM_ONLY" || document.academicSource?.status === "UNVERIFIED") {
      if (scope.passages.some((citation) => citation.documentId === document.id)) throw new Error("UNCONFIRMED_COURSE_SOURCE");
      return [];
    }
    const pages = document.pages.map((page) => ({ ...page, passages: page.passages.filter((passage) => allowed.has(key({ documentId: document.id, pageNumber: page.pageNumber, passageId: passage.id }))) }))
      .filter((page) => page.passages.length > 0);
    return pages.length ? [{ ...document, pages }] : [];
  });
}
