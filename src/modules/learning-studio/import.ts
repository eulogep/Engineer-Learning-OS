import type { StudioDocType, StudioDocument, StudioPage } from "./types";

/**
 * Turns the learner's own files into citable Studio documents. Pure functions:
 * the bytes are read in the browser (pdf.js for PDF) and never leave the device.
 */

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_PAGES = 400;
const TARGET_PASSAGE_CHARS = 420;
const SECTION_CHARS = 2_000;

export type ImportFormat = "PDF" | "MARKDOWN" | "TEXT";
export type ImportMetadata = Readonly<{ title: string; subjectLabel: string; chapter: string; docType: StudioDocType }>;
export type RawPage = Readonly<{ pageNumber: number; text: string; ocr?: boolean }>;

export class ImportError extends Error {}

/** A PDF without a usable text layer: on-device OCR can be offered to the learner. */
export class OcrAvailableError extends ImportError {
  readonly pageCount: number;

  constructor(pageCount: number) {
    super(`Aucun texte lisible : ce PDF semble scanné (${pageCount} page${pageCount > 1 ? "s" : ""}). Tu peux lancer la reconnaissance de texte (OCR) sur cet appareil.`);
    this.pageCount = pageCount;
  }
}

/** Pages whose text layer is missing or too thin to be a real page of text. */
export const MIN_PAGE_TEXT_CHARS = 20;
export function pagesNeedingOcr(pages: readonly RawPage[]): number[] {
  return pages.filter((page) => cleanExtractedText(page.text).length < MIN_PAGE_TEXT_CHARS).map((page) => page.pageNumber);
}

/** Content-addressed identity makes retries and renamed duplicates idempotent. */
export async function originalFileIdentity(bytes: ArrayBuffer): Promise<{ id: string; sha256: string }> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { id: `original:${sha256}`, sha256 };
}

export function importFormat(fileName: string): ImportFormat | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return "PDF";
  if (extension === "md" || extension === "markdown") return "MARKDOWN";
  if (extension === "txt") return "TEXT";
  return null;
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Document importé";
}

/**
 * Joins words hyphenated across PDF lines, repairs typographic ligatures that pdf.js
 * extracts as separate fragments ("modi fi er", "fi chier") and normalises whitespace,
 * keeping paragraph breaks.
 */
export function cleanExtractedText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    // One space on the left means the fragment is inside a word; several mean a word boundary.
    .replace(/(\p{L}) (ffi|ffl|ff|fi|fl) +(?=\p{Ll})/gu, "$1$2")
    .replace(/(^|[\s(«"'’])(ffi|ffl|ff|fi|fl) +(?=\p{Ll})/gu, "$1$2")
    .replace(/(\p{L}) (ffi|ffl|ff|fi|fl)(?=[\s.,;:!?)]|$)/gu, "$1$2")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/([^.!?:;\n])\n(?!\n)(?=\p{Ll})/gu, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Paragraphs first; long paragraphs are cut at sentence boundaries into ~400-character passages. */
export function splitPassages(text: string): string[] {
  const passages: string[] = [];
  for (const paragraph of cleanExtractedText(text).split(/\n\s*\n|\n(?=[-•*]\s|\d+[.)]\s|#+\s)/)) {
    const flat = paragraph.replace(/\n/g, " ").replace(/^#+\s*/, "").trim();
    if (flat.length < 3) continue;
    let current = "";
    for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
      if (current && (current + " " + sentence).length > TARGET_PASSAGE_CHARS) { passages.push(current); current = sentence; }
      else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) passages.push(current);
  }
  return passages;
}

/** Text and Markdown have no pages: split at headings, or every ~2000 characters, into numbered sections. */
export function textToSections(text: string): RawPage[] {
  const cleaned = cleanExtractedText(text);
  const byHeading = cleaned.split(/\n(?=#{1,3}\s)/).map((part) => part.trim()).filter(Boolean);
  const blocks = byHeading.length > 1 ? byHeading : [cleaned];
  const sections: string[] = [];
  for (const block of blocks) {
    if (block.length <= SECTION_CHARS) { sections.push(block); continue; }
    let current = "";
    for (const paragraph of block.split(/\n\s*\n/)) {
      if (current && (current.length + paragraph.length) > SECTION_CHARS) { sections.push(current); current = paragraph; }
      else current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) sections.push(current);
  }
  return sections.map((section, index) => ({ pageNumber: index + 1, text: section }));
}

export function buildImportedDocument(id: string, metadata: ImportMetadata, rawPages: readonly RawPage[], unit: "page" | "section", importedAt: Date): StudioDocument {
  if (rawPages.length > MAX_IMPORT_PAGES) throw new ImportError(`Document trop long (${rawPages.length} pages, maximum ${MAX_IMPORT_PAGES}).`);
  const pages: StudioPage[] = rawPages
    .map((page) => ({ pageNumber: page.pageNumber, passages: splitPassages(page.text).map((text, index) => ({ id: `p${page.pageNumber}-${index + 1}`, text })), ...(page.ocr ? { ocr: true } : {}) }))
    .filter((page) => page.passages.length > 0);
  if (pages.length === 0) {
    throw new ImportError(unit === "page"
      ? "Aucun texte lisible : ce PDF est probablement scanné (OCR nécessaire). Rien n’a été inventé."
      : "Le fichier ne contient pas de texte exploitable.");
  }
  return {
    id, title: metadata.title.trim() || "Document importé", subjectId: `perso-${metadata.subjectLabel.trim().toLowerCase().replace(/\s+/g, "-") || "general"}`,
    subjectLabel: metadata.subjectLabel.trim() || "Mes documents", chapter: metadata.chapter.trim(), docType: metadata.docType,
    version: 1, synthetic: false, classification: "PERSONAL", unit, importedAt: importedAt.toISOString(), pages,
  };
}
