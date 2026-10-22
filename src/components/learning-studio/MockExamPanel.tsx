"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { buildMockExam, gradeMockExam, type MockExam, type MockExamResult } from "@/modules/learning-studio/exam";
import type { Confidence, StudioCitation, StudioDocument, StudioQuizAttempt } from "@/modules/learning-studio/types";

const CONFIDENCE_LABEL: Record<Confidence, string> = { SURE: "Sûr", UNSURE: "Hésitant", GUESS: "Au hasard" };

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Timed, unassisted mock exam: no hints, no sources until the correction. */
export function MockExamPanel({ documents, onFinished, renderCitation, onActiveChange }: {
  documents: readonly StudioDocument[];
  onFinished: (attempt: StudioQuizAttempt) => void;
  renderCitation: (citation: StudioCitation) => React.ReactNode;
  onActiveChange: (active: boolean) => void;
}) {
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(20);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [exam, setExam] = useState<MockExam | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, Confidence>>({});
  const [result, setResult] = useState<MockExamResult | null>(null);

  useEffect(() => {
    if (!exam || result) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [exam, result]);

  const remaining = exam && startedAt ? exam.durationSeconds - Math.floor((now - startedAt.getTime()) / 1000) : 0;
  const timeUp = !!exam && !result && remaining <= 0;

  function start() {
    const created = buildMockExam(documents, count, Date.now() % 2_147_483_647, new Date(), { durationSeconds: minutes * 60, includeOpenResponses: includeOpen });
    setExam(created); setStartedAt(new Date()); setNow(Date.now());
    setAnswers({}); setConfidences({}); setResult(null);
    onActiveChange(true);
  }

  function submit() {
    if (!exam || !startedAt || result) return;
    const graded = gradeMockExam(exam, answers, confidences, startedAt, new Date());
    setResult(graded);
    onFinished(graded.attempt);
    onActiveChange(false);
  }

  if (!exam) {
    const available = Math.min(count, buildMockExam(documents, 50, 1, new Date(), { includeOpenResponses: includeOpen }).questions.length);
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4" aria-hidden="true" />Examen blanc</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">Chronométré, sans indice ni source jusqu’à la correction. Les questions alternent entre tes cours sélectionnés. Pour chaque réponse, indique ta confiance : la correction montre où tu te croyais sûr à tort.</p>
          <div className="flex items-center gap-2">
            <label htmlFor="exam-count">Questions</label>
            <select id="exam-count" value={count} onChange={(event) => setCount(Number(event.target.value))} className="h-8 rounded-md border bg-white px-2">
              {[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <span className="text-xs text-slate-500">{available} disponibles</span>
          </div>
          <label className="block" htmlFor="exam-duration">Durée (minutes)
            <select id="exam-duration" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="ml-2 rounded border p-1">
              {[5, 10, 20, 30, 60, 90, 120, 180].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeOpen} onChange={(event) => setIncludeOpen(event.target.checked)} />Inclure des réponses libres (validation humaine requise)</label>
          <p className="text-xs text-amber-800">Périmètre d’entraînement : sources sélectionnées. Ce choix ne confirme pas le programme officiel de l’examen.</p>
          <Button type="button" onClick={start} disabled={available < 2}>Commencer l’examen</Button>
          {available < 2 && <p className="text-amber-700">Sélectionne des sources contenant des définitions ou du code PHP/SQL pour générer des questions.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Examen blanc · {exam.questions.length} questions</CardTitle>
        {!result && <span role="timer" aria-live="off" className={`font-mono text-sm ${remaining < 60 ? "text-red-700" : "text-slate-700"}`}>{clock(remaining)}</span>}
      </CardHeader>
      <CardContent className="space-y-3">
        {timeUp && <p role="alert" className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">Temps écoulé : tes réponses sont figées.</p>}
        {exam.questions.map((question, index) => {
          const graded = result?.attempt.items.find((item) => item.questionId === question.id);
          return (
            <fieldset key={question.id} className={`space-y-1.5 rounded-lg border p-2 ${graded ? (graded.correct ? "border-green-300" : "border-red-300") : ""}`}>
              <legend className="px-1 text-sm font-medium">{index + 1}. {question.prompt}</legend>
              {question.responseType === "OPEN_RESPONSE" && <Textarea aria-label={`Réponse libre à la question ${index + 1}`}
                value={answers[question.id] ?? ""} disabled={!!result || timeUp}
                onChange={(event) => {
                  if (startedAt && Date.now() >= startedAt.getTime() + exam.durationSeconds * 1000) return;
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }));
                }} />}
              {question.choices.map((choice) => (
                <label key={choice} className={`flex items-center gap-2 text-sm ${result ? (choice === question.answer ? "font-medium text-green-700" : answers[question.id] === choice ? "text-red-700 line-through" : "") : ""}`}>
                  <input type="radio" name={`exam-${question.id}`} checked={answers[question.id] === choice} disabled={!!result || timeUp}
                    onChange={() => {
                      if (startedAt && Date.now() >= startedAt.getTime() + exam.durationSeconds * 1000) return;
                      setAnswers((current) => ({ ...current, [question.id]: choice }));
                    }} />{choice}
                </label>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600" role="radiogroup" aria-label={`Confiance pour la question ${index + 1}`}>
                Confiance :
                {(Object.keys(CONFIDENCE_LABEL) as Confidence[]).map((level) => (
                  <label key={level} className="flex items-center gap-1">
                    <input type="radio" name={`conf-${question.id}`} checked={confidences[question.id] === level} disabled={!!result || timeUp}
                      onChange={() => {
                        if (startedAt && Date.now() >= startedAt.getTime() + exam.durationSeconds * 1000) return;
                        setConfidences((current) => ({ ...current, [question.id]: level }));
                      }} />{CONFIDENCE_LABEL[level]}
                  </label>
                ))}
              </div>
              {result && <div className="space-y-1 text-sm">
                {question.responseType === "OPEN_RESPONSE" ? <p className="font-medium text-amber-800">En attente de validation humaine — aucune note attribuée.</p>
                  : <p>Réponse attendue : {question.answer}</p>}
                <blockquote className="border-l-2 pl-2 text-slate-600">{question.citations[0].quote}</blockquote>
                {question.responseType === "OPEN_RESPONSE" && <p className="text-xs">À vérifier : fidélité au passage, exemple pertinent, justification et absence de contradiction. Cet extrait est une référence, pas une correction automatique.</p>}
                {renderCitation(question.citations[0])}
              </div>}
            </fieldset>
          );
        })}

        {!result ? (
          <Button type="button" className="w-full" onClick={submit}>{timeUp ? "Voir la correction" : "Rendre la copie"}</Button>
        ) : (
          <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm" aria-live="polite">
            <p className="text-base font-semibold">QCM : {result.score}/{result.total}{result.unanswered > 0 && <span className="text-sm font-normal text-slate-600"> · {result.unanswered} sans réponse</span>}</p>
            {result.pending > 0 && <p>{result.pending} réponse(s) ouverte(s) en attente — exclues du score et des erreurs.</p>}
            <p className="text-xs text-slate-600">Durée : {clock(result.attempt.durationSeconds ?? 0)}{result.timedOut ? " (temps dépassé)" : ""}</p>
            <table className="w-full text-xs">
              <caption className="pb-1 text-left font-medium">Calibration de ta confiance</caption>
              <thead><tr className="text-left text-slate-500"><th>Confiance</th><th>Justes</th><th>Taux</th></tr></thead>
              <tbody>{result.calibration.filter((row) => row.total > 0).map((row) => (
                <tr key={row.confidence}><td>{CONFIDENCE_LABEL[row.confidence]}</td><td>{row.correct}/{row.total}</td><td>{Math.round((row.correct / row.total) * 100)} %</td></tr>
              ))}</tbody>
            </table>
            {result.overconfident.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sûr mais faux : {result.overconfident.join(", ")}. À revoir en priorité.</p>
            )}
            <p className="text-xs text-slate-500">Entraînement dérivé : ce résultat guide tes révisions mais n’attribue aucune maîtrise.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setExam(null)}>Nouvel examen</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
