"use client";

import { useEffect, useState } from "react";
import type { AcademicSourceIndex, AcademicSourceIndexEntry } from "@/modules/academic-workspace/types";
import { catalogueAvailability } from "@/modules/learning-studio/academic-catalogue";
import { importFile, readLocalCatalogue, saveLocalCatalogue } from "@/modules/learning-studio/browser-library";
import { ImportError, titleFromFileName } from "@/modules/learning-studio/import";
import type { StudioDocument } from "@/modules/learning-studio/types";

export function AcademicCataloguePanel({ documents, onImported }: {
  documents: readonly StudioDocument[]; onImported: (document: StudioDocument) => void;
}) {
  const [catalogue, setCatalogue] = useState<AcademicSourceIndex | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    readLocalCatalogue().then((value) => { if (alive) setCatalogue(value); })
      .catch(() => { if (alive) setMessage("Catalogue local illisible. Réimportez votre index ; les originaux restent conservés."); });
    return () => { alive = false; };
  }, []);

  async function load(file: File | undefined, source?: AcademicSourceIndexEntry) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (source) {
        const document = await importFile(file, { title: titleFromFileName(file.name), subjectLabel: source.course,
          chapter: "", docType: source.type === "TD" || source.type === "TP" || source.type === "TRANSCRIPTION" ? source.type : "COURS" }, source);
        onImported(document);
        setMessage("Original vérifié et relié. Périmètre d’examen non confirmé.");
      } else {
        if (file.size > 2 * 1024 * 1024) throw new ImportError("Index trop volumineux (2 Mo maximum).");
        setCatalogue(await saveLocalCatalogue(await file.text()));
        setMessage("Catalogue enregistré sur cet appareil. Sélectionnez les fichiers à relier.");
      }
    } catch (error) { setMessage(error instanceof ImportError ? error.message : "Lecture impossible. Aucun contenu n’a été envoyé."); }
    finally { setBusy(false); }
  }

  return <details className="rounded-lg border p-3 text-xs">
    <summary className="cursor-pointer font-medium">Catalogue académique local</summary>
    <p className="my-2 text-slate-600">Choisissez votre véritable AcademicSourceIndex, puis chaque original. Aucun accès automatique aux fichiers ni à ChatGPT.</p>
    <label className="block">Index JSON
      <input type="file" accept=".json,application/json" disabled={busy} className="block w-full py-2"
        onChange={(event) => { void load(event.target.files?.[0]); event.target.value = ""; }} />
    </label>
    {message && <p role="status" className="my-2">{message}</p>}
    {catalogue && <>
      <ul className="max-h-72 space-y-3 overflow-auto">
        {catalogueAvailability(catalogue, documents).map(({ source, available, allowed }) => <li key={source.id}>
          <p className="break-words font-medium">{source.id} · {source.course}</p>
          <p>{source.status} · {available ? "Original relié" : "Original non relié sur cet appareil"}</p>
          {allowed ? <label className="block">{available ? "Vérifier à nouveau l’original" : "Relier l’original"}
            <input type="file" disabled={busy} accept=".pdf,.md,.markdown,.txt" className="block w-full py-1"
              onChange={(event) => { void load(event.target.files?.[0], source); event.target.value = ""; }} />
          </label> : <p>Import bloqué : classification non autorisée.</p>}
        </li>)}
      </ul>
      {catalogue.missingButKnownInChatGPT.length > 0 && <div className="mt-3">
        <p className="font-medium">Signalées dans ChatGPT, absentes localement :</p>
        <ul>{catalogue.missingButKnownInChatGPT.map((name, index) => <li key={`${index}:${name}`} className="break-words">{name}</li>)}</ul>
      </div>}
    </>}
  </details>;
}
