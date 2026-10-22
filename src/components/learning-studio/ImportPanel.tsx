"use client";

import { useRef, useState } from "react";
import { Lock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importFile } from "@/modules/learning-studio/browser-library";
import { ImportError, titleFromFileName } from "@/modules/learning-studio/import";
import type { StudioDocType, StudioDocument } from "@/modules/learning-studio/types";

/** Imports the learner's own PDF / Markdown / text files; nothing leaves the device. */
export function ImportPanel({ onImported }: { onImported: (document: StudioDocument) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("Mes documents");
  const [docType, setDocType] = useState<StudioDocType>("COURS");
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setStatus({ tone: "info", text: `Lecture de « ${file.name} » sur cet appareil…` });
    try {
      const document = await importFile(file, { title: titleFromFileName(file.name), subjectLabel: subject, chapter: "", docType });
      const passages = document.pages.reduce((sum, page) => sum + page.passages.length, 0);
      setStatus({ tone: "info", text: `« ${document.title} » importé : ${document.pages.length} ${document.unit === "section" ? "section(s)" : "page(s)"}, ${passages} passages citables.` });
      onImported(document);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof ImportError ? error.message : "Import impossible." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium"><Upload className="h-4 w-4" aria-hidden="true" />Importer un cours</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="studio-import-subject" className="text-xs text-slate-500">Matière</label>
          <Input id="studio-import-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <label htmlFor="studio-import-type" className="text-xs text-slate-500">Type</label>
          <select id="studio-import-type" value={docType} onChange={(event) => setDocType(event.target.value as StudioDocType)}
            className="h-8 w-full rounded-md border bg-white px-2 text-sm">
            <option value="COURS">Cours</option><option value="TD">TD</option><option value="TP">TP</option><option value="TRANSCRIPTION">Transcription</option>
          </select>
        </div>
      </div>
      <input ref={input} type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain" className="hidden"
        aria-label="Fichier de cours à importer" onChange={(event) => void onFile(event.target.files?.[0])} />
      <Button type="button" size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Import en cours…" : "Choisir un PDF, .md ou .txt"}
      </Button>
      <p className="flex items-start gap-1 text-[11px] text-slate-500"><Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Lu et stocké uniquement sur cet appareil. PDF scannés non pris en charge (pas d’OCR).</p>
      {status && <p role={status.tone === "error" ? "alert" : "status"} className={`text-xs ${status.tone === "error" ? "text-red-700" : "text-emerald-800"}`}>{status.text}</p>}
    </div>
  );
}
