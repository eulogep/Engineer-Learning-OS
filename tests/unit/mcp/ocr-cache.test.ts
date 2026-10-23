import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cacheDir, loadSources } from "../../../mcp/elos-server.ts";

/** Smallest valid PDF with one blank page and no text layer (like a scan). */
function blankPdf(): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>"];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

test("cached OCR text fills scanned pages, is flagged, and lives outside the shared folder", async () => {
  const base = mkdtempSync(path.join(tmpdir(), "elos-ocr-"));
  const root = path.join(base, "cours");
  mkdirSync(path.join(root, "Reseaux"), { recursive: true });
  const file = path.join(root, "Reseaux", "scan.pdf");
  const bytes = blankPdf();
  writeFileSync(file, bytes);
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ELOS_OCR: "off" }; // never call Vision in tests

  assert.equal((await loadSources(root, env)).length, 0, "a scan without OCR yields nothing (nothing invented)");

  const cache = cacheDir(root, env);
  assert.equal(cache, path.join(base, ".elos-cache"));
  mkdirSync(path.join(cache, "ocr"), { recursive: true });
  const digest = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(path.join(cache, "ocr", `${digest}.json`), JSON.stringify({ pages: [{ pageNumber: 1, text: "Un VLAN est un réseau local virtuel qui isole des machines." }] }));
  writeFileSync(file, bytes); // touch: new mtime invalidates the in-memory extraction cache

  const [document] = await loadSources(root, env);
  assert.equal(document.subjectLabel, "Reseaux");
  assert.equal(document.pages[0].ocr, true);
  assert.match(document.pages[0].passages[0].text, /VLAN est un réseau local virtuel/);
  assert.deepEqual(readdirSync(root, { recursive: true }).sort(), ["Reseaux", path.join("Reseaux", "scan.pdf")], "nothing written in the shared folder");
});
