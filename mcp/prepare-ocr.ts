// Pre-computes on-device OCR (macOS Vision) for every scanned PDF under ELOS_SOURCES_DIR,
// so the ELOS MCP server never has to wait for it. Results go to the cache directory,
// outside the shared folder. Usage: ELOS_SOURCES_DIR=... npm run mcp:ocr
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cacheDir, cachedOcr, listFiles, ocrNow, sourcesRoot } from "./elos-server.ts";

const root = sourcesRoot();
if (!root) { console.error("ELOS_SOURCES_DIR is not set."); process.exit(1); }
const cache = cacheDir(root);
let done = 0, skipped = 0, pages = 0;
for (const file of listFiles(root).filter((item) => /\.pdf$/i.test(item))) {
  const task = getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true });
  let scanned = false;
  try {
    const pdf = await task.promise;
    let chars = 0;
    for (let i = 1; i <= pdf.numPages && chars < 20; i += 1) chars += (await (await pdf.getPage(i)).getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join("").trim().length;
    scanned = chars < 20;
  } catch { scanned = false; } finally { await task.destroy(); }
  if (!scanned) continue;
  if (cachedOcr(cache, file)) { skipped += 1; continue; }
  const started = Date.now();
  const result = await ocrNow(cache, file);
  if (!result) { console.error("OCR unavailable (macOS + swiftc required)."); process.exit(1); }
  done += 1; pages += result.length;
  console.log(`OCR ${path.relative(root, file)} · ${result.length} p. · ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
console.log(`\n${done} PDF scanné(s) traité(s) (${pages} pages), ${skipped} déjà en cache · cache : ${cache}`);
