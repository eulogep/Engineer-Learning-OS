import type { Metadata } from "next";
import { ReviewWorkspace } from "@/components/review-engine/ReviewWorkspace";
import { SemesterContextBanner } from "@/components/current-semester/CurrentSemesterViews";

export const metadata: Metadata = { title: "Réviser" };

export default function ReviewPage() {
  return <div className="space-y-6"><SemesterContextBanner area="REVIEW" /><ReviewWorkspace /></div>;
}
