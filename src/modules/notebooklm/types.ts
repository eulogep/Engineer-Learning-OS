import type { DataClassification, DerivedArtifact, RightsStatus, SourceRecord } from "../source-engine/types";

export const NOTEBOOKLM_SCHEMA_VERSION = 1 as const;

export type NotebookLMExecutionMode = "MANUAL_ASSISTED" | "LEGACY_CONTROLLED" | "SEMI_AUTOMATED" | "OFFICIAL_CONNECTOR";
export type NotebookLMTaskType = "QUIZ" | "STUDY_GUIDE" | "SLIDES" | "AUDIO_GUIDE" | "VIDEO_GUIDE" | "SUMMARY" | "PROFESSIONAL_SCENARIO" | "CUSTOM";
export type NotebookLMTaskStatus = "DRAFT" | "WAITING_FOR_APPROVAL" | "READY" | "AUTOMATION_RUNNING" | "AUTOMATION_FAILED" | "HUMAN_LOGIN_REQUIRED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
export type NotebookLMAuthorizationStatus = "NOT_REQUIRED" | "WAITING_FOR_APPROVAL" | "HUMAN_APPROVED" | "BLOCKED";
export type ExternalUsePolicy = "ALLOWED" | "REQUIRES_EXPLICIT_LEARNER_APPROVAL" | "BLOCKED";

export type NotebookLMSourceBundle = {
  schemaVersion: typeof NOTEBOOKLM_SCHEMA_VERSION;
  id: string;
  title: string;
  purpose: string;
  sourceIds: string[];
  classification: DataClassification;
  allowedExternalUse: ExternalUsePolicy;
  copyrightStatus: RightsStatus;
  authorizationStatus: NotebookLMAuthorizationStatus;
  notes: string[];
};

export type AuthorizedTransferFile = {
  sourceId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  classification: DataClassification;
};

export type AuthorizedTransferManifest = {
  taskId: string;
  bundleId: string;
  files: readonly AuthorizedTransferFile[];
  approvedAt: string;
};

export type NotebookLMAutomationEventType =
  | "AUTOMATION_STARTED" | "AUTH_STATE_RESOLVED" | "NOTEBOOK_RESOLVED" | "SOURCE_ATTACHED"
  | "SOURCE_STATE_RESOLVED" | "SOURCE_CONFIRMED" | "PROMPT_SUBMITTED"
  | "ARTIFACT_REQUESTED" | "ARTIFACT_GENERATION_STARTED" | "ARTIFACT_READY"
  | "ARTIFACT_DISCOVERED" | "ARTIFACT_RECOVERED" | "ARTIFACT_REGISTERED"
  | "AUTOMATION_FAILED" | "HUMAN_LOGIN_REQUIRED"
  | "AUTOMATION_CANCELLED";

export type NotebookLMAutomationEvent = { type: NotebookLMAutomationEventType; at: string; detailCode?: string };
export type NotebookLMRecoveryMode = "METADATA_ONLY" | "TEXT_EXTRACT" | "STRUCTURED_EXTRACT" | "DOWNLOAD" | "PROVIDER_REFERENCE" | "EXPORT_REFERENCE";
export type NotebookLMQuizCandidate = {
  id: string;
  artifactId: string;
  question: string;
  choices: string[];
  answer: string | null;
  explanation: string | null;
  sourceRefs: string[];
  sourceBundleId: string;
  conceptIds: string[];
  verificationStatus: "DERIVED_UNVERIFIED";
  sourceSupport: "PROVIDER_CITED" | "UNVERIFIED";
  validForActiveQuiz: boolean;
  diagnostics: string[];
};

