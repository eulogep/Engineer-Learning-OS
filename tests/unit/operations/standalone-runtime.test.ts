import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("the production command runs inside the assembled standalone runtime", () => {
  const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
  assert.match(packageJson.scripts.start, /^cd \.next\/standalone && /);
  assert.match(packageJson.scripts.start, /\bnode server\.js\b/);

  const assembly = readFileSync(path.resolve(process.cwd(), "scripts/post-build-standalone.mjs"), "utf8");
  assert.match(assembly, /"standalone", "\.next", "static"/);
  assert.match(assembly, /"standalone", "public"/);
});
