import Link from "next/link";
import { ArrowRight, CalendarClock, FileCheck2, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectSemesterRecommendations } from "@/modules/current-semester/core";
import { CURRENT_SEMESTER_STATE, SEMESTER_EXAM_MODES } from "@/modules/current-semester/registry";
import { currentSemesterBaselineSource, sourcesForSemesterCourse } from "@/modules/academic-workspace/source-index";

const priorityLabels = { P0: "Urgent", P1: "Prioritaire", P2: "À structurer", P3: "À maintenir" } as const;
const stateLabels = { CONFIRMED: "Cours confirmé", PARTIAL: "État partiel", SOURCE_COLLECTION_NEEDED: "Sources à collecter" } as const;
const emptySignals = { retrievalDueConceptIds: [], recentErrorConceptIds: [], assistanceDependentConceptIds: [], transferGapConceptIds: [] } as const;

function courseById(courseId: string) {
  return CURRENT_SEMESTER_STATE.courses.find((course) => course.id === courseId);
}

export function SemesterTodayCard() {
  const next = selectSemesterRecommendations(CURRENT_SEMESTER_STATE, { now: Date.now(), signals: emptySignals })[0];
  const course = next ? courseById(next.courseId) : undefined;
  const action = course?.backlog.find((item) => item.id === next?.backlogItemId);
  if (!course || !action) return null;
  const sourceCount = sourcesForSemesterCourse(course.id).length;
  return (
    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
      <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><Badge>{course.priority}</Badge><Badge variant="outline">Semestre actuel</Badge>{course.examDate ? <Badge variant="outline">Examen {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${course.examDate}T12:00:00`))}</Badge> : null}</div>
          <CardTitle className="text-xl">{course.title} · {action.label}</CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">La date et la priorité orientent l’ordre de travail. {sourceCount} sources classifiées fournissent le contexte; seules des preuves d’apprentissage peuvent faire évoluer la maîtrise.</p>
        </div>
        <Button asChild variant="outline"><Link href={`/semester#${course.slug}`}>Voir le contexte<ArrowRight aria-hidden="true" /></Link></Button>
      </CardHeader>
    </Card>
  );
}

export function SemesterContextBanner({ area }: { area: "LEARN" | "REVIEW" | "PROGRESS" | "EVIDENCE" }) {
  const messages = {
    LEARN: "Les parcours du semestre proposent un contexte de travail. Leur état déclaré ne vaut pas preuve de maîtrise.",
    REVIEW: "Les échéances du semestre orientent les révisions; les erreurs et rappels canoniques gardent la priorité pédagogique.",
    PROGRESS: "Les déclarations du semestre servent de baseline. Cette page n’affiche comme progression que les preuves enregistrées.",
    EVIDENCE: "Le semestre fournit le périmètre académique. Les preuves restent des événements distincts et traçables.",
  } as const;
  return <aside className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-slate-700"><strong className="text-slate-950">Semestre actuel.</strong> {messages[area]} {currentSemesterBaselineSource ? "La baseline locale est indexée." : "La baseline locale est manquante."} <Link href="/semester" className="font-semibold text-emerald-800 underline underline-offset-4">Consulter l’état académique</Link></aside>;
}

export function SemesterSubjectsOverview() {
  return (
    <section aria-labelledby="semester-subjects-heading" className="space-y-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">État déclaré du semestre</p><h2 id="semester-subjects-heading" className="mt-2 text-2xl font-semibold">Sept cours en cours</h2><p className="mt-2 text-sm text-slate-600">Ce registre décrit le périmètre actuel et reste séparé des contenus déjà validés par des sources.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{CURRENT_SEMESTER_STATE.courses.map((course) => {
        const currentCount = course.concepts.filter((concept) => concept.scope === "CURRENT_COURSE").length;
        const programmeCount = course.concepts.length - currentCount;
        const indexedSources = sourcesForSemesterCourse(course.id);
        return <Card id={course.slug} key={course.id} className="scroll-mt-24 border-slate-200 bg-white"><CardHeader className="space-y-3"><div className="flex flex-wrap gap-2"><Badge>{course.priority}</Badge><Badge variant="outline">{stateLabels[course.currentCourseState]}</Badge></div><CardTitle className="text-lg">{course.title}</CardTitle><p className="text-sm text-slate-500">{course.professor}</p></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><p>{currentCount} notions dans le cours actuel{programmeCount ? ` · ${programmeCount} au programme seulement` : ""}</p><p>{indexedSources.length} sources de bibliothèque reliées, avec leur classification conservée</p>{course.examDate ? <p className="font-medium text-slate-800">Examen : {course.examDate}</p> : null}<Button asChild variant="outline" size="sm"><Link href={`/semester#${course.slug}`}>Détails<ArrowRight aria-hidden="true" /></Link></Button></CardContent></Card>;
      })}</div>
    </section>
  );
}

export function SemesterExamModesCard() {
  return <section aria-labelledby="exam-modes-heading" className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Préparation ciblée</p><h2 id="exam-modes-heading" className="mt-2 text-2xl font-semibold">Modes examen Web et SQL</h2></div><div className="grid gap-4 lg:grid-cols-2">{SEMESTER_EXAM_MODES.map((mode) => <Card key={mode.id}><CardHeader><CardTitle className="text-lg">{mode.title}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-slate-600">{mode.activityTypes.join(" · ")}</p><p className="text-sm text-slate-600">{sourcesForSemesterCourse(mode.courseId).length} sources classifiées disponibles comme contexte.</p><p className="flex items-start gap-2 text-sm text-slate-700"><FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Réutilise l’historique canonique ELOS; toute maîtrise exige une preuve.</p></CardContent></Card>)}</div></section>;
}

export function CurrentSemesterWorkspace() {
  const baselineClaims = CURRENT_SEMESTER_STATE.courses.flatMap((course) => course.concepts.filter((concept) => concept.baselineClaim).map((concept) => ({ course, concept })));
  return <div className="space-y-8"><header className="space-y-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700"><GraduationCap className="size-4" aria-hidden="true" />Semestre actuel</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Licence Professionnelle Réseaux & Cybersécurité</h1><p className="max-w-3xl leading-7 text-slate-600">État académique actif 2026–2027, révision {CURRENT_SEMESTER_STATE.revision}. Source : CURRENT_SEMESTER_STATE.md, mise à jour le {CURRENT_SEMESTER_STATE.source.sourceUpdatedAt}. {currentSemesterBaselineSource ? "Baseline trouvée dans la bibliothèque locale." : "Baseline locale manquante."}</p></header><section aria-label="Échéances" className="grid gap-4 md:grid-cols-2">{CURRENT_SEMESTER_STATE.courses.filter((course) => course.examDate).map((course) => <Card key={course.id} className="border-amber-200"><CardHeader><p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><CalendarClock className="size-4" aria-hidden="true" />{course.priority} · {priorityLabels[course.priority]}</p><CardTitle>{course.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-700">Examen le {course.examDate}. {course.examNotes.join(" · ")}</p></CardContent></Card>)}</section><SemesterSubjectsOverview /><section aria-labelledby="baseline-heading" className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Baseline déclarée</p><h2 id="baseline-heading" className="mt-2 text-2xl font-semibold">Points à consolider sans présumer la maîtrise</h2></div><Card><CardContent className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">{baselineClaims.map(({ course, concept }) => <div key={concept.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-medium">{concept.label}</p><p className="mt-1 text-xs text-slate-500">{course.title} · {concept.baselineClaim}</p></div>)}</CardContent></Card></section><SemesterExamModesCard /></div>;
}
