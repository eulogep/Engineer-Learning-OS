import type { Metadata } from "next";
import { NotebookLMWorkspace } from "@/components/notebooklm/NotebookLMWorkspace";

export const metadata: Metadata = { title: "NotebookLM contrôlé — Engineer Learning OS" };

export default function NotebookLMPage() {
  return <NotebookLMWorkspace />;
}
