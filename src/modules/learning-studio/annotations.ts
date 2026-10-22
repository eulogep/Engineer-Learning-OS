import type { StudioDocument } from "./types";

/**
 * Learner annotations on source passages (highlight + note). Personal data:
 * stored on this device only, anchored to document / page / passage and to a
 * snapshot of the passage text so a changed or removed source is detected
 * instead of silently re-attaching the note to other text.
 */

export const ANNOTATIONS_KEY = "engineer-learning-os:learning-studio:annotations:v1";
export const MAX_NOTE_LENGTH = 2000;
const MAX_ANNOTATIONS = 1000;

export type Annotation = Readonly<{
  id: string;
  documentId: string;
  pageNumber: number;
  passageId: string;
  passageText: string;
  note: string;
  createdAt: string;
  classification: "PERSONAL";
}>;

export type AnnotationStatus = "OK" | "SOURCE_CHANGED" | "SOURCE_MISSING";
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function annotationStatus(annotation: Annotation, documents: readonly StudioDocument[]): AnnotationStatus {
  const document = documents.find((item) => item.id === annotation.documentId);
  if (!document) return "SOURCE_MISSING";
  const passage = document.pages.find((page) => page.pageNumber === annotation.pageNumber)?.passages.find((item) => item.id === annotation.passageId);
  if (!passage) return "SOURCE_MISSING";
  return passage.text === annotation.passageText ? "OK" : "SOURCE_CHANGED";
}

export function createAnnotation(
  document: StudioDocument, pageNumber: number, passageId: string, note: string, now: Date, id: string,
): Annotation {
  const passage = document.pages.find((page) => page.pageNumber === pageNumber)?.passages.find((item) => item.id === passageId);
  if (!passage) throw new Error("ANNOTATION_ANCHOR_NOT_FOUND");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("ANNOTATION_EMPTY");
  return {
    id, documentId: document.id, pageNumber, passageId, passageText: passage.text,
    note: trimmed.slice(0, MAX_NOTE_LENGTH), createdAt: now.toISOString(), classification: "PERSONAL",
  };
}

function valid(value: unknown): value is Annotation {
  const item = value as Partial<Annotation> | null;
  return !!item && typeof item.id === "string" && typeof item.documentId === "string" && Number.isInteger(item.pageNumber)
    && typeof item.passageId === "string" && typeof item.passageText === "string" && typeof item.note === "string"
    && typeof item.createdAt === "string" && item.classification === "PERSONAL";
}

export function readAnnotations(storage: KeyValueStorage | null): Annotation[] {
  try {
    const parsed = JSON.parse(storage?.getItem(ANNOTATIONS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

export function writeAnnotations(storage: KeyValueStorage | null, annotations: readonly Annotation[]): void {
  try {
    storage?.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations.slice(-MAX_ANNOTATIONS)));
  } catch {
    // Storage blocked or full: annotations stay in memory for this visit.
  }
}

export function annotationsFor(annotations: readonly Annotation[], documentId: string, pageNumber: number, passageId: string): Annotation[] {
  return annotations.filter((item) => item.documentId === documentId && item.pageNumber === pageNumber && item.passageId === passageId);
}
