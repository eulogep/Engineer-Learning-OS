import type { Metadata } from "next";
import { DailyEnglishMission } from "@/components/daily-mission/DailyEnglishMission";

export const metadata: Metadata = { title: "Daily English" };

export default function DailyEnglishPage() {
  return <DailyEnglishMission />;
}
