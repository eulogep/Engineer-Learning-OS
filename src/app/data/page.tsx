import type { Metadata } from "next";
import { CanonicalDataWorkspace } from "@/components/learning-history/CanonicalDataWorkspace";
import { DailyEnglishBackupCard } from "@/components/daily-mission/DailyEnglishBackupCard";
import { AgentBridgePanel } from "@/components/learner-snapshot/AgentBridgePanel";

export const metadata: Metadata = { title: "Données locales" };

export default function DataPage() {
  return (
    <div className="space-y-6">
      <CanonicalDataWorkspace />
      <DailyEnglishBackupCard />
      <AgentBridgePanel />
    </div>
  );
}
