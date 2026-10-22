import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ImportError, OcrAvailableError, buildImportedDocument, pagesNeedingOcr } from "../../../src/modules/learning-studio/import.ts";

const meta = { title: "Scan", subjectLabel: "Réseaux", chapter: "", docType: "COURS" as const };

test("pages without a usable text layer are flagged for OCR", () => {
  const pages = [{ pageNumber: 1, text: "Le routeur relie plusieurs réseaux entre eux." }, { pageNumber: 2, text: "  12 " }, { pageNumber: 3, text: "" }];
  assert.deepEqual(pagesNeedingOcr(pages), [2, 3]);
});

test("OCR is offered with an explicit error, still an ImportError for older callers", () => {
  const error = new OcrAvailableError(3);
  assert.ok(error instanceof ImportError);
  assert.match(error.message, /3 pages/);
  assert.match(error.message, /sur cet appareil/);
});

test("pages read by OCR keep a flag so the learner knows to verify citations", () => {
  const document = buildImportedDocument("x", meta, [
    { pageNumber: 1, text: "Le routeur relie plusieurs réseaux entre eux." },
    { pageNumber: 2, text: "Un commutateur relie les machines d’un même réseau local.", ocr: true },
  ], "page", new Date(2026, 9, 22));
  assert.equal(document.pages[0].ocr, undefined);
  assert.equal(document.pages[1].ocr, true);
});

test("the OCR runtime is self-hosted: no CDN default can be used", () => {
  const source = readFileSync(new URL("../../../src/modules/learning-studio/browser-ocr.ts", import.meta.url), "utf8");
  for (const option of ["workerPath", "corePath", "langPath"]) assert.match(source, new RegExp(`${option}: \`\\$\\{BASE\\}`), option);
  assert.match(source, /workerBlobURL: false/);
  assert.doesNotMatch(source, /https?:\/\//);
});
