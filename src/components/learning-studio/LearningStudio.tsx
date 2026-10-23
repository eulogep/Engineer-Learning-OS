"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileText, HelpCircle, Lightbulb, Search, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { dayKey } from "@/modules/daily-english/local-mission";
import type { ReviewOutcome } from "@/modules/daily-english/spaced-review";
import {
  answerFromSources, citationLabel, deriveFlashcards, deriveQuiz, difficulties, feynmanFeedback, gradeQuiz, mindMap,
  rateCard, readStudioState, revisionPlan, revisionSheet, searchPassages, socraticPrompt, studioReviewEvents, verifyCitation, writeStudioState,
  type GroundedAnswer, type KeyValueStorage, type StudioState,
} from "@/modules/learning-studio/core";
import { SYNTHETIC_DOCUMENTS } from "@/modules/learning-studio/fixtures";
import { derivePrerequisites, remediationPath } from "@/modules/learning-studio/prerequisites";
import { MIN_PREDICTIONS, replaySchedulers } from "@/modules/scientific-pedagogy/replay";
import { deleteImportedDocument, listImportedDocuments } from "@/modules/learning-studio/browser-library";
import { ImportPanel } from "@/components/learning-studio/ImportPanel";
import { AcademicCataloguePanel } from "@/components/learning-studio/AcademicCataloguePanel";
import { PedagogicalBasePanel } from "@/components/learning-studio/PedagogicalBasePanel";
import { ListenButton } from "@/components/learning-studio/ListenButton";
import { AudioOverviewPlayer } from "@/components/learning-studio/AudioOverviewPlayer";
import { buildAudioOverview } from "@/modules/learning-studio/overview";
import { annotationStatus, annotationsFor, createAnnotation, readAnnotations, writeAnnotations, type Annotation } from "@/modules/learning-studio/annotations";
import { MockExamPanel } from "@/components/learning-studio/MockExamPanel";
import type { MindMapNode, SocraticPrompt, StudioCitation, StudioDocument } from "@/modules/learning-studio/types";

function storage(): KeyValueStorage | null {
  try { return window.localStorage; } catch { return null; }
}

type Focus = { documentId: string; pageNumber: number; passageId: string } | null;

