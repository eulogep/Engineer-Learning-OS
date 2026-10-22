import assert from "node:assert/strict";
import test from "node:test";
import { verifyCitation } from "../../../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS } from "../../../src/modules/learning-studio/fixtures.ts";
import { THINKING_PAUSE_MS, buildAudioOverview } from "../../../src/modules/learning-studio/overview.ts";
import { ANNOTATIONS_KEY, annotationStatus, annotationsFor, createAnnotation, readAnnotations, writeAnnotations } from "../../../src/modules/learning-studio/annotations.ts";

function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("audio overview: intro, cited notions, links, confusions, then questions with thinking time", () => {
  const overview = buildAudioOverview(SYNTHETIC_DOCUMENTS);
  const kinds = overview.segments.map((segment) => segment.kind);
  assert.equal(kinds[0], "INTRO");
  assert.equal(kinds.at(-1), "OUTRO");
  assert.ok(kinds.includes("NOTION") && kinds.includes("CONFUSION") && kinds.includes("QUESTION") && kinds.includes("ANSWER"));
  assert.ok(overview.segments.filter((segment) => segment.citation).every((segment) => verifyCitation(SYNTHETIC_DOCUMENTS, segment.citation!)));
  const questions = overview.segments.filter((segment) => segment.kind === "QUESTION" && /^Question/.test(segment.text));
  assert.ok(questions.length >= 1 && questions.every((segment) => segment.pauseAfterMs === THINKING_PAUSE_MS));
  assert.ok(overview.segments.some((segment) => segment.text.includes("ne pas confondre TCP et UDP")));
  assert.equal(overview.canonical, false);
});

test("audio overview says so when sources have nothing usable", () => {
  assert.equal(buildAudioOverview([]).segments.length, 1);
  assert.match(buildAudioOverview([]).segments[0].text, /pas encore de définitions/);
});

test("annotations are anchored to a passage snapshot and survive storage round-trips", () => {
  const document = SYNTHETIC_DOCUMENTS[0];
  const note = createAnnotation(document, 2, "p2-a", "  À relier au TP 3  ", new Date(2026, 9, 22), "n1");
  assert.equal(note.note, "À relier au TP 3");
  assert.equal(note.classification, "PERSONAL");
  const storage = memory();
  writeAnnotations(storage, [note]);
  assert.deepEqual(readAnnotations(storage), [note]);
  assert.equal(annotationsFor([note], document.id, 2, "p2-a").length, 1);
  assert.equal(annotationStatus(note, SYNTHETIC_DOCUMENTS), "OK");
});

test("a changed or removed source is detected instead of silently re-attaching the note", () => {
  const document = SYNTHETIC_DOCUMENTS[0];
  const note = createAnnotation(document, 1, "p1-a", "note", new Date(), "n2");
  const edited = { ...document, pages: document.pages.map((page) => ({ ...page, passages: page.passages.map((passage) => ({ ...passage, text: passage.text + " (v2)" })) })) };
  assert.equal(annotationStatus(note, [edited]), "SOURCE_CHANGED");
  assert.equal(annotationStatus(note, []), "SOURCE_MISSING");
});

test("invalid anchors, empty notes and corrupted storage are rejected safely", () => {
  assert.throws(() => createAnnotation(SYNTHETIC_DOCUMENTS[0], 9, "p9", "x", new Date(), "n"), /ANCHOR/);
  assert.throws(() => createAnnotation(SYNTHETIC_DOCUMENTS[0], 1, "p1-a", "   ", new Date(), "n"), /EMPTY/);
  const storage = memory();
  storage.setItem(ANNOTATIONS_KEY, "{not json");
  assert.deepEqual(readAnnotations(storage), []);
  storage.setItem(ANNOTATIONS_KEY, JSON.stringify([{ id: "x" }]));
  assert.deepEqual(readAnnotations(storage), []);
});
