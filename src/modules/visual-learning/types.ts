export type VisualNodeType = "CONCEPT";
export type VisualTaskType = "ORDERING" | "MAPPING" | "SEQUENCE" | "CONCEPT_MAP" | "VISUAL_RECONSTRUCTION";

export type VisualNode = {
  id: string;
  type: VisualNodeType;
  label: string;
  conceptId: string;
  position: { x: number; y: number };
  metadata: Record<string, string>;
};

export type VisualEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
  direction: "DIRECTED" | "UNDIRECTED";
};

export type VisualClassification =
  | "TCP_IP_APPLICATION"
  | "TCP_IP_TRANSPORT"
  | "TCP_IP_NETWORK"
  | "TCP_IP_DATA_LINK"
  | "TCP_IP_PHYSICAL";

export type VisualTaskDefinition = {
  id: string;
  version: number;
  title: string;
  description: string;
  subjectId: string;
  taskType: VisualTaskType;
  conceptIds: string[];
  sourceIds: string[];
  sectionIds: string[];
  pageReferences: Array<{ sourceId: string; pageStart: number; pageEnd: number }>;
  nodes: Array<Omit<VisualNode, "position">>;
  initialNodeOrder: string[];
  expectedNodeOrder: string[];
  expectedClassifications: Record<string, VisualClassification>;
  classificationGroups: VisualClassification[];
  hints: string[];
  evidencePolicy: "GUIDED_PRACTICE_ONLY";
  reviewMappings: {
    order: "OSI_LAYER_ORDER_CONFUSION";
    classification: "OSI_TCPIP_MAPPING_CONFUSION";
  };
};

export type VisualSubmission = {
  taskId: string;
  nodes: VisualNode[];
  edges: VisualEdge[];
  classifications: Partial<Record<string, VisualClassification>>;
  hintsUsed: number;
  attempts: number;
};

export type VisualEvaluation = {
  correct: boolean;
  orderCorrect: boolean;
  classificationsCorrect: boolean;
  incorrectOrderNodeIds: string[];
  incorrectClassificationNodeIds: string[];
};

export type VisualEvidenceDraft = {
  taskId: string;
  conceptIds: string[];
  sourceIds: string[];
  responseFormat: "SEMANTIC_NODE_ORDER_AND_CLASSIFICATION";
  expectedStructure: {
    nodeOrder: string[];
    classifications: Record<string, VisualClassification>;
  };
  learnerStructure: VisualSubmission;
  hintsUsed: number;
  attempts: number;
  evaluation: VisualEvaluation;
  createdAt: number;
  evidencePolicy: "GUIDED_PRACTICE_ONLY";
};

export type VisualErrorKind = "ORDER" | "CLASSIFICATION";

export type VisualErrorObservation = {
  id: string;
  kind: VisualErrorKind;
  nodeIds: string[];
  observedAt: number;
  submissionNumber: number;
};

export type VisualAttemptOrigin = {
  originFlow: string;
  originErrorPatternId: string | null;
  returnTo: string | null;
  remediationMethod: "VISUAL_RECONSTRUCTION";
} | null;

export type VisualLearningAttempt = {
  id: string;
  taskId: string;
  taskVersion: number;
  status: "IN_PROGRESS" | "COMPLETED";
  order: string[];
  classifications: Partial<Record<string, VisualClassification>>;
  submissionCount: number;
  hintsUsed: number;
  errorObservations: VisualErrorObservation[];
  lastEvaluation: VisualEvaluation | null;
  origin: VisualAttemptOrigin;
  startedAt: number;
  completedAt: number | null;
  updatedAt: number;
};

export type VisualTaskRegistryEntry = {
  definition: VisualTaskDefinition;
  status: "ACTIVE" | "DESIGNED";
};
