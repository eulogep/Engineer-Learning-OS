// Copies the ONNX Runtime WebAssembly build used by @huggingface/transformers into
// public/vendor/ort, so on-device speech recognition never loads code from a CDN.
// Generated files are git-ignored; this runs before `next dev` and `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const transformersDir = path.dirname(path.dirname(require.resolve("@huggingface/transformers")));
const ortDist = path.join(path.dirname(require.resolve("onnxruntime-web", { paths: [transformersDir] })), "..", "dist");
const out = path.resolve("public/vendor/ort");
mkdirSync(out, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]) {
  copyFileSync(path.join(ortDist, file), path.join(out, file));
}
console.log("ONNX Runtime (web) copied to public/vendor/ort");
