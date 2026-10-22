"use client";

import { ImportError, MAX_IMPORT_BYTES, MAX_IMPORT_PAGES, buildImportedDocument, importFormat, textToSections, type ImportMetadata, type RawPage } from "./import";
import type { StudioDocument } from "./types";

// Browser adapters for the learner's own documents: pdf.js runs locally with a
// worker served by the app (public/vendor/pdfjs), and documents persist in
// IndexedDB on this device only.

const DB_NAME = "engineer-learning-os-studio";
const STORE = "documents";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

export async function saveImportedDocument(document: StudioDocument): Promise<void> {
  await run("readwrite", (store) => store.put(document));
}

export async function deleteImportedDocument(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
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

function newId(): string {
  return `perso-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
}

/** Reads a PDF, Markdown or text file entirely in the browser and stores it locally. */
export async function importFile(file: File, metadata: ImportMetadata): Promise<StudioDocument> {
  const format = importFormat(file.name);
  if (!format) throw new ImportError("Format non pris en charge : PDF, Markdown (.md) ou texte (.txt).");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError("Fichier trop volumineux (25 Mo maximum).");
  let document: StudioDocument;
  if (format === "PDF") {
    let pages: RawPage[];
    try {
      pages = await readPdfPages(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError("Ce PDF n’a pas pu être lu (fichier protégé ou endommagé).");
    }
    document = buildImportedDocument(newId(), metadata, pages, "page", new Date());
  } else {
    document = buildImportedDocument(newId(), metadata, textToSections(await file.text()), "section", new Date());
  }
  await saveImportedDocument(document);
  return document;
}
