// Copies browser runtimes into public/vendor so nothing is loaded from a CDN:
// - the ONNX Runtime WebAssembly build used by @huggingface/transformers (speech recognition);
// - the pdf.js worker used to read imported PDFs in the Learning Studio.
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

const pdfjsBuild = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "legacy", "build");
const pdfOut = path.resolve("public/vendor/pdfjs");
mkdirSync(pdfOut, { recursive: true });
copyFileSync(path.join(pdfjsBuild, "pdf.worker.min.mjs"), path.join(pdfOut, "pdf.worker.min.mjs"));
console.log("pdf.js worker copied to public/vendor/pdfjs");
