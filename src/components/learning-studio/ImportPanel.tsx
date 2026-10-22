"use client";

import { useRef, useState } from "react";
import { Lock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importFile } from "@/modules/learning-studio/browser-library";
import { ImportError, OcrAvailableError, titleFromFileName } from "@/modules/learning-studio/import";
import type { StudioDocType, StudioDocument } from "@/modules/learning-studio/types";

/** Imports the learner's own PDF / Markdown / text files; nothing leaves the device. */
export function ImportPanel({ onImported }: { onImported: (document: StudioDocument) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("Mes documents");
  const [chapter, setChapter] = useState("");
  const [docType, setDocType] = useState<StudioDocType>("COURS");
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrCandidate, setOcrCandidate] = useState<File | null>(null);

  async function onFile(file: File | undefined, ocr = false) {
    if (!file) return;
    setBusy(true); setOcrCandidate(null);
    setStatus({ tone: "info", text: ocr ? "Reconnaissance de texte sur cet appareil…" : `Lecture de « ${file.name} » sur cet appareil…` });
    try {
      const document = await importFile(file, { title: titleFromFileName(file.name), subjectLabel: subject, chapter, docType }, undefined, {
        ocr,
        onOcrProgress: ({ page, total, ratio }) => setStatus({ tone: "info", text: `OCR sur cet appareil : page ${page}/${total} · ${Math.round(ratio * 100)} %` }),
      });
      const passages = document.pages.reduce((sum, page) => sum + page.passages.length, 0);
      const ocrPages = document.pages.filter((page) => page.ocr).length;
      setStatus({ tone: "info", text: `« ${document.title} » importé : ${document.pages.length} ${document.unit === "section" ? "section(s)" : "page(s)"}, ${passages} passages citables.${ocrPages ? ` ${ocrPages} page(s) lue(s) par OCR : vérifie les citations.` : ""}` });
      onImported(document);
    } catch (error) {
      if (error instanceof OcrAvailableError) setOcrCandidate(file);
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
      <label htmlFor="studio-import-chapter" className="block text-xs text-slate-500">Chapitre
        <Input id="studio-import-chapter" value={chapter} onChange={(event) => setChapter(event.target.value)} className="mt-1 h-8 text-sm" />
      </label>
      <input ref={input} type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain" className="hidden"
        aria-label="Fichier de cours à importer" onChange={(event) => void onFile(event.target.files?.[0])} />
      <Button type="button" size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Import en cours…" : "Choisir un PDF, .md ou .txt"}
      </Button>
      <p className="flex items-start gap-1 text-[11px] text-slate-500"><Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Lu et stocké uniquement sur cet appareil. PDF scannés : OCR local sur demande.</p>
      {ocrCandidate && !busy && (
        <Button type="button" size="sm" className="w-full" onClick={() => void onFile(ocrCandidate, true)}>Lancer l’OCR sur cet appareil</Button>
      )}
      {status && <p role={status.tone === "error" ? "alert" : "status"} className={`text-xs ${status.tone === "error" ? "text-red-700" : "text-emerald-800"}`}>{status.text}</p>}
    </div>
  );
}
