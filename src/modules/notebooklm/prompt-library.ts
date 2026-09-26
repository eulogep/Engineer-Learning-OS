import type { NotebookLMPromptTemplate } from "./types";

export const notebookLMPromptLibrary: NotebookLMPromptTemplate[] = [
  {
    id: "academic-study-guide-v1",
    taskType: "STUDY_GUIDE",
    title: "Guide d’étude académique sourcé",
    body: "À partir exclusivement des sources jointes, crée un guide d’étude concis sur les modèles OSI et TCP/IP. Sépare définitions, responsabilités des couches, encapsulation et confusions fréquentes. Cite la source et les pages pour chaque idée importante. Signale explicitement toute information non couverte par les sources. Termine par trois questions de restitution sans fournir les réponses.",
  },
  {
    id: "academic-quiz-v1",
    taskType: "QUIZ",
    title: "Quiz académique sourcé",
    body: "À partir exclusivement des sources jointes, crée un quiz sur les modèles OSI, TCP/IP et l’encapsulation. Chaque question doit avoir une réponse vérifiable, une référence de source et de page, et ne contenir aucune affirmation non soutenue. Produis des formulations variées et évite les doublons. Le résultat restera non vérifié jusqu’à validation dans Engineer Learning OS.",
  },
];

export function resolveNotebookLMPromptTemplate(id: string) {
  return notebookLMPromptLibrary.find((template) => template.id === id) ?? null;
}
