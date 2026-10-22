/// <reference lib="webworker" />
// Runs Whisper off the main thread. Receives 16 kHz mono PCM, returns text.
// Network: model weights from Hugging Face (cached by the browser after the first
// download); the ONNX runtime is served by this app from /vendor/ort.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { WorkerRequest, WorkerResponse } from "./protocol";

env.allowLocalModels = false;
env.useBrowserCache = true;
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number } };
if (onnx.wasm) {
  onnx.wasm.wasmPaths = {
    mjs: new URL("/vendor/ort/ort-wasm-simd-threaded.asyncify.mjs", self.location.origin).href,
    wasm: new URL("/vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", self.location.origin).href,
  };
  // The app is not cross-origin isolated, so WebAssembly threads are unavailable.
  onnx.wasm.numThreads = 1;
}

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const post = (message: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);

/** Loads the model once (download on first use, browser cache afterwards). */
function nasaLaunch(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  recognizer ??= pipeline("automatic-speech-recognition", modelId, {
    device: "wasm",
    dtype: "q8",
    progress_callback: (event: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (event.status === "progress" && event.file) {
        post({ type: "progress", file: event.file, loaded: event.loaded ?? 0, total: event.total ?? 0 });
      }
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  recognizer.catch(() => { recognizer = null; });
  return recognizer;
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const asr = await nasaLaunch(request.modelId);
    if (request.type === "warmup") { post({ type: "ready", id: request.id }); return; }
    post({ type: "transcribing", id: request.id });
    const output = await asr(request.audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(output) ? output.map((item) => item.text).join(" ") : output.text;
    post({ type: "result", id: request.id, text });
  } catch (error) {
    post({ type: "error", id: request.id, message: error instanceof Error ? error.message : String(error) });
  }
});
