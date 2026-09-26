// Registers the test-only resolver for `node --test` so that no command-line flag is needed.
// Node's native TypeScript stripping does not add extensions to ESM imports; production code is
// bundled by Next.js, so only tests and scripts need this rule (see the loader itself).
import { register } from "node:module";

register("./unit/learning-history/node-loader.mjs", import.meta.url);
