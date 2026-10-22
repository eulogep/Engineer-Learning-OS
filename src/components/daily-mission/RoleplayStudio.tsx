"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, Square, Volume2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LocalTranscriptionPanel, useLocalTranscription } from "@/components/daily-mission/LocalTranscription";
import { ROLEPLAY_SCENARIOS, evaluateTurn, scenarioScore, type RoleplayScenario, type TurnFeedback } from "@/modules/daily-english/roleplay";

/** English voices that run on this device only (online voices would send the text out). */
function localEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const local = window.speechSynthesis.getVoices().filter((voice) => voice.localService && voice.lang.toLowerCase().startsWith("en"));
  return local.find((voice) => /en[-_](us|gb)/i.test(voice.lang)) ?? local[0] ?? null;
}

export function RoleplayStudio() {
  const [scenario, setScenario] = useState<RoleplayScenario | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<TurnFeedback[]>([]);
  const [current, setCurrent] = useState<TurnFeedback | null>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => localEnglishVoice());
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const asr = useLocalTranscription();

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => setVoice(localEnglishVoice());
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", pick); window.speechSynthesis.cancel(); };
  }, []);

  const turn = scenario?.turns[turnIndex] ?? null;
  const finished = !!scenario && turnIndex >= scenario.turns.length;

  function speak(text: string) {
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function start(next: RoleplayScenario) {
    setScenario(next); setTurnIndex(0); setFeedback([]); setCurrent(null); setAnswer("");
    speak(next.turns[0].interlocutor);
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream);
    media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      const text = await asr.transcribe(new Blob(chunks, { type: media.mimeType || "audio/webm" }));
      if (text) setAnswer((previous) => (previous ? `${previous} ${text}` : text));
    };
    recorder.current = media;
    media.start();
    setRecording(true);
  }

  function submit() {
    if (!turn || !answer.trim()) return;
    const result = evaluateTurn(turn, answer);
    setCurrent(result);
    setFeedback((list) => [...list, result]);
  }

  function next() {
    if (!scenario) return;
    const index = turnIndex + 1;
    setTurnIndex(index); setCurrent(null); setAnswer("");
    if (index < scenario.turns.length) speak(scenario.turns[index].interlocutor);
  }

  if (!scenario) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Daily English · conversation</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Jeux de rôle oraux</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Des situations professionnelles écrites à la main. Tu réponds à l’oral (transcription sur cet appareil) ou à l’écrit ; chaque réponse est vérifiée localement : objectif atteint, vocabulaire, erreurs fréquentes. Entraînement uniquement : aucune maîtrise n’est attribuée.</p>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          {ROLEPLAY_SCENARIOS.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">{item.title}<Badge variant="outline">{item.level}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>{item.context}</p>
                <Button type="button" size="sm" onClick={() => start(item)}>Commencer · {item.turns.length} répliques</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <Card>
        <CardHeader><CardTitle>{scenario.title} · bilan</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm" aria-live="polite">
          <p className="text-2xl font-semibold">{scenarioScore(feedback)} / 100</p>
          <ul className="space-y-1">{feedback.map((item, index) => (
            <li key={item.turnId}>Réplique {index + 1} : {item.score}/100 · {item.goals.filter((goal) => goal.met).length}/{item.goals.length} objectifs · {item.corrections.length} correction(s)</li>
          ))}</ul>
          <p className="text-xs text-slate-500">Entraînement dérivé : ce score guide ta pratique, il n’attribue aucune maîtrise.</p>
          <div className="flex gap-2"><Button type="button" onClick={() => start(scenario)}>Recommencer</Button><Button type="button" variant="outline" onClick={() => setScenario(null)}>Autre scénario</Button></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => setScenario(null)}>← Scénarios</Button>
        <Badge variant="secondary">{scenario.title} · réplique {turnIndex + 1}/{scenario.turns.length}</Badge>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-xs text-slate-500">{scenario.context}</p>
          <div className="rounded-xl bg-slate-100 p-3">
            <p lang="en" className="font-medium">{turn!.interlocutor}</p>
            {voice ? <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => speak(turn!.interlocutor)}><Volume2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Réécouter · voix locale {voice.name}</Button>
              : <p className="mt-1 text-xs text-slate-500">Aucune voix anglaise locale : lis la réplique.</p>}
          </div>
          <p className="text-sm"><span className="font-medium">Ta mission :</span> {turn!.task}</p>
          <LocalTranscriptionPanel asr={asr} purpose="production" />
          <label htmlFor="roleplay-answer" className="sr-only">Ta réponse en anglais</label>
          <Textarea id="roleplay-answer" lang="en" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={!!current || recording || asr.busy}
            placeholder="Réponds en anglais (à l’oral ou à l’écrit)…" className="min-h-24" />
          {!current && (
            <div className="flex flex-wrap gap-2">
              {asr.enabled && (
                <Button type="button" variant="outline" onClick={() => void toggleRecording()} disabled={asr.busy}>
                  {recording ? <><Square className="mr-1.5 h-4 w-4" aria-hidden="true" />Arrêter</> : <><Mic className="mr-1.5 h-4 w-4" aria-hidden="true" />Répondre à l’oral</>}
                </Button>
              )}
              <Button type="button" onClick={submit} disabled={!answer.trim() || recording || asr.busy}>Valider ma réponse</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card aria-live="polite">
          <CardContent className="space-y-3 pt-4 text-sm">
            <p className="font-semibold">Score : {current.score}/100</p>
            <ul className="space-y-1">{current.goals.map((goal) => (
              <li key={goal.label} className="flex items-center gap-1.5">{goal.met ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" /> : <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />}Objectif « {goal.label} » {goal.met ? "atteint" : "manquant"}</li>
            ))}</ul>
            <p className="text-xs text-slate-600">{current.words} mots · vocabulaire utilisé : {current.vocabularyUsed.length ? current.vocabularyUsed.join(", ") : "aucun"} (suggéré : {turn!.vocabulary.join(", ")})</p>
            {current.corrections.length > 0 && (
              <div className="rounded-md bg-amber-50 p-2">
                <p className="font-medium text-amber-900">Corrections</p>
                <ul className="mt-1 space-y-1 text-xs">{current.corrections.map((item, index) => <li key={index}><span className="line-through">{item.original}</span> → <b>{item.corrected}</b> : {item.explanation}</li>)}</ul>
                <p lang="en" className="mt-1 text-xs">Version corrigée : {current.correctedText}</p>
              </div>
            )}
            <p className="text-xs text-slate-600">Exemple de réponse : <span lang="en" className="italic">{turn!.modelAnswer}</span></p>
            <Button type="button" onClick={next}>{turnIndex + 1 < scenario.turns.length ? "Réplique suivante" : "Voir le bilan"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
