// Test bundling only: reuse the project's existing TypeScript compiler, no added dependency.
import ts from "typescript";
export default function transpileFixture(source) {
  return ts.transpileModule(source, { fileName: this.resourcePath, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true,
  } }).outputText;
}
