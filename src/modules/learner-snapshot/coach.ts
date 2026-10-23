import { VOCABULARY } from "../daily-english/vocabulary";
import { ROLEPLAY_SCENARIOS } from "../daily-english/roleplay";
import type { AgentPractice } from "./agent-practice";
import type { LearnerSnapshot } from "./core";

/**
 * Morning coach message built only from the learner snapshot and ELOS content,
 * without any model: deterministic, free, nothing sent to an AI provider.
 * Retrieval question first (recall before re-reading), then a short English
 * practice and the exam countdown.
 */

const STALE_MS = 24 * 3_600_000;

function dayIndex(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

export function buildMorningMessage(snapshot: LearnerSnapshot | null, now: Date): string {
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const lines = [`☀️ ELOS — ${date}`];
  if (!snapshot) {
    lines.push("", "Je ne trouve pas ton résumé ELOS. Ouvre l’app (Données → Agent local) pour le partager.");
    return lines.join("\n");
  }
  const today = snapshot.today;
  const index = dayIndex(today);
  if (now.getTime() - Date.parse(snapshot.generatedAt) > STALE_MS) {
    lines.push("⚠️ Résumé de plus de 24 h : ouvre ELOS pour le mettre à jour.");
  }
  lines.push(`🔥 Série Daily English : ${snapshot.dailyEnglish.streak} jour${snapshot.dailyEnglish.streak > 1 ? "s" : ""} · ${snapshot.dailyEnglish.wordsMastered}/${snapshot.dailyEnglish.totalWords} mots maîtrisés`);

  const cards = snapshot.studio.dueToday;
  const words = snapshot.dailyEnglish.dueWords;
  const workload = [cards.length ? `${cards.length} carte${cards.length > 1 ? "s" : ""} de cours` : null, words.length ? `${words.length} mot${words.length > 1 ? "s" : ""} d’anglais` : null].filter(Boolean);
  lines.push("", workload.length ? `📚 À réviser aujourd’hui : ${workload.join(" · ")}` : "📚 Rien de dû aujourd’hui : profites-en pour une mission Daily English.");

  const recall = snapshot.studio.difficulties[0]?.term ?? cards[index % Math.max(1, cards.length)]?.term ?? null;
  if (recall) lines.push(`❓ Rappel actif : sans regarder, que désigne « ${recall} » ? Vérifie ensuite dans le Studio.`);

  const word = VOCABULARY[((index % VOCABULARY.length) + VOCABULARY.length) % VOCABULARY.length];
  lines.push("", `🇬🇧 Mot du jour : ${word.word} (${word.translation})`, `   « ${word.example} »`);

  const scenario = ROLEPLAY_SCENARIOS[((index % ROLEPLAY_SCENARIOS.length) + ROLEPLAY_SCENARIOS.length) % ROLEPLAY_SCENARIOS.length];
  const turn = scenario.turns[0];
  lines.push(`🗣️ À l’oral (${scenario.title}) : « ${turn.interlocutor} »`, `   ${turn.task}`);

  const exam = snapshot.exams[0];
  if (exam) {
    const advice = exam.daysLeft <= 1 ? "révision légère + flashcards" : exam.daysLeft <= 3 ? "examen blanc chronométré" : exam.daysLeft <= 7 ? "rappel actif sur le cours dans le Studio" : "révisions espacées régulières";
    lines.push("", `🎯 ${exam.course} dans ${exam.daysLeft} jour${exam.daysLeft > 1 ? "s" : ""} : ${advice}.`);
  }
  lines.push("", "https://daily-english-mission-ten.vercel.app/studio");
  return lines.join("\n");
}

/**
 * Evening review built from the practice done with the agent (elos-practice.json):
 * what to redo before sleeping, retrieval first. Counts and chapter titles only.
 */
export function buildEveningMessage(practice: AgentPractice | null, now: Date): string {
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const lines = [`🌙 ELOS — révision du soir, ${date}`];
  const today = now.toISOString().slice(0, 10);
  const chapters = practice?.chapters ?? [];
  const practisedToday = chapters.filter((chapter) => chapter.lastAt.startsWith(today));
  const retry = chapters.filter((chapter) => chapter.toRetry > 0).sort((a, b) => b.toRetry - a.toRetry || b.lastAt.localeCompare(a.lastAt));

  if (practisedToday.length) {
    lines.push(`✅ Aujourd’hui : ${practisedToday.map((chapter) => chapter.title).join(", ")}.`);
  }
  if (retry.length) {
    lines.push("", "↩️ À refaire avant de dormir (un rappel le soir aide à retenir) :");
    for (const chapter of retry.slice(0, 3)) lines.push(`   • ${chapter.title} : ${chapter.toRetry} question${chapter.toRetry > 1 ? "s" : ""} ratée${chapter.toRetry > 1 ? "s" : ""}`);
    lines.push("", "Réponds « repose mes questions ratées » pour les refaire maintenant.");
  } else if (chapters.length) {
    lines.push("", "👏 Aucune question ratée en attente. Réponds « un QCM sur … » avec un chapitre pour avancer.");
  } else {
    lines.push("", "Pas encore d’entraînement avec moi. Réponds « quel est mon programme ? » puis « un QCM sur … » pour commencer.");
  }
  lines.push("", "C’est de l’entraînement : la maîtrise se prouve dans ELOS, sans aide.");
  return lines.join("\n");
}
