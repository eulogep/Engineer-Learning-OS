import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedDocument, originalFileIdentity } from "../../../src/modules/learning-studio/import.ts";
import { citationFor, verifyCitation } from "../../../src/modules/learning-studio/core.ts";

test("original identity is deterministic, content-addressed and changes with bytes", async () => {
  const bytes = new TextEncoder().encode("Synthetic course only").buffer;
  const identity = await originalFileIdentity(bytes);
  assert.deepEqual(await originalFileIdentity(bytes.slice(0)), identity);
  assert.match(identity.sha256, /^[a-f0-9]{64}$/);
  assert.equal(identity.id, `original:${identity.sha256}`);
  assert.notEqual((await originalFileIdentity(new TextEncoder().encode("Revised synthetic course").buffer)).id, identity.id);
});

test("citations reject a replaced version or a different original even with identical text", () => {
  const document = {
    ...buildImportedDocument("source", { title: "Synthetic", subjectLabel: "SQL", chapter: "Keys", docType: "TD" },
      [{ pageNumber: 1, text: "Une clé est un identifiant unique." }], "section", new Date("2026-10-22")),
    provenance: { sourceId: "source", sha256: "a".repeat(64), originalFileName: "synthetic.txt",
      extractionMethod: "PLAIN_TEXT_LOCAL", artifactRole: "DERIVED" as const, originalRole: "ORIGINAL_SOURCE" as const },
  };
  const passage = document.pages[0].passages[0];
  const citation = citationFor(document, 1, passage.id, passage.text);
  assert.equal(verifyCitation([document], citation), true);
  assert.equal(citation.documentVersion, 1);
  assert.equal(citation.sourceSha256, document.provenance.sha256);
  assert.equal(verifyCitation([{ ...document, version: 2 }], citation), false);
  assert.equal(verifyCitation([{ ...document, provenance: { ...document.provenance, sha256: "b".repeat(64) } }], citation), false);
  assert.equal(verifyCitation([document], { ...citation, quote: "Invented claim" }), false);
});
