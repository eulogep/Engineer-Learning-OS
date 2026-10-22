"use client";

import { ImportError, MAX_IMPORT_BYTES, MAX_IMPORT_PAGES, OcrAvailableError, buildImportedDocument, importFormat, originalFileIdentity, pagesNeedingOcr, textToSections, type ImportMetadata, type RawPage } from "./import";
import { recognizePages, type OcrProgress } from "./browser-ocr";
import type { StudioDocument } from "./types";
import type { AcademicSourceIndex, AcademicSourceIndexEntry } from "../academic-workspace/types";
import { bindAcademicSource, parseLocalCatalogue, sourceImportAllowed } from "./academic-catalogue";

// Browser adapters for the learner's own documents: pdf.js runs locally with a
// worker served by the app (public/vendor/pdfjs), and documents persist in
// IndexedDB on this device only.

const DB_NAME = "engineer-learning-os-studio";
const STORE = "documents";
const ORIGINALS = "originals";
const CATALOGUES = "catalogues";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(ORIGINALS)) request.result.createObjectStore(ORIGINALS);
      if (!request.result.objectStoreNames.contains(CATALOGUES)) request.result.createObjectStore(CATALOGUES);
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Fermez les autres onglets du Studio puis réessayez."));
    };
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction annulée"));
    });
  } finally {
    db.close();
  }
}

export async function listImportedDocuments(): Promise<StudioDocument[]> {
  const documents = await run("readonly", (store) => store.getAll() as IDBRequest<StudioDocument[]>);
  return documents.filter((document) => document.classification === "PERSONAL")
    .sort((a, b) => String(a.importedAt).localeCompare(String(b.importedAt)));
}

export async function saveImportedDocument(document: StudioDocument, original?: File): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE, ORIGINALS], "readwrite");
      // Never overwrite a previously imported version, including concurrent imports.
      const store = transaction.objectStore(STORE);
      const existing = store.get(document.id);
      existing.onsuccess = () => {
        if (!existing.result) {
          store.add(document);
          if (original) transaction.objectStore(ORIGINALS).add(original, document.id);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction annulée"));
    });
  } finally { db.close(); }
}

export async function readOriginalFile(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(ORIGINALS, "readonly").objectStore(ORIGINALS).get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function deleteImportedDocument(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE, ORIGINALS], "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.objectStore(ORIGINALS).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction annulée"));
    });
  } finally { db.close(); }
}

export type ImportOptions = Readonly<{ ocr?: boolean; onOcrProgress?: (progress: OcrProgress) => void }>;

async function readPdfPages(bytes: Uint8Array, options: ImportOptions = {}): Promise<RawPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_IMPORT_PAGES) throw new ImportError(`Document trop long (${pdf.numPages} pages, maximum ${MAX_IMPORT_PAGES}).`);
    const pages: RawPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      let text = "";
      for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      pages.push({ pageNumber, text });
    }
    const missing = pagesNeedingOcr(pages);
    if (missing.length === 0) return pages;
    if (!options.ocr) {
      if (missing.length === pages.length) throw new OcrAvailableError(pages.length);
      return pages; // mixed PDF: the readable pages are kept as they are
    }
    const recognized = await recognizePages((pageNumber) => pdf.getPage(pageNumber), missing, options.onOcrProgress);
    return pages.map((page) => (recognized.has(page.pageNumber) ? { pageNumber: page.pageNumber, text: recognized.get(page.pageNumber) ?? "", ocr: true } : page));
  } finally {
    await task.destroy();
  }
}

/** Reads a PDF, Markdown or text file entirely in the browser and stores it locally. */
export async function importFile(file: File, metadata: ImportMetadata, source?: AcademicSourceIndexEntry, options: ImportOptions = {}): Promise<StudioDocument> {
  if (source && !sourceImportAllowed(source)) throw new ImportError("Classification interdite dans le Studio académique.");
  const format = importFormat(file.name);
  if (!format) throw new ImportError("Format non pris en charge : PDF, Markdown (.md) ou texte (.txt).");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError("Fichier trop volumineux (25 Mo maximum).");
  const bytes = await file.arrayBuffer();
  const identity = await originalFileIdentity(bytes);
  if (source && source.sha256 !== identity.sha256) throw new ImportError("Empreinte différente : sélectionnez le fichier original du catalogue.");
  const sourceRevision = source ? await originalFileIdentity(new TextEncoder().encode(JSON.stringify(source)).buffer) : null;
  const documentId = sourceRevision ? `academic:${sourceRevision.sha256}:${identity.sha256}` : identity.id;
  const existing = (await listImportedDocuments()).find((item) => item.id === documentId);
  if (existing) return existing;
  let document: StudioDocument;
  if (format === "PDF") {
    let pages: RawPage[];
    try {
      pages = await readPdfPages(new Uint8Array(bytes), options);
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError("Ce PDF n’a pas pu être lu (fichier protégé ou endommagé).");
    }
    document = buildImportedDocument(documentId, metadata, pages, "page", new Date());
  } else {
    document = buildImportedDocument(documentId, metadata, textToSections(new TextDecoder().decode(bytes)), "section", new Date());
  }
  document = { ...document, provenance: {
    sourceId: identity.id, sha256: identity.sha256, originalFileName: file.name,
    extractionMethod: format !== "PDF" ? "PLAIN_TEXT_LOCAL" : document.pages.some((page) => page.ocr) ? "PDFJS_DIST_LOCAL+TESSERACT_OCR_LOCAL" : "PDFJS_DIST_LOCAL",
    artifactRole: "DERIVED", originalRole: "ORIGINAL_SOURCE",
  } };
  if (source) document = bindAcademicSource(document, source);
  await saveImportedDocument(document, file);
  return (await listImportedDocuments()).find((item) => item.id === document.id) ?? document;
}

/** Keep catalogue revisions locally, never replacing earlier snapshots. */
export async function saveLocalCatalogue(raw: string): Promise<AcademicSourceIndex> {
  const index = parseLocalCatalogue(JSON.parse(raw));
  const { sha256 } = await originalFileIdentity(new TextEncoder().encode(raw).buffer);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CATALOGUES, "readwrite");
      const store = transaction.objectStore(CATALOGUES);
      store.put(raw, sha256);
      store.put(sha256, "active");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction annulée"));
    });
  } finally { db.close(); }
  return index;
}

export async function readLocalCatalogue(): Promise<AcademicSourceIndex | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const store = db.transaction(CATALOGUES, "readonly").objectStore(CATALOGUES);
      const active = store.get("active");
      active.onerror = () => reject(active.error);
      active.onsuccess = () => {
        if (!active.result) { resolve(null); return; }
        const snapshot = store.get(active.result);
        snapshot.onerror = () => reject(snapshot.error);
        snapshot.onsuccess = () => {
          try { resolve(parseLocalCatalogue(JSON.parse(snapshot.result))); } catch (error) { reject(error); }
        };
      };
    });
  } finally { db.close(); }
}