export type NotebookLMAutomationPlan = {
  schemaVersion: typeof NOTEBOOKLM_SCHEMA_VERSION;
  id: string;
  taskId: string;
  sourceBundleId: string;
  destination: "NOTEBOOKLM";
  providerId: string;
  notebookTitle: string;
  artifactType: "STUDY_GUIDE" | "QUIZ";
  resolvedPrompt: string;
  promptTemplateId: string;
  promptHash: string;
  manifest: AuthorizedTransferManifest;
  createdAt: string;
  forceNewArtifact: boolean;
};

export type NotebookLMProviderResult = {
  status: "SUCCESS" | "AUTOMATION_FAILED" | "HUMAN_LOGIN_REQUIRED" | "CANCELLED";
  detailCode?: string;
  providerNotebookRef?: string;
  providerArtifactRef?: string;
  title?: string;
  recoveryMode?: NotebookLMRecoveryMode;
  events?: NotebookLMAutomationEvent[];
  artifact?: {
    title: string;
    providerArtifactRef: string;
    recoveryMode: NotebookLMRecoveryMode;
    recoveredContent?: string | null;
  };
};

export type NotebookLMTask = {
  schemaVersion: typeof NOTEBOOKLM_SCHEMA_VERSION;
  id: string;
  taskType: NotebookLMTaskType;
  sourceBundleId: string;
  subjectId: string;
  conceptIds: string[];
  purpose: string;
  executionMode: NotebookLMExecutionMode;
  authorizationStatus: NotebookLMAuthorizationStatus;
  createdAt: string;
  status: NotebookLMTaskStatus;
  promptTemplateId: string;
  preparedPrompt: string;
  externalUseApproved: boolean;
  artifactIds: string[];
  activeFollowup: { required: true; label: string; href: string };
  approvedAt?: string;
  automationPlanId?: string;
  automationEvents?: NotebookLMAutomationEvent[];
  automationFailure?: string | null;
  forceNewArtifact?: boolean;
  notes: string[];
};

type NotebookLMArtifactOverrides = {
  type: NotebookLMTaskType;
  sourceBundleId: string;
  generationMethod: "NOTEBOOKLM";
  verificationStatus: "UNVERIFIED";
  externalProvider: "NOTEBOOKLM";
  providerNotebookRef?: string | null;
  providerArtifactRef?: string | null;
  promptTemplateId?: string;
  recoveryMode?: NotebookLMRecoveryMode;
  recoveredContent?: string | null;
  quizCandidates?: NotebookLMQuizCandidate[];
  quizDiagnostics?: string[];
  notes: string[];
};

export type NotebookLMDerivedArtifact = Omit<DerivedArtifact, keyof NotebookLMArtifactOverrides> & NotebookLMArtifactOverrides;

export type NotebookLMPromptTemplate = {
  id: string;
  taskType: NotebookLMTaskType;
  title: string;
  body: string;
};

export type BundleAuthorizationResult = {
  allowed: boolean;
  requiresExplicitApproval: boolean;
  reasons: string[];
  sources: SourceRecord[];
};

export type NotebookLMStateSnapshot = {
  schemaVersion: typeof NOTEBOOKLM_SCHEMA_VERSION;
  tasks: Record<string, NotebookLMTask>;
  artifacts: Record<string, NotebookLMDerivedArtifact>;
};

export type ImportedNotebookLMQuestion = {
  id: string;
  prompt: string;
  choices?: string[];
  answer: string;
  artifactId: string;
  sourceBundleId: string;
  sourceIds: string[];
  conceptIds: string[];
  verificationStatus: "DERIVED_UNVERIFIED";
  sourceSupportConfirmed: boolean;
};

export interface NotebookLMProvider {
  readonly id: string;
  readonly mode: NotebookLMExecutionMode;
  prepareTask(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  ensureNotebook(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  attachSources(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  submitPrompt(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  requestArtifact(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  waitForArtifact(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  listArtifacts(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult[]>;
  recoverArtifact(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  cancel(plan: NotebookLMAutomationPlan): Promise<NotebookLMProviderResult>;
  cleanup(plan: NotebookLMAutomationPlan): Promise<void>;
}
