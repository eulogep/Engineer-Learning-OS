import type { Metadata } from "next";
import { CurrentSemesterWorkspace } from "@/components/current-semester/CurrentSemesterViews";

export const metadata: Metadata = { title: "Semestre actuel" };

export default function SemesterPage() {
  return <CurrentSemesterWorkspace />;
}