function CitationChip({ citation, onOpen, documents }: { citation: StudioCitation; onOpen: (c: StudioCitation) => void; documents: readonly StudioDocument[] }) {
  const verified = verifyCitation(documents, citation);
  return (
    <button type="button" onClick={() => onOpen(citation)}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      aria-label={`Ouvrir la source : ${citationLabel(documents, citation)}${verified ? ", citation vérifiée" : ", citation non vérifiée"}`}>
      {verified ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3 text-red-600" aria-hidden="true" />}
      {citationLabel(documents, citation)}
    </button>
  );
}

function MindMapTree({ node, onOpen }: { node: MindMapNode; onOpen: (c: StudioCitation) => void }) {
  return (
    <li className="space-y-1">
      {node.citation ? <button type="button" className="text-left text-sm text-emerald-900 underline-offset-2 hover:underline" onClick={() => onOpen(node.citation!)}>{node.label}</button>
        : <span className="text-sm font-medium">{node.label}</span>}
      {node.children.length > 0 && <ul className="ml-4 space-y-1 border-l pl-3">{node.children.map((child) => <MindMapTree key={child.label} node={child} onOpen={onOpen} />)}</ul>}
    </li>
  );
}

export function LearningStudio() {
  const [imported, setImported] = useState<StudioDocument[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [selected, setSelected] = useState<string[]>(SYNTHETIC_DOCUMENTS.map((document) => document.id));
  const [center, setCenter] = useState<"TUTOR" | "EXAM">("TUTOR");
  const [examActive, setExamActive] = useState(false);
  const [openId, setOpenId] = useState(SYNTHETIC_DOCUMENTS[0].id);
  const [focus, setFocus] = useState<Focus>(null);
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"SOURCED" | "SOCRATIC">("SOURCED");
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [socratic, setSocratic] = useState<SocraticPrompt | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [attemptText, setAttemptText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [state, setState] = useState<StudioState>(() => readStudioState(storage()));
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => readAnnotations(storage()));
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);

  function saveAnnotations(next: Annotation[]) { setAnnotations(next); writeAnnotations(storage(), next); }

  useEffect(() => {
    let alive = true;
    listImportedDocuments().then((documents) => {
      if (!alive) return;
      setImported(documents);
      setSelected((list) => [...new Set([...list, ...documents.map((document) => document.id)])]);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const library = useMemo<readonly StudioDocument[]>(() => [...SYNTHETIC_DOCUMENTS, ...imported], [imported]);
  const visibleLibrary = library.filter((document) => (!subjectFilter || document.subjectId === subjectFilter)
    && (!chapterFilter || document.chapter === chapterFilter));
  const documents = useMemo(() => library.filter((document) => selected.includes(document.id)
    && (!subjectFilter || document.subjectId === subjectFilter) && (!chapterFilter || document.chapter === chapterFilter)),
  [library, selected, subjectFilter, chapterFilter]);
  const cards = useMemo(() => deriveFlashcards(documents), [documents]);
  const sheet = useMemo(() => revisionSheet(documents), [documents]);
  const quiz = useMemo(() => deriveQuiz(documents, 5), [documents]);
  const hits = useMemo(() => (query.trim() ? searchPassages(documents, query, 5) : []), [documents, query]);
  const openDocument = library.find((document) => document.id === openId) ?? SYNTHETIC_DOCUMENTS[0];
  const today = dayKey(new Date());
  const plan = useMemo(() => revisionPlan(cards.map((card) => card.id), state.reviews, today), [cards, state.reviews, today]);
  const allCards = useMemo(() => deriveFlashcards(library), [library]);
  const board = useMemo(() => difficulties(state.attempts, allCards), [state.attempts, allCards]);
  const relations = useMemo(() => derivePrerequisites(allCards), [allCards]);
  const replay = useMemo(() => replaySchedulers(studioReviewEvents(state)), [state]);
  const overview = useMemo(() => buildAudioOverview(documents), [documents]);
  const dueCards = cards.filter((card) => plan[0]?.due.includes(card.id));
  const currentCard = dueCards[cardIndex % Math.max(1, dueCards.length)];

  function persist(next: StudioState) { setState(next); writeStudioState(storage(), next); }

  function addImported(document: StudioDocument) {
    setImported((list) => list.some((item) => item.id === document.id) ? list : [...list, document]);
    setSelected((list) => [...new Set([...list, document.id])]);
    setSubjectFilter(document.subjectId); setChapterFilter("");
    setOpenId(document.id); setFocus(null);
  }

  async function removeImported(document: StudioDocument) {
    if (!window.confirm(`Supprimer « ${document.title} » de cet appareil ?`)) return;
    await deleteImportedDocument(document.id);
    setImported((list) => list.filter((item) => item.id !== document.id));
    setSelected((list) => list.filter((id) => id !== document.id));
    if (openId === document.id) setOpenId(SYNTHETIC_DOCUMENTS[0].id);
  }

  function open(citation: StudioCitation) {
    setOpenId(citation.documentId);
    setFocus({ documentId: citation.documentId, pageNumber: citation.pageNumber, passageId: citation.passageId });
    requestAnimationFrame(() => viewer.current?.querySelector(`[data-passage="${citation.documentId}:${citation.pageNumber}:${citation.passageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function ask() {
    if (!question.trim()) return;
    setHintLevel(0); setAttemptText(""); setExplanation("");
    if (mode === "SOCRATIC") {
      const prompt = socraticPrompt(documents, question);
      setSocratic(prompt); setAnswer(prompt ? null : answerFromSources(documents, question));
    }
    else { setAnswer(answerFromSources(documents, question)); setSocratic(null); }
  }

  function rate(outcome: ReviewOutcome) {
    if (!currentCard) return;
    persist(rateCard(state, currentCard.id, outcome, new Date(), today));
    setFlipped(false); setCardIndex((index) => index + 1);
  }

  function submitQuiz() {
    const attempt = gradeQuiz(quiz, quizAnswers, new Date(), false, `studio-quiz:${Date.now()}`);
    setQuizScore(attempt.items.filter((item) => item.correct).length);
    persist({ ...state, attempts: [...state.attempts, attempt] });
  }

  const feedback = explanation.trim() && answer?.studioCitations[0]
    ? feynmanFeedback(library.find((d) => d.id === answer.studioCitations[0].documentId)?.pages.find((p) => p.pageNumber === answer.studioCitations[0].pageNumber)?.passages.find((p) => p.id === answer.studioCitations[0].passageId)?.text ?? "", explanation)
    : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Learning Studio · prototype</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Étudier à partir de tes sources</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Chaque réponse et chaque outil cite le passage exact. Les activités du Studio sont de l’entraînement dérivé : elles n’attribuent jamais de maîtrise.</p>
        </div>
        <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />100 % local · aucune IA externe</Badge>
      </header>

      <div className={examActive ? "mx-auto max-w-3xl" : "grid gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,380px)]"}>
        {/* Library */}
        <aside aria-label="Bibliothèque de sources" className="space-y-4" hidden={examActive}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" aria-hidden="true" />Bibliothèque</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <label className="block text-xs">Matière
                <select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setChapterFilter(""); }} className="my-1 w-full rounded border p-2">
                  <option value="">Toutes les matières</option>
                  {[...new Map(library.map((document) => [document.subjectId, document.subjectLabel])).entries()].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs">Chapitre
                <select value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} className="my-1 w-full rounded border p-2">
                  <option value="">Tous les chapitres</option>
                  {[...new Set(library.filter((document) => !subjectFilter || document.subjectId === subjectFilter).map((document) => document.chapter))].filter(Boolean).map((chapter) => <option key={chapter}>{chapter}</option>)}
                </select>
              </label>
              {visibleLibrary.map((document) => (
                <div key={document.id} className={`rounded-lg border p-2 ${openId === document.id ? "border-emerald-400 bg-emerald-50/50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={selected.includes(document.id)} aria-label={`Utiliser « ${document.title} » comme source`}
                      onChange={(event) => setSelected((list) => event.target.checked ? [...list, document.id] : list.filter((id) => id !== document.id))} />
                    <button type="button" className="text-left" onClick={() => { setOpenId(document.id); setFocus(null); }}>
                      <span className="block text-sm font-medium">{document.title}</span>
                      <span className="text-xs text-slate-500">{document.subjectLabel} · {document.chapter} · {document.pages.length} p.</span>
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1 pl-6">
                    <Badge variant="secondary" className="text-[10px]">{document.docType}</Badge>
                    {document.synthetic ? <Badge variant="outline" className="text-[10px]">synthétique</Badge> : <Badge variant="outline" className="border-sky-300 text-[10px] text-sky-800">personnel · local</Badge>}
                    {!document.synthetic && (
                      <button type="button" onClick={() => void removeImported(document)} className="ml-auto rounded p-1 text-slate-400 hover:text-red-700" aria-label={`Supprimer « ${document.title} » de cet appareil`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">{documents.length} source(s) active(s) dans ce périmètre</p>
              <ImportPanel onImported={addImported} />
              <AcademicCataloguePanel documents={imported} onImported={addImported} />
              <PedagogicalBasePanel />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-4">
              <label htmlFor="studio-search" className="flex items-center gap-1.5 text-sm font-medium"><Search className="h-4 w-4" aria-hidden="true" />Rechercher dans les sources</label>
              <Input id="studio-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ex. masque de sous-réseau" />
              <ul className="space-y-1" aria-live="polite">
                {hits.map((hit) => (
                  <li key={`${hit.document.id}:${hit.page.pageNumber}:${hit.passage.id}`}>
                    <button type="button" className="w-full rounded-md p-2 text-left text-xs hover:bg-slate-50" onClick={() => open({ documentId: hit.document.id, pageNumber: hit.page.pageNumber, passageId: hit.passage.id, quote: hit.passage.text })}>
                      <span className="font-medium">{citationLabel(library, { documentId: hit.document.id, pageNumber: hit.page.pageNumber, passageId: hit.passage.id, quote: "" })}</span>
                      <span className="block text-slate-600">{hit.passage.text.slice(0, 110)}…</span>
                    </button>
                  </li>
                ))}
                {query.trim() && hits.length === 0 && <li className="text-xs text-slate-500">Aucun passage trouvé.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" aria-hidden="true" />{openDocument.title}</CardTitle>
              {(() => {
                const mine = annotations.filter((item) => item.documentId === openDocument.id).length;
                const orphans = annotations.filter((item) => annotationStatus(item, library) === "SOURCE_MISSING");
                return (
                  <p className="text-xs text-slate-500">
                    {mine} note{mine > 1 ? "s" : ""} sur ce document · stockées sur cet appareil
                    {orphans.length > 0 && <> · <button type="button" className="text-amber-700 underline" onClick={() => {
                      if (window.confirm(`${orphans.length} note(s) concernent un document supprimé. Les supprimer ?`)) saveAnnotations(annotations.filter((item) => !orphans.includes(item)));
                    }}>{orphans.length} note(s) orpheline(s)</button></>}
                  </p>
                );
              })()}
            </CardHeader>
            <CardContent ref={viewer} className="max-h-[28rem] space-y-3 overflow-y-auto">
              {openDocument.pages.map((page) => (
                <section key={page.pageNumber} aria-label={`Page ${page.pageNumber}`} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{openDocument.unit === "section" ? "Section" : "Page"} {page.pageNumber}{page.ocr && <span className="ml-2 rounded bg-amber-100 px-1 normal-case tracking-normal text-amber-900">texte reconnu par OCR · à vérifier</span>}</p>
                  {page.passages.map((passage) => {
                    const focused = focus?.documentId === openDocument.id && focus.pageNumber === page.pageNumber && focus.passageId === passage.id;
                    const key = `${openDocument.id}:${page.pageNumber}:${passage.id}`;
                    const notes = annotationsFor(annotations, openDocument.id, page.pageNumber, passage.id);
                    return (
                      <div key={passage.id} className="group">
                        <p data-passage={key}
                          className={`rounded-md p-1.5 text-sm leading-relaxed ${focused ? "bg-amber-100 ring-2 ring-amber-400" : notes.length ? "bg-sky-50 underline decoration-sky-400 decoration-2 underline-offset-4" : ""}`}>{passage.text}</p>
                        {notes.map((note) => (
                          <div key={note.id} className="ml-3 mt-1 flex items-start gap-2 rounded-md border-l-2 border-sky-400 bg-white px-2 py-1 text-xs text-slate-700">
                            <span className="flex-1"><span className="font-medium text-sky-800">Ma note :</span> {note.note}
                              {annotationStatus(note, library) === "SOURCE_CHANGED" && <span className="ml-1 text-amber-700">(le passage a changé)</span>}</span>
                            <button type="button" className="text-slate-400 hover:text-red-700" aria-label={`Supprimer la note « ${note.note.slice(0, 30)} »`}
                              onClick={() => saveAnnotations(annotations.filter((item) => item.id !== note.id))}><Trash2 className="h-3 w-3" aria-hidden="true" /></button>
                          </div>
                        ))}
                        {editing?.key === key ? (
                          <div className="ml-3 mt-1 space-y-1">
                            <label htmlFor={`note-${key}`} className="sr-only">Note sur ce passage</label>
                            <Textarea id={`note-${key}`} value={editing.text} autoFocus className="min-h-14 text-xs"
                              onChange={(event) => setEditing({ key, text: event.target.value })} />
                            <div className="flex gap-1">
                              <Button type="button" size="sm" className="h-7 text-xs" disabled={!editing.text.trim()} onClick={() => {
                                saveAnnotations([...annotations, createAnnotation(openDocument, page.pageNumber, passage.id, editing.text, new Date(), `note-${Date.now()}`)]);
                                setEditing(null);
                              }}>Enregistrer la note</Button>
                              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(null)}>Annuler</Button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setEditing({ key, text: "" })}
                            className="ml-1 text-[11px] text-slate-400 opacity-60 hover:text-sky-800 focus:opacity-100 group-hover:opacity-100"
                            aria-label={`Annoter le passage ${passage.id} de la page ${page.pageNumber}`}>+ annoter</button>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </CardContent>
          </Card>
        </aside>

        {/* Tutor */}
        <section aria-label="Professeur" className="order-first space-y-4 lg:order-none">
          <div role="tablist" aria-label="Mode d’étude" className="inline-flex rounded-lg border bg-white p-1">
            {([["TUTOR", "Professeur"], ["EXAM", "Examen blanc"]] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" disabled={examActive} aria-selected={center === value} onClick={() => setCenter(value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${center === value ? "bg-emerald-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>
            ))}
          </div>
          {center === "EXAM" ? (
            <MockExamPanel documents={documents} onActiveChange={setExamActive} onFinished={(attempt) => persist({ ...state, attempts: [...state.attempts, attempt] })}
              renderCitation={(citation) => <CitationChip citation={citation} onOpen={open} documents={library} />} />
          ) : <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Professeur</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div role="radiogroup" aria-label="Mode du professeur" className="flex flex-wrap gap-2">
                {([["SOURCED", "Réponse sourcée"], ["SOCRATIC", "Socratique : je réfléchis d’abord"]] as const).map(([value, label]) => (
                  <Button key={value} type="button" size="sm" role="radio" aria-checked={mode === value} variant={mode === value ? "default" : "outline"} onClick={() => setMode(value)}>{label}</Button>
                ))}
              </div>
              <label htmlFor="studio-question" className="sr-only">Ta question</label>
              <Textarea id="studio-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pose une question sur tes cours, ex. « Quelle est la différence entre TCP et UDP ? »" className="min-h-20"
                onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask(); }} />
              <Button type="button" onClick={ask} disabled={!question.trim() || selected.length === 0}>Demander</Button>
              {selected.length === 0 && <p className="text-sm text-amber-700">Sélectionne au moins une source.</p>}
            </CardContent>
          </Card>

          {answer && (
            <Card aria-live="polite">
              <CardContent className="space-y-3 pt-4">
                {answer.citations.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-medium">{answer.answer}</p><p className="mt-1 text-xs">{answer.uncertainty}</p>
                  </div>
                ) : (
                  <>
                    <p className="leading-relaxed">{answer.answer}</p>
                    <div className="flex flex-wrap gap-1.5">{answer.studioCitations.map((citation, i) => <CitationChip key={i} citation={citation} onOpen={open} documents={library} />)}</div>
                    <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                      <label htmlFor="studio-feynman" className="flex items-center gap-1.5 text-sm font-medium"><Lightbulb className="h-4 w-4" aria-hidden="true" />Méthode Feynman : explique-le avec tes mots, sans regarder</label>
                      <Textarea id="studio-feynman" value={explanation} onChange={(event) => setExplanation(event.target.value)} className="min-h-16 bg-white" />
                      {feedback && (
                        <p className="text-xs text-slate-700">Idées clés couvertes : <b>{feedback.covered.length}/{feedback.covered.length + feedback.missing.length}</b>
                          {feedback.missing.length > 0 && <> · à reprendre : {feedback.missing.join(", ")}</>}</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {socratic && (
            <Card aria-live="polite">
              <CardContent className="space-y-3 pt-4">
                <p className="flex items-start gap-2 font-medium"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />{socratic.question}</p>
                <label htmlFor="studio-attempt" className="sr-only">Ta réponse</label>
                <Textarea id="studio-attempt" value={attemptText} onChange={(event) => setAttemptText(event.target.value)} placeholder="Ta réponse, même incomplète…" className="min-h-16" />
                <div className="flex flex-wrap gap-2">
                  {socratic.hints.map((hint) => (
                    <Button key={hint.level} type="button" size="sm" variant="outline" disabled={hintLevel >= hint.level || hint.level > hintLevel + 1} onClick={() => setHintLevel(hint.level)}>Indice {hint.level}</Button>
                  ))}
                  <Button type="button" size="sm" onClick={() => { setAnswer(answerFromSources(documents, question)); setSocratic(null); }}>Voir la réponse sourcée</Button>
                </div>
                <ol className="space-y-1 text-sm text-slate-700">{socratic.hints.filter((hint) => hint.level <= hintLevel).map((hint) => <li key={hint.level}>💡 {hint.text}</li>)}</ol>
              </CardContent>
            </Card>
          )}
          </>}
        </section>

        {/* Tools */}
        <aside aria-label="Outils d’apprentissage" hidden={examActive}>
          <Card>
            <CardContent className="pt-4">
              <Tabs defaultValue="cards">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="sheet">Fiche</TabsTrigger>
                  <TabsTrigger value="cards">Cartes</TabsTrigger>
                  <TabsTrigger value="quiz">Quiz</TabsTrigger>
                  <TabsTrigger value="map">Schéma</TabsTrigger>
                  <TabsTrigger value="plan">Plan</TabsTrigger>
                  <TabsTrigger value="audio">Audio</TabsTrigger>
                </TabsList>

                <TabsContent value="sheet" className="max-h-[36rem] space-y-2 overflow-y-auto">
                  {sheet.length > 0 && <ListenButton label="Écouter la fiche" text={sheet.map((entry) => `${entry.term} : ${entry.definition}.`).join(" ")} />}
                  {sheet.map((entry) => (
                    <div key={`${entry.term}:${entry.citations[0].documentId}`} className="rounded-lg border p-2 text-sm">
                      <p><b>{entry.term}</b> {entry.definition}.</p>
                      <div className="mt-1"><CitationChip citation={entry.citations[0]} onOpen={open} documents={library} /></div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="cards" className="space-y-3">
                  <p className="text-xs text-slate-500">{dueCards.length} carte{dueCards.length > 1 ? "s" : ""} à réviser aujourd’hui</p>
                  {currentCard ? (
                    <div className="space-y-3">
                      <button type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Afficher le terme" : "Afficher la définition"}
                        className="flex min-h-36 w-full items-center justify-center rounded-xl border-2 border-dashed p-4 text-center hover:bg-slate-50">
                        {flipped ? <span className="text-sm">{currentCard.definition}.</span> : <span className="text-xl font-semibold">{currentCard.term}</span>}
                      </button>
                      {flipped && (
                        <div className="grid grid-cols-3 gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => rate("FAIL")}>Raté</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => rate("PARTIAL")}>Hésitant</Button>
                          <Button type="button" size="sm" onClick={() => rate("SUCCESS")}>Je savais</Button>
                        </div>
                      )}
                      <CitationChip citation={currentCard.citations[0]} onOpen={open} documents={library} />
                    </div>
                  ) : <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Toutes les cartes du jour sont révisées. Reviens demain.</p>}
                </TabsContent>

                <TabsContent value="quiz" className="space-y-3">
                  <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">Entraînement dérivé : ce quiz aide à réviser mais n’attribue aucune maîtrise.</p>
                  {quiz.map((item, index) => (
                    <fieldset key={item.id} className="space-y-1 rounded-lg border p-2">
                      <legend className="px-1 text-sm font-medium">{index + 1}. {item.prompt}</legend>
                      {item.choices.map((choice) => {
                        const chosen = quizAnswers[item.id] === choice;
                        const tone = quizScore === null ? "" : choice === item.answer ? "text-green-700 font-medium" : chosen ? "text-red-700 line-through" : "";
                        return (
                          <label key={choice} className={`flex items-center gap-2 text-sm ${tone}`}>
                            <input type="radio" name={item.id} value={choice} checked={chosen} disabled={quizScore !== null} onChange={() => setQuizAnswers((answers) => ({ ...answers, [item.id]: choice }))} />{choice}
                          </label>
                        );
                      })}
                      {quizScore !== null && <CitationChip citation={item.citations[0]} onOpen={open} documents={library} />}
                    </fieldset>
                  ))}
                  {quizScore === null
                    ? <Button type="button" className="w-full" disabled={Object.keys(quizAnswers).length < quiz.length} onClick={submitQuiz}>Valider le quiz</Button>
                    : <div className="flex items-center justify-between"><p className="font-semibold" aria-live="polite">Score : {quizScore}/{quiz.length}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setQuizAnswers({}); setQuizScore(null); }}>Recommencer</Button></div>}
                </TabsContent>

                <TabsContent value="map">
                  <ul className="space-y-2"><MindMapTree node={mindMap(openDocument)} onOpen={open} /></ul>
                </TabsContent>

                <TabsContent value="audio">
                  <AudioOverviewPlayer overview={overview} renderCitation={(citation) => <CitationChip citation={citation} onOpen={open} documents={library} />} />
                </TabsContent>

                <TabsContent value="plan" className="space-y-3">
                  <ul className="space-y-1 text-sm">
                    {plan.map((entry, index) => (
                      <li key={entry.day} className="flex justify-between rounded-md border px-2 py-1">
                        <span>{index === 0 ? "Aujourd’hui" : new Date(`${entry.day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}</span>
                        <span className="font-medium">{entry.due.length} carte{entry.due.length > 1 ? "s" : ""}</span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="text-sm font-medium">Difficultés</p>
                    {board.length === 0 ? <p className="text-xs text-slate-500">Aucune erreur enregistrée pour l’instant.</p>
                      : <ul className="mt-1 space-y-2 text-sm">{board.slice(0, 6).map((entry) => {
                        const path = remediationPath(entry.term, allCards, relations);
                        return (
                          <li key={entry.term} className="rounded-md border p-2">
                            <div className="flex justify-between"><span className="font-medium">{entry.term}</span><span className="text-red-700">{entry.errors}/{entry.attempts}</span></div>
                            {path.prerequisites.length > 0 && (
                              <div className="mt-1 text-xs text-slate-600">
                                Revois d’abord :{" "}
                                {path.prerequisites.map((step, index) => (
                                  <span key={step.term}>
                                    {index > 0 && " → "}
                                    {step.card ? <button type="button" className="text-emerald-800 underline-offset-2 hover:underline" onClick={() => open(step.card!.citations[0])}>{step.term}</button> : step.term}
                                  </span>
                                ))}
                              </div>
                            )}
                            {path.confusedWith.length > 0 && <p className="mt-1 text-xs text-amber-800">Souvent confondu avec : {path.confusedWith.join(", ")}</p>}
                          </li>
                        );
                      })}</ul>}
                    <p className="mt-2 text-[11px] text-slate-500">Prérequis déduits des définitions de tes cours : une piste de révision, pas une preuve de dépendance.</p>
                  </div>
                  <div className="rounded-lg border p-2 text-sm" aria-label="Comparaison des planificateurs">
                    <p className="font-medium">Planificateurs sur ton historique</p>
                    <fieldset className="mt-1 space-y-1 text-xs">
                      <legend className="sr-only">Planificateur des flashcards</legend>
                      {([["CURRENT_V1", "Leitner (actuel)"], ["FSRS_4_5", "FSRS-4.5 (expérimental)"]] as const).map(([value, label]) => (
                        <label key={value} className="mr-3 inline-flex items-center gap-1">
                          <input type="radio" name="studio-scheduler" checked={(state.scheduler ?? "CURRENT_V1") === value} onChange={() => persist({ ...state, scheduler: value })} />{label}
                        </label>
                      ))}
                      <p className="text-[11px] text-slate-500">S’applique aux prochaines notes de flashcards. FSRS a mieux prédit le rappel sur 6 historiques Anki publics ; à confirmer sur le tien.</p>
                    </fieldset>
                    {!replay.enough ? (
                      <p className="mt-1 text-xs text-slate-500">Pas encore assez d’historique : {replay.predictions}/{MIN_PREDICTIONS} révisions espacées d’au moins 12 h. Continue à réviser, la comparaison s’affichera ici.</p>
                    ) : (
                      <>
                        <table className="mt-1 w-full text-xs">
                          <thead><tr className="text-left text-slate-500"><th>Modèle</th><th>Log-loss</th><th>Brier</th><th>Prédit</th></tr></thead>
                          <tbody>{replay.scores.map((row) => (
                            <tr key={row.scheduler}><td>{row.scheduler === "CURRENT_V1" ? "Actuel (Leitner)" : "FSRS-4.5"}</td><td>{row.logLoss}</td><td>{row.brier}</td><td>{Math.round(row.meanPredicted * 100)} %</td></tr>
                          ))}</tbody>
                        </table>
                        <p className="mt-1 text-xs text-slate-600">Rappel observé : {Math.round(replay.scores[0].observedRecall * 100)} % sur {replay.predictions} révisions. Plus bas = meilleures prédictions.</p>
                      </>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">Compare des prédictions de mémoire, pas des résultats d’apprentissage. Rien n’est modifié automatiquement.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
