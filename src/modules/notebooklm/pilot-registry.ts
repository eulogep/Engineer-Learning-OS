import { academicWorkspaceRegistry } from "../academic-workspace/pilot-registry";
import { createNotebookLMTask } from "./core";
import { resolveNotebookLMPromptTemplate } from "./prompt-library";
import type { AuthorizedTransferManifest, NotebookLMSourceBundle, NotebookLMTask } from "./types";

export const networkingNotebookLMBundle: NotebookLMSourceBundle = {
  schemaVersion: 1,
  id: "NOTEBOOKLM-BUNDLE-NETWORKING-OSI-TCPIP",
  title: "OSI / TCP-IP Foundations",
  purpose: "Préparer un support sourcé sur les modèles réseau sans transférer automatiquement le cours.",
  sourceIds: ["ACADEMIC-NETWORK-CH01-001"],
  classification: "ACADEMIC_PERSONAL_USE",
  allowedExternalUse: "REQUIRES_EXPLICIT_LEARNER_APPROVAL",
  copyrightStatus: "UNKNOWN",
  authorizationStatus: "WAITING_FOR_APPROVAL",
  notes: ["Usage académique personnel uniquement.", "Le statut copyright est inconnu; l’approbation n’établit aucun droit de redistribution."],
};

export const notebookLMPilotSources = academicWorkspaceRegistry.sources.filter((source) => networkingNotebookLMBundle.sourceIds.includes(source.id));

export const notebookLMPilotTransferFiles = [{
  sourceId: "ACADEMIC-NETWORK-CH01-001",
  relativePath: "cours esiea/Reseau Informatique/cours/CH01_Introduction_INF3050.pdf",
  sha256: "61BA6E1C456D34BB098F125B1BCC6DC9A85C10C7E4E8F267BFB1A4F55F1C784B",
  sizeBytes: 2_746_793,
  classification: "ACADEMIC_PERSONAL_USE" as const,
}];

export const notebookLMPromptHashes: Record<string, string> = {
  "academic-study-guide-v1": "2C1175AD89A517BE17BDCAE5431B6907EB06BE271D11E17BB8F0AD915DAB1F7D",
  "academic-quiz-v1": "AF31273C7778B0FF5DD33CC68457351F416CE57656D82CEA8989119EE4990C93",
};

export function createPilotTransferManifest(task: NotebookLMTask): AuthorizedTransferManifest {
  if (!task.approvedAt) throw new Error("NOTEBOOKLM_PILOT_APPROVAL_REQUIRED");
  return { taskId: task.id, bundleId: networkingNotebookLMBundle.id, files: notebookLMPilotTransferFiles, approvedAt: task.approvedAt };
}

function pilotTask(id: string, promptTemplateId: string, taskType: "STUDY_GUIDE" | "QUIZ", purpose: string, followup: NotebookLMTask["activeFollowup"]): NotebookLMTask {
  const template = resolveNotebookLMPromptTemplate(promptTemplateId);
  if (!template) throw new Error(`NOTEBOOKLM_PROMPT_NOT_FOUND:${promptTemplateId}`);
  return createNotebookLMTask({
    id,
    taskType,
    sourceBundleId: networkingNotebookLMBundle.id,
    subjectId: "SUBJECT-NETWORKING",
    conceptIds: ["OSI_REFERENCE_MODEL", "TCP_IP_STACK", "LAYER_RESPONSIBILITIES", "NETWORK_ENCAPSULATION"],
    purpose,
    executionMode: "LEGACY_CONTROLLED",
    createdAt: "2026-08-24T00:00:00.000Z",
    promptTemplateId,
    preparedPrompt: template.body,
    activeFollowup: followup,
    notes: ["Exécution legacy contrôlée uniquement après approbation explicite du manifeste."],
  }, networkingNotebookLMBundle, notebookLMPilotSources);
}

export const notebookLMPilotTasks: NotebookLMTask[] = [
  pilotTask("NOTEBOOKLM-NETWORKING-STUDY-GUIDE", "academic-study-guide-v1", "STUDY_GUIDE", "Créer un guide d’étude sourcé sur OSI, TCP/IP et l’encapsulation.", { required: true, label: "Reconstruire les couches sans support", href: "/learn/visual-lab" }),
  pilotTask("NOTEBOOKLM-NETWORKING-QUIZ", "academic-quiz-v1", "QUIZ", "Préparer des questions sourcées à vérifier avant usage pédagogique.", { required: true, label: "Faire le quiz canonique du cours", href: "/subjects/networking/sources/ch01-introduction-inf3050#pdf-quiz" }),
];
