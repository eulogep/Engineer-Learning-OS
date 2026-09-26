import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(specifier + ".ts", context);
      }
      throw error;
    }
  },
});

const {
  InMemoryCanonicalLearningRepository,
} = await import("../../../src/modules/learning-history/index.ts");
const {
  runCanonicalRepositoryConformance,
} = await import("./repository-conformance.ts");

runCanonicalRepositoryConformance("in-memory canonical repository", () => {
  const repository = new InMemoryCanonicalLearningRepository();
  return {
    repository,
    failNextAtomicWriteAfterEvent: () => repository.failNextAtomicWriteAfterEvent(),
  };
});