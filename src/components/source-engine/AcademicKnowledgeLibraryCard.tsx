import { BookMarked, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { academicSourceIndex, currentSemesterBaselineSource, missingLocalSources } from "@/modules/academic-workspace/source-index";

export function AcademicKnowledgeLibraryCard() {
  const localOnly = academicSourceIndex.sources.filter((source) => source.repositoryVisibility === "LOCAL_ONLY").length;
  const statuses = [...new Set(academicSourceIndex.sources.map((source) => source.status))];
  return <Card className="border-amber-200 bg-amber-50/50"><CardHeader className="space-y-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800"><BookMarked className="size-4" aria-hidden="true" />Bibliothèque académique locale</p><CardTitle>{academicSourceIndex.sources.length} sources indexées</CardTitle><div className="flex flex-wrap gap-2">{statuses.map((status) => <Badge key={status} variant="outline">{status}</Badge>)}</div></CardHeader><CardContent className="grid gap-4 text-sm text-slate-700 md:grid-cols-3"><div><p className="font-semibold text-slate-950">Baseline du semestre</p><p className="mt-1">{currentSemesterBaselineSource ? "Trouvée et reliée au semestre actuel" : "Manquante"}</p></div><div><p className="font-semibold text-slate-950">Sources locales protégées</p><p className="mt-1">{localOnly} fichiers exclus du versionnement</p></div><div><p className="flex items-center gap-2 font-semibold text-slate-950"><FileWarning className="size-4" aria-hidden="true" />Sources encore absentes</p><p className="mt-1">{missingLocalSources.length} entrées connues, jamais recréées artificiellement</p></div></CardContent></Card>;
}
