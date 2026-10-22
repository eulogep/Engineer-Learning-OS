"use client";

import { LOCAL_ASR_MODEL_ID, cleanTranscript, downloadPercent, toWhisperInput, type FileProgress } from "./core";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export type TranscriptionStatus =
  | Readonly<{ phase: "downloading"; percent: number | null }>
  | Readonly<{ phase: "transcribing" }>;

let worker: Worker | null = null;
let nextId = 1;
const files = new Map<string, FileProgress>();

function getWorker(): Worker {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** Decodes a recording (webm/ogg/mp4…) to the 16 kHz mono PCM Whisper expects. */
export async function decodeRecording(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return toWhisperInput(channels, buffer.sampleRate);
  } finally {
    void context.close();
  }
}

function run(request: WorkerRequest, onStatus: (status: TranscriptionStatus) => void, transfer: Transferable[] = []): Promise<string> {
  const target = getWorker();
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        files.set(message.file, { file: message.file, loaded: message.loaded, total: message.total });
        onStatus({ phase: "downloading", percent: downloadPercent([...files.values()]) });
        return;
      }
      if (message.id !== request.id) return;
      if (message.type === "transcribing") { onStatus({ phase: "transcribing" }); return; }
      target.removeEventListener("message", listener);
      if (message.type === "error") reject(new Error(message.message));
      else resolve(message.type === "result" ? cleanTranscript(message.text) : "");
    };
    target.addEventListener("message", listener);
    target.postMessage(request, transfer);
  });
}

/** Downloads (first time) and loads the model without transcribing anything. */
export function prepareLocalTranscription(onStatus: (status: TranscriptionStatus) => void): Promise<void> {
  return run({ type: "warmup", id: nextId++, modelId: LOCAL_ASR_MODEL_ID }, onStatus).then(() => undefined);
}

/** Transcribes a recording entirely in this browser. */
export async function transcribeLocally(blob: Blob, onStatus: (status: TranscriptionStatus) => void): Promise<string> {
  const audio = await decodeRecording(blob);
  if (audio.length < 1_600) return ""; // under 0.1 s: nothing to transcribe
  return run({ type: "transcribe", id: nextId++, modelId: LOCAL_ASR_MODEL_ID, audio }, onStatus, [audio.buffer]);
}
