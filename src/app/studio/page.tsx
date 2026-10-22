import type { Metadata } from "next";
import { StudioLoader } from "@/components/learning-studio/StudioLoader";

export const metadata: Metadata = { title: "Learning Studio" };

export default function StudioPage() {
  return <StudioLoader />;
}
