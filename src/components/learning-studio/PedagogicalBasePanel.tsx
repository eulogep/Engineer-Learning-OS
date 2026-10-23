"use client";

import { useState } from "react";
import { ImportError } from "@/modules/learning-studio/import";
import { auditPedagogicalBase, parsePedagogicalBase, type BaseChapter, type QualityReport } from "@/modules/learning-studio/pedagogical-base";

const STORAGE_KEY = "elos-pedagogical-base-v1";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Saved = Readonly<{ chapters: readonly BaseChapter[]; report: QualityReport; importedAt: string }>;

function readSaved(): Saved | null {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Saved | null; } catch { return null; }
}

/**
 * Imports a pedagogical base export (courses.json, exercises.json, flashcards.json) on this device.
 * Only the course map and the quality audit are kept; answer keys are not stored here.
 */
export function PedagogicalBasePanel() {
  const [saved, setSaved] = useState<Saved | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const [message, setMessage] = useState("");

  async function load(files: FileList | null) {
    if (!files?.length) return;
    setMessage("");
    try {
      const byName = new Map<string, unknown>();
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) throw new ImportError(`« ${file.name} » dépasse 5 Mo.`);
        byName.set(file.name.toLowerCase(), JSON.parse(await file.text()) as unknown);
      }
      if (!byName.has("courses.json")) throw new ImportError("Sélectionnez au moins courses.json (et si possible exercises.json et flashcards.json).");
      const base = parsePedagogicalBase({ courses: byName.get("courses.json"), exercises: byName.get("exercises.json"), flashcards: byName.get("flashcards.json") });
      const next: Saved = { chapters: base.chapters, report: auditPedagogicalBase(base), importedAt: new Date().toISOString() };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* kept for this session only */ }
      setSaved(next);
      setMessage(`${base.chapters.length} chapitres importés sur cet appareil.`);
    } catch (error) {
      setMessage(error instanceof ImportError ? error.message : "Fichiers illisibles : JSON attendu. Rien n’a été envoyé.");
    }
  }

  function forget() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
    setSaved(null); setMessage("Base pédagogique retirée de cet appareil.");
  }

  const subjects = saved ? [...new Set(saved.chapters.map((chapter) => chapter.subject))] : [];
  return <details className="rounded-lg border p-3 text-xs">
    <summary className="cursor-pointer font-medium">Base pédagogique (programme)</summary>
    <p className="my-2 text-slate-600">Synthèse générée, pas le cours officiel : utile pour s’orienter, à vérifier dans tes sources. Ne compte jamais comme maîtrise.</p>
    <label className="block">courses.json, exercises.json, flashcards.json
      <input type="file" multiple accept=".json,application/json" className="block w-full py-2"
        onChange={(event) => { void load(event.target.files); event.target.value = ""; }} />
    </label>
    {message && <p role="status" className="my-2">{message}</p>}
    {saved && <div className="space-y-3">
      <div>
        <p className="font-medium">Contrôle qualité</p>
        {saved.report.findings.length === 0 ? <p>Aucun problème détecté.</p> : <ul className="space-y-1">
          {saved.report.findings.map((finding) => <li key={finding.code} className={finding.severity === "BLOCKING" ? "text-red-800" : "text-amber-800"}>
            {finding.severity === "BLOCKING" ? "Bloquant" : "À vérifier"} · {finding.count}/{finding.total} — {finding.message}
          </li>)}
        </ul>}
        <p className="mt-1 text-slate-600">
          QCM {saved.report.usable.mcq ? "utilisables" : "écartés"} · exercices ouverts {saved.report.usable.openExercises ? "utilisables" : "écartés"} · cartes {saved.report.usable.flashcards ? "utilisables" : "écartées"}
        </p>
      </div>
      {subjects.map((subject) => <div key={subject}>
        <p className="font-medium">{subject}</p>
        <ul className="space-y-1">
          {saved.chapters.filter((chapter) => chapter.subject === subject).map((chapter) => <li key={chapter.id}>
            <details>
              <summary className="cursor-pointer">{chapter.title}</summary>
              <dl className="mt-1 space-y-1 pl-3">
                {chapter.objectives.length > 0 && <><dt className="font-medium">Objectifs</dt><dd>{chapter.objectives.join(" · ")}</dd></>}
                {chapter.concepts.length > 0 && <><dt className="font-medium">Notions</dt><dd>{chapter.concepts.map((concept) => concept.label).join(", ")}</dd></>}
                {chapter.example && <><dt className="font-medium">Exemple</dt><dd>{chapter.example}</dd></>}
                {chapter.analogy && <><dt className="font-medium">Analogie</dt><dd>{chapter.analogy}</dd></>}
                {chapter.mistakes && <><dt className="font-medium">Erreurs fréquentes</dt><dd>{chapter.mistakes}</dd></>}
              </dl>
            </details>
          </li>)}
        </ul>
      </div>)}
      <button type="button" onClick={forget} className="text-red-700 underline">Retirer de cet appareil</button>
    </div>}
  </details>;
}
