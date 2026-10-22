import { analyzeProduction } from "./local-mission";
import type { FeedbackError } from "@/types";

/**
 * Immersive speaking scenarios. The dialogues are written by hand (not generated):
 * the interlocutor's lines are fixed, and each learner turn is checked locally for
 * the communicative goal (expected expressions), the target vocabulary and the
 * frequent errors already detected by the Daily English analyser. No external AI.
 */

export type RoleplayTurn = Readonly<{
  id: string;
  interlocutor: string;
  /** What the learner must achieve, in French. */
  task: string;
  /** Each group is one communicative function; any alternative in a group satisfies it. */
  expected: readonly Readonly<{ label: string; alternatives: readonly string[] }>[];
  vocabulary: readonly string[];
  minWords: number;
  modelAnswer: string;
}>;

export type RoleplayScenario = Readonly<{ id: string; title: string; context: string; level: "B1" | "B2"; turns: readonly RoleplayTurn[] }>;

export const ROLEPLAY_SCENARIOS: readonly RoleplayScenario[] = [
  {
    id: "standup", title: "Daily stand-up", level: "B1",
    context: "Tu es développeur dans une équipe réseau. Ta responsable lance la réunion quotidienne.",
    turns: [
      { id: "standup-1", interlocutor: "Good morning everyone. Let's start. What did you work on yesterday?",
        task: "Dis ce que tu as fait hier, au passé.",
        expected: [{ label: "parler d’hier", alternatives: ["yesterday", "last day"] }, { label: "action au passé", alternatives: ["i worked", "i fixed", "i configured", "i finished", "i tested", "i wrote", "i deployed", "i updated"] }],
        vocabulary: ["configure", "deploy", "troubleshoot", "update"], minWords: 10,
        modelAnswer: "Yesterday I configured the new switch and I tested the connection between the two offices." },
      { id: "standup-2", interlocutor: "Great. And what are you planning to do today?",
        task: "Annonce ton plan de la journée, au futur.",
        expected: [{ label: "aujourd’hui", alternatives: ["today", "this morning", "this afternoon"] }, { label: "futur", alternatives: ["i will", "i'll", "i am going to", "i'm going to", "i plan to"] }],
        vocabulary: ["deploy", "monitor", "document", "test"], minWords: 8,
        modelAnswer: "Today I am going to deploy the update and monitor the network during the afternoon." },
      { id: "standup-3", interlocutor: "Is anything blocking you?",
        task: "Signale un blocage et demande de l’aide.",
        expected: [{ label: "signaler un blocage", alternatives: ["blocked", "blocking", "stuck", "waiting for", "problem", "issue"] }, { label: "demander de l’aide", alternatives: ["could you", "can you", "can someone", "i need", "help"] }],
        vocabulary: ["access", "credentials", "permission"], minWords: 8,
        modelAnswer: "Yes, I am blocked because I am waiting for access to the server. Could you help me get the permission?" },
    ],
  },
  {
    id: "incident", title: "Incident report", level: "B2",
    context: "Une panne a touché le réseau ce matin. Ton responsable te demande un compte rendu.",
    turns: [
      { id: "incident-1", interlocutor: "I heard there was an outage this morning. What happened exactly?",
        task: "Décris la panne : quoi, quand, qui a été touché.",
        expected: [{ label: "décrire la panne", alternatives: ["outage", "down", "failed", "stopped working", "was not reachable", "unreachable"] }, { label: "moment", alternatives: ["at ", "this morning", "around", "for "] }],
        vocabulary: ["outage", "users", "server", "reachable"], minWords: 12,
        modelAnswer: "At nine o'clock the main router failed and the users were not able to reach the server for about one hour." },
      { id: "incident-2", interlocutor: "Do you know the root cause?",
        task: "Explique la cause, en restant prudent si elle n’est pas certaine.",
        expected: [{ label: "cause", alternatives: ["because", "caused by", "due to", "the cause", "root cause"] }, { label: "prudence", alternatives: ["i think", "probably", "it seems", "we believe", "might", "may"] }],
        vocabulary: ["configuration", "update", "failure"], minWords: 10,
        modelAnswer: "We think it was probably caused by a configuration error during the last update." },
      { id: "incident-3", interlocutor: "OK. What will you do to prevent this from happening again?",
        task: "Propose une action pour éviter que ça recommence.",
        expected: [{ label: "action future", alternatives: ["we will", "we'll", "i will", "i'll", "we are going to", "we should", "i suggest"] }, { label: "prévention", alternatives: ["prevent", "avoid", "backup", "redundancy", "monitor", "test", "rollback"] }],
        vocabulary: ["redundancy", "monitor", "rollback", "test"], minWords: 10,
        modelAnswer: "We will add redundancy on the core router and we will test every update before we deploy it." },
    ],
  },
  {
    id: "interview", title: "Apprenticeship interview", level: "B1",
    context: "Entretien en anglais pour une alternance en cybersécurité.",
    turns: [
      { id: "interview-1", interlocutor: "Thanks for coming. Could you introduce yourself briefly?",
        task: "Présente-toi : formation et intérêt pour le poste.",
        expected: [{ label: "formation", alternatives: ["student", "i study", "i am studying", "degree", "bachelor", "school"] }, { label: "intérêt", alternatives: ["interested in", "passionate", "i like", "i want to", "i would like"] }],
        vocabulary: ["apprenticeship", "cybersecurity", "network"], minWords: 15,
        modelAnswer: "I am a student in computer science and I am really interested in cybersecurity, so I would like to join your team as an apprentice." },
      { id: "interview-2", interlocutor: "Tell me about a technical project you are proud of.",
        task: "Décris un projet, ton rôle et le résultat.",
        expected: [{ label: "ton rôle", alternatives: ["i built", "i developed", "i configured", "i created", "i designed", "my role"] }, { label: "résultat", alternatives: ["result", "as a result", "finally", "it works", "we managed", "now"] }],
        vocabulary: ["project", "network", "secure"], minWords: 15,
        modelAnswer: "I built a small home network with a firewall and a VPN. As a result, I can now access my lab securely from anywhere." },
      { id: "interview-3", interlocutor: "What is your main weakness, and how are you working on it?",
        task: "Cite une faiblesse et ce que tu fais pour progresser.",
        expected: [{ label: "faiblesse", alternatives: ["weakness", "i struggle", "difficult", "not very good", "i need to improve"] }, { label: "progrès", alternatives: ["improve", "working on", "practice", "every day", "learning"] }],
        vocabulary: ["improve", "practice", "confident"], minWords: 12,
        modelAnswer: "My main weakness is speaking English in meetings, so I practice every day to improve and become more confident." },
    ],
  },
];

