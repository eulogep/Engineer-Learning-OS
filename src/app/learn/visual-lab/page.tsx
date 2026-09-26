import type { Metadata } from "next";
import { VisualLearningLab } from "@/components/visual-learning/VisualLearningLab";
import type { VisualAttemptOrigin } from "@/modules/visual-learning/types";

export const metadata: Metadata = { title: "Laboratoire visuel · Modèle OSI" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VisualLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const originFlow = first(query.originFlow);
  const origin: VisualAttemptOrigin = originFlow ? {
    originFlow,
    originErrorPatternId: first(query.originErrorPatternId) ?? null,
    returnTo: first(query.returnTo) ?? null,
    remediationMethod: "VISUAL_RECONSTRUCTION",
  } : null;
  return <VisualLearningLab origin={origin} />;
}