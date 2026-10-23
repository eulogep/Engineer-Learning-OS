import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = path.resolve(import.meta.dirname, "../../..");
const sources = mkdtempSync(path.join(tmpdir(), "elos-mcp-"));
mkdirSync(path.join(sources, "reseaux"));
mkdirSync(path.join(sources, "knowledge-private"));
writeFileSync(path.join(sources, "reseaux", "vlan.md"), "# Réseaux\nUn VLAN est un réseau local virtuel qui isole des machines sur un même commutateur.\n\nUne passerelle désigne le routeur vers lequel une machine envoie les paquets destinés à d'autres réseaux.\n");
writeFileSync(path.join(sources, "knowledge-private", "secret.md"), "Le code secret désigne une valeur privée qui ne doit jamais sortir.\n");
writeFileSync(path.join(sources, "revlog.tsv"), "review_time\tcard_id\treview_rating\n" +
  Array.from({ length: 40 }, (_, i) => `${Date.UTC(2026, 0, 1) + Math.floor(i / 4) * 5 * 86_400_000 + (i % 4) * 3_600_000_000}\tc${i % 4}\t${i % 7 ? 3 : 1}`).join("\n"));

function client(env: Record<string, string>) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", "--no-warnings", "--import", "./tests/register-loader.mjs", "mcp/elos-server.ts"],
    cwd: repo, env: { PATH: process.env.PATH ?? "", ...env }, stderr: "ignore",
  });
  const c = new Client({ name: "elos-test", version: "1.0.0" });
  return { c, connect: () => c.connect(transport) };
}
const text = (result: unknown) => JSON.parse((result as { content: { text: string }[] }).content[0].text);

const withSources = client({ ELOS_SOURCES_DIR: sources });
before(() => withSources.connect());
after(() => withSources.c.close());

test("server lists the ELOS tools", async () => {
  const { tools } = await withSources.c.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["elos_ask_sources", "elos_compare_schedulers", "elos_correct_english", "elos_roleplay", "elos_study_pack", "elos_vocabulary"]);
  assert.match(tools.find((tool) => tool.name === "elos_ask_sources")!.description!, /model provider/);
});

test("answers come only from the configured sources, with a section citation", async () => {
  const result = text(await withSources.c.callTool({ name: "elos_ask_sources", arguments: { question: "Qu'est-ce qu'un VLAN ?" } }));
  assert.equal(result.grounded, true);
  assert.match(result.answer, /VLAN est un réseau local virtuel/);
  assert.equal(result.citations[0].source, path.join("reseaux", "vlan.md"));
  assert.equal(result.citations[0].section, 1);
  const outside = text(await withSources.c.callTool({ name: "elos_ask_sources", arguments: { question: "Recette de la pizza napolitaine ?" } }));
  assert.equal(outside.grounded, false);
});

test("knowledge-private is never read", async () => {
  const result = text(await withSources.c.callTool({ name: "elos_ask_sources", arguments: { question: "Que désigne le code secret ?" } }));
  assert.equal(result.grounded, false);
  const cards = text(await withSources.c.callTool({ name: "elos_study_pack", arguments: { kind: "flashcards", limit: 50 } }));
  assert.ok(cards.every((card: { citation: { source: string } }) => !card.citation.source.includes("knowledge-private")));
  assert.ok(cards.some((card: { front: string }) => card.front === "passerelle"));
});

test("study pack, English correction, roleplay and vocabulary work", async () => {
  const quiz = text(await withSources.c.callTool({ name: "elos_study_pack", arguments: { kind: "quiz", limit: 2 } }));
  assert.ok(Array.isArray(quiz));
  const english = text(await withSources.c.callTool({ name: "elos_correct_english", arguments: { text: "i am agree since 2 years", target_words: ["agree"] } }));
  assert.match(english.corrected, /I agree for 2 years/);
  const scenarios = text(await withSources.c.callTool({ name: "elos_roleplay", arguments: {} }));
  assert.equal(scenarios.length, 3);
  const turn = text(await withSources.c.callTool({ name: "elos_roleplay", arguments: { scenario_id: "standup", turn: 1, answer: "Yesterday I configured the switch." } }));
  assert.ok(turn.score > 50);
  const packs = text(await withSources.c.callTool({ name: "elos_vocabulary", arguments: {} }));
  assert.equal(packs.length, 5);
});

test("scheduler comparison is confined to the sources directory", async () => {
  const report = text(await withSources.c.callTool({ name: "elos_compare_schedulers", arguments: { files: ["revlog.tsv"] } }));
  assert.equal(report[0].scores.length, 2);
  const escape = await withSources.c.callTool({ name: "elos_compare_schedulers", arguments: { files: ["../../etc/passwd"] } });
  assert.equal(escape.isError, true);
});

test("without ELOS_SOURCES_DIR the server only uses synthetic documents", async () => {
  const demo = client({});
  await demo.connect();
  try {
    const result = text(await demo.c.callTool({ name: "elos_ask_sources", arguments: { question: "Qu'est-ce que l'encapsulation ?" } }));
    assert.match(result.answer, /encapsulation est le mécanisme/);
    assert.equal(result.citations[0].source, "Modèle OSI et encapsulation");
  } finally {
    await demo.c.close();
  }
});
