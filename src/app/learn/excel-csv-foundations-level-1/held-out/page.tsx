import type { Metadata } from "next";
import { HeldOutExcelWorkspace } from "@/components/held-out-excel/HeldOutExcelWorkspace";

export const metadata: Metadata = { title: "Validation held-out Excel CSV" };

export default function HeldOutExcelPage() {
  return <HeldOutExcelWorkspace />;
}
