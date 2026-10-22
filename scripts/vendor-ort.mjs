// Copies browser runtimes into public/vendor so nothing is loaded from a CDN:
// - the ONNX Runtime WebAssembly build used by @huggingface/transformers (speech recognition);
// - the pdf.js worker used to read imported PDFs in the Learning Studio;
// - tesseract.js (worker, LSTM WebAssembly core, French model) for on-device OCR of scanned PDFs.
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

const tesseractOut = path.resolve("public/vendor/tesseract");
const tesseractDir = path.dirname(require.resolve("tesseract.js/package.json"));
const coreDir = path.dirname(require.resolve("tesseract.js-core/package.json", { paths: [tesseractDir] }));
const fraDir = path.dirname(require.resolve("@tesseract.js-data/fra/package.json"));
mkdirSync(path.join(tesseractOut, "core"), { recursive: true });
mkdirSync(path.join(tesseractOut, "lang"), { recursive: true });
copyFileSync(path.join(tesseractDir, "dist", "worker.min.js"), path.join(tesseractOut, "worker.min.js"));
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  copyFileSync(path.join(coreDir, `tesseract-core-${variant}.wasm.js`), path.join(tesseractOut, "core", `tesseract-core-${variant}.wasm.js`));
}
copyFileSync(path.join(fraDir, "4.0.0_best_int", "fra.traineddata.gz"), path.join(tesseractOut, "lang", "fra.traineddata.gz"));
console.log("tesseract.js (OCR) copied to public/vendor/tesseract");
