"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, GripVertical, Lightbulb, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVisualLearningStore } from "@/modules/visual-learning/browser-store";
import {
  osiVisualReconstruction,
  VISUAL_CLASSIFICATION_LABELS,
} from "@/modules/visual-learning/osi-model-definition";
import type {
  VisualAttemptOrigin,
  VisualClassification,
} from "@/modules/visual-learning/types";

const classificationOptions = Object.entries(VISUAL_CLASSIFICATION_LABELS) as Array<
  [VisualClassification, string]
>;

function SortableLayer({
  id,
  label,
  classification,
  incorrectOrder,
  incorrectClassification,
  disabled,
  onClassificationChange,
}: {
  id: string;
  label: string;
  classification?: VisualClassification;
  incorrectOrder: boolean;
  incorrectClassification: boolean;
  disabled: boolean;
  onClassificationChange: (value: VisualClassification) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const hasError = incorrectOrder || incorrectClassification;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`grid gap-3 rounded-xl border bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)] sm:items-center ${
        isDragging ? "z-10 border-cyan-500 opacity-80" : hasError ? "border-amber-400" : "border-slate-200"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="touch-none rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          aria-label={`Déplacer la couche ${label}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>
        <span className="font-medium text-slate-900">{label}</span>
      </div>
      <select
        aria-label={`Équivalent TCP/IP de ${label}`}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm ${incorrectClassification ? "border-amber-500" : "border-slate-300"}`}
        value={classification ?? ""}
        disabled={disabled}
        onChange={(event) => onClassificationChange(event.target.value as VisualClassification)}
      >
        <option value="">Choisir l’équivalent TCP/IP</option>
        {classificationOptions.map(([value, optionLabel]) => (
          <option key={value} value={value}>{optionLabel}</option>
        ))}
      </select>
    </li>
  );
}

export function VisualLearningLab({ origin = null }: { origin?: VisualAttemptOrigin }) {
  const definition = osiVisualReconstruction;
  const hydrated = useVisualLearningStore((state) => state.hydrated);
  const activeAttemptId = useVisualLearningStore((state) => state.activeAttemptId);
  const attempt = useVisualLearningStore((state) => state.activeAttemptId ? state.attempts[state.activeAttemptId] : null);
  const ensureAttempt = useVisualLearningStore((state) => state.ensureAttempt);
  const startNewAttempt = useVisualLearningStore((state) => state.startNewAttempt);
  const moveLayer = useVisualLearningStore((state) => state.moveLayer);
  const classifyLayer = useVisualLearningStore((state) => state.classifyLayer);
  const submitAttempt = useVisualLearningStore((state) => state.submit);
  const showHint = useVisualLearningStore((state) => state.showHint);
  const restartCurrent = useVisualLearningStore((state) => state.restartCurrent);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (hydrated) ensureAttempt(definition, origin);
  }, [definition, ensureAttempt, hydrated, origin]);

  if (!hydrated || !activeAttemptId || !attempt) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500">Restauration de la pratique visuelle locale?</div>;
  }

  const evaluation = attempt.lastEvaluation;
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));
  const completed = attempt.status === "COMPLETED";
  const hasRecordedErrors = attempt.errorObservations.length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) moveLayer(String(active.id), String(over.id));
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>Laboratoire visuel local</Badge>
          <Badge variant="outline">TRAINING_DERIVED</Badge>
          <Badge variant="outline">Sans IA</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{definition.title}</h1>
        <p className="max-w-3xl text-slate-600">
          Fais glisser les couches de la plus haute à la plus basse, puis associe chacune à la pile TCP/IP.
          Le résultat est évalué localement à partir d’une structure sémantique, pas d’une image.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Reconstruction OSI → TCP/IP</CardTitle>
            <span className="text-sm text-slate-500">{attempt.submissionCount} {attempt.submissionCount > 1 ? "essais" : "essai"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <DndContext
            id="visual-learning-osi-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={attempt.order} strategy={verticalListSortingStrategy}>
              <ol className="space-y-3">
                {attempt.order.map((id) => {
                  const node = nodeById.get(id)!;
                  return (
                    <SortableLayer
                      key={id}
                      id={id}
                      label={node.label}
                      classification={attempt.classifications[id]}
                      incorrectOrder={Boolean(evaluation?.incorrectOrderNodeIds.includes(id))}
                      incorrectClassification={Boolean(evaluation?.incorrectClassificationNodeIds.includes(id))}
                      disabled={completed}
                      onClassificationChange={(value) => classifyLayer(id, value)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>

          {attempt.hintsUsed > 0 && (
            <div className="flex gap-3 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950">
              <Lightbulb className="mt-0.5 size-5 shrink-0" />
              <p>Commence par les couches proches de l’utilisateur, puis descends vers la transmission physique. Trois couches OSI sont regroupées dans l’application TCP/IP.</p>
            </div>
          )}

          {evaluation && (
            <div className={`rounded-xl p-4 text-sm ${evaluation.correct ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
              <p className="flex items-center gap-2 font-semibold">
                {evaluation.correct && <CheckCircle2 className="size-5" />}
                {evaluation.correct ? "Reconstruction correcte." : "La structure doit encore être ajustée."}
              </p>
              {!evaluation.correct && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {!evaluation.orderCorrect && <li>Certaines couches ne sont pas dans l’ordre attendu.</li>}
                  {!evaluation.classificationsCorrect && <li>Certaines correspondances TCP/IP sont manquantes ou incorrectes.</li>}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button disabled={completed} onClick={() => submitAttempt(definition)}>Vérifier ma reconstruction</Button>
            <Button variant="outline" disabled={completed || attempt.hintsUsed > 0} onClick={() => showHint()}>
              <Lightbulb /> Voir un indice
            </Button>
            <Button variant="outline" disabled={completed} onClick={() => restartCurrent(definition)}><RotateCcw /> {evaluation ? "Réessayer" : "Recommencer"}</Button>
            {attempt.submissionCount > 0 && <Button variant="outline" asChild><Link href="/evidence">Voir la preuve</Link></Button>}
            {hasRecordedErrors && <Button variant="outline" asChild><Link href="/review">Réviser ce concept</Link></Button>}
            {completed && <Button onClick={() => startNewAttempt(definition, origin)}>Nouvelle tentative</Button>}
            {completed && attempt.origin?.returnTo && <Button variant="outline" asChild><Link href={attempt.origin.returnTo}>Retourner au parcours d’origine</Link></Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">Provenance</p>
          <p className="mt-2">Source dérivée locale : CH01_Introduction_INF3050.pdf · page 17 · section SECTION-PDF-REFERENCE-MODELS.</p>
        </div>
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p>Chaque soumission est conservée comme preuve locale guidée. Cette activité reste plafonnée à PRACTICED et ne constitue pas une démonstration autonome.</p>
        </div>
      </div>
    </div>
  );
}