export type TurnFeedback = Readonly<{
  turnId: string;
  words: number;
  goals: readonly Readonly<{ label: string; met: boolean }>[];
  vocabularyUsed: readonly string[];
  corrections: readonly FeedbackError[];
  correctedText: string;
  /** 0–100: communicative goals (70) + enough development (15) + vocabulary (15). */
  score: number;
}>;

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

export function evaluateTurn(turn: RoleplayTurn, answer: string): TurnFeedback {
  const text = normalize(answer);
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const goals = turn.expected.map((group) => ({ label: group.label, met: group.alternatives.some((alternative) => text.includes(normalize(alternative))) }));
  const analysis = analyzeProduction(answer, turn.vocabulary.map((word) => ({ id: word, word })));
  const goalShare = goals.length ? goals.filter((goal) => goal.met).length / goals.length : 1;
  const score = Math.round(70 * goalShare + 15 * Math.min(1, words / turn.minWords) + 15 * Math.min(1, analysis.usedWordIds.length / 2));
  return { turnId: turn.id, words, goals, vocabularyUsed: analysis.usedWordIds, corrections: analysis.feedback.errors, correctedText: analysis.correctedText, score: words === 0 ? 0 : score };
}

export function scenarioScore(feedback: readonly TurnFeedback[]): number {
  return feedback.length ? Math.round(feedback.reduce((sum, item) => sum + item.score, 0) / feedback.length) : 0;
}
