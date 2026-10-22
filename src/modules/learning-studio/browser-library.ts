"use client";

import { ImportError, MAX_IMPORT_BYTES, MAX_IMPORT_PAGES, buildImportedDocument, importFormat, originalFileIdentity, textToSections, type ImportMetadata, type RawPage } from "./import";
import type { StudioDocument } from "./types";

// Browser adapters for the learner's own documents: pdf.js runs locally with a
// worker served by the app (public/vendor/pdfjs), and documents persist in
// IndexedDB on this device only.

const DB_NAME = "engineer-learning-os-studio";
const STORE = "documents";
const ORIGINALS = "originals";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(ORIGINALS)) request.result.createObjectStore(ORIGINALS);
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

async function readPdfPages(bytes: Uint8Array): Promise<RawPage[]> {
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
    return pages;
  } finally {
    await task.destroy();
  }
}

/** Reads a PDF, Markdown or text file entirely in the browser and stores it locally. */
export async function importFile(file: File, metadata: ImportMetadata): Promise<StudioDocument> {
  const format = importFormat(file.name);
  if (!format) throw new ImportError("Format non pris en charge : PDF, Markdown (.md) ou texte (.txt).");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError("Fichier trop volumineux (25 Mo maximum).");
  const bytes = await file.arrayBuffer();
  const identity = await originalFileIdentity(bytes);
  const existing = (await listImportedDocuments()).find((item) => item.id === identity.id);
  if (existing) return existing;
  let document: StudioDocument;
  if (format === "PDF") {
    let pages: RawPage[];
    try {
      pages = await readPdfPages(new Uint8Array(bytes));
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError("Ce PDF n’a pas pu être lu (fichier protégé ou endommagé).");
    }
    document = buildImportedDocument(identity.id, metadata, pages, "page", new Date());
  } else {
    document = buildImportedDocument(identity.id, metadata, textToSections(new TextDecoder().decode(bytes)), "section", new Date());
  }
  document = { ...document, provenance: {
    sourceId: identity.id, sha256: identity.sha256, originalFileName: file.name,
    extractionMethod: format === "PDF" ? "PDFJS_DIST_LOCAL" : "PLAIN_TEXT_LOCAL",
    artifactRole: "DERIVED", originalRole: "ORIGINAL_SOURCE",
  } };
  await saveImportedDocument(document, file);
  return (await listImportedDocuments()).find((item) => item.id === document.id) ?? document;
}
