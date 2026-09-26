import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const index = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"));
const failures = [];
for (const source of index.sources) {
  try {
    const bytes = await readFile(path.join(root, source.path));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== source.sha256) failures.push(`${source.id}:CHECKSUM_MISMATCH`);
  } catch {
    failures.push(`${source.id}:MISSING_LOCAL_FILE`);
  }
}
if (failures.length) throw new Error(`LOCAL_KNOWLEDGE_VALIDATION_FAILED ${failures.join(",")}`);
console.log(`LOCAL_KNOWLEDGE_VALIDATION_PASS sources=${index.sources.length} knownMissing=${index.missingButKnownInChatGPT.length}`);
