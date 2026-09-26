import type { Metadata } from "next";
import { EvidenceWorkspace } from "@/components/learning-records/LearningRecordPanels";
import { SemesterContextBanner } from "@/components/current-semester/CurrentSemesterViews";

export const metadata: Metadata = { title: "Preuves" };

export default function EvidencePage() {
  return <div className="space-y-6"><SemesterContextBanner area="EVIDENCE" /><EvidenceWorkspace /></div>;
}
