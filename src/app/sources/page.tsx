import type { Metadata } from "next";
import { SourceExplorer } from "@/components/source-engine/SourceExplorer";
import { sourceEngineRegistry } from "@/modules/source-engine/pilot-registry";
import { AcademicKnowledgeLibraryCard } from "@/components/source-engine/AcademicKnowledgeLibraryCard";

export const metadata: Metadata = { title: "Knowledge / Sources" };

export default function SourcesPage() {
  return <div className="space-y-6"><AcademicKnowledgeLibraryCard /><SourceExplorer registry={sourceEngineRegistry} /></div>;
}
