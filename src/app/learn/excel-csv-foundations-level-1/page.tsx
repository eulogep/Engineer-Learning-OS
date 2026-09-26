import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MissionRuntime } from "@/components/mission-runtime/MissionRuntime";
import { MissionSourcesCard } from "@/components/source-engine/MissionSourcesCard";
import { Button } from "@/components/ui/button";
import { excelLevel1Mission } from "@/modules/mission-runtime/excel-level-1-mission";

export const metadata: Metadata = { title: "Excel CSV Foundations — Niveau 1" };

export default function ExcelMissionPage() {
  return <div className="space-y-6">
    <Button asChild variant="ghost" className="-ml-3"><Link href="/"><ArrowLeft aria-hidden="true" />Aujourd’hui</Link></Button>
    <MissionSourcesCard sourceBundleIds={excelLevel1Mission.sourceBundleIds ?? []} />
    <MissionRuntime mission={excelLevel1Mission} />
    <div className="flex justify-center"><Button asChild variant="outline"><Link href="/learn/excel-csv-foundations-level-1/held-out">Passer à l’épreuve autonome</Link></Button></div>
  </div>;
}
