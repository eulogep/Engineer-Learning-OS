export type WorkerRequest =
  | Readonly<{ type: "warmup"; id: number; modelId: string }>
  | Readonly<{ type: "transcribe"; id: number; modelId: string; audio: Float32Array }>;

export type WorkerResponse =
  | Readonly<{ type: "progress"; file: string; loaded: number; total: number }>
  | Readonly<{ type: "ready"; id: number }>
  | Readonly<{ type: "transcribing"; id: number }>
  | Readonly<{ type: "result"; id: number; text: string }>
  | Readonly<{ type: "error"; id: number; message: string }>;
