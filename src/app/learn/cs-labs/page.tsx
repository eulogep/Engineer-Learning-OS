import type { Metadata } from "next";
import { CsEngineeringLabsStudio, type CsLabTab } from "@/components/cs-labs/CsEngineeringLabsStudio";

export const metadata: Metadata = { title: "Labs Ingénieur CYU" };

function parseTab(value: string | string[] | undefined): CsLabTab {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === "networking" || first === "linux" || first === "sql" || first === "sae") {
    return first;
  }
  return "networking";
}

export default async function CsLabsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <CsEngineeringLabsStudio initialTab={parseTab(query.tab)} />;
}
