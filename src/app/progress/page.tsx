import type { Metadata } from "next";
import { MasteryLegend } from "@/components/learning-os/LearningVisuals";
import { ProgressWorkspace } from "@/components/learning-records/LearningRecordPanels";
import { PedagogicalProgressCard } from "@/components/scientific-pedagogy/PedagogicalPolicyCards";
import { SemesterContextBanner } from "@/components/current-semester/CurrentSemesterViews";

export const metadata: Metadata = { title: "Progression" };

export default function ProgressPage() {
  return <div className="space-y-6"><SemesterContextBanner area="PROGRESS" /><ProgressWorkspace /><PedagogicalProgressCard /><MasteryLegend /></div>;
}
