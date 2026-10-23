"use client";

import { readLocalState } from "../daily-english/local-mission";
import { CURRENT_SEMESTER_STATE } from "../current-semester/registry";
import { deriveFlashcards, readStudioState } from "../learning-studio/core";
import { listImportedDocuments } from "../learning-studio/browser-library";
import { SYNTHETIC_DOCUMENTS } from "../learning-studio/fixtures";
import { buildLearnerSnapshot, type LearnerSnapshot } from "./core";

// Writes the learner snapshot to a folder chosen by the learner (File System Access
// API, Chrome / Edge), so a local agent can read it. Nothing is uploaded anywhere.

export const SNAPSHOT_FILE = "elos-state.json";
const DB = "engineer-learning-os-agent-bridge";
const STORE = "handles";
const KEY = "snapshot-folder";

type Permission = "granted" | "denied" | "prompt";
type DirectoryHandle = {
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<Permission>;
  requestPermission(options: { mode: "readwrite" }): Promise<Permission>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
};
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: "readwrite"; id?: string }) => Promise<DirectoryHandle> };

export function folderSyncSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function savedFolder(): Promise<DirectoryHandle | null> {
  try { return (await idb("readonly", (store) => store.get(KEY) as IDBRequest<DirectoryHandle | undefined>)) ?? null; } catch { return null; }
}

export async function forgetFolder(): Promise<void> {
  await idb("readwrite", (store) => store.delete(KEY));
}

export async function chooseFolder(): Promise<DirectoryHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("FOLDER_SYNC_UNSUPPORTED");
  const handle = await picker({ mode: "readwrite", id: "elos-agent-bridge" });
  await idb("readwrite", (store) => store.put(handle, KEY));
  return handle;
}

export async function collectSnapshot(now = new Date()): Promise<LearnerSnapshot> {
  const imported = await listImportedDocuments().catch(() => []);
  const library = [...SYNTHETIC_DOCUMENTS, ...imported];
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return buildLearnerSnapshot({
    dailyEnglish: readLocalState(storage),
    dailyStorage: storage,
    studio: readStudioState(storage),
    cards: deriveFlashcards(library),
    documentTitles: Object.fromEntries(library.map((document) => [document.id, document.title])),
    exams: CURRENT_SEMESTER_STATE.courses.map((course) => ({ course: course.title, date: course.examDate, priority: course.priority })),
    now,
  });
}

const comparable = (snapshot: LearnerSnapshot) => JSON.stringify({ ...snapshot, generatedAt: "" });
let lastWritten = "";

/** Writes the snapshot if the folder is still authorised and the content changed. Returns what happened. */
export async function syncSnapshot(handle: DirectoryHandle, options: { force?: boolean; request?: boolean } = {}): Promise<"written" | "unchanged" | "permission-needed"> {
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted" && options.request) permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") return "permission-needed";
  const snapshot = await collectSnapshot();
  const key = comparable(snapshot);
  if (!options.force && key === lastWritten) return "unchanged";
  const writable = await (await handle.getFileHandle(SNAPSHOT_FILE, { create: true })).createWritable();
  await writable.write(JSON.stringify(snapshot, null, 2));
  await writable.close();
  lastWritten = key;
  return "written";
}

export async function downloadSnapshot(): Promise<void> {
  const blob = new Blob([JSON.stringify(await collectSnapshot(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = SNAPSHOT_FILE; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
