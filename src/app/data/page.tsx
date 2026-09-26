import type { Metadata } from "next";
import { CanonicalDataWorkspace } from "@/components/learning-history/CanonicalDataWorkspace";

export const metadata: Metadata = { title: "Données locales" };

export default function DataPage() {
  return <CanonicalDataWorkspace />;
}
