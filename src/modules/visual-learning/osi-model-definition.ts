import type { VisualClassification, VisualTaskDefinition } from "./types";

export const VISUAL_CLASSIFICATION_LABELS: Record<VisualClassification, string> = {
  TCP_IP_APPLICATION: "TCP/IP · Application",
  TCP_IP_TRANSPORT: "TCP/IP · Transport",
  TCP_IP_NETWORK: "TCP/IP · Réseau",
  TCP_IP_DATA_LINK: "TCP/IP · Liaison",
  TCP_IP_PHYSICAL: "TCP/IP · Physique",
};

export const osiVisualReconstruction = {
  id: "VISUAL-OSI-RECONSTRUCTION-001",
  version: 1,
  description: "Order the seven OSI layers, then map them to the TCP/IP stack.",
  subjectId: "networking",
  taskType: "VISUAL_RECONSTRUCTION",
  title: "Reconstruis le modèle OSI de mémoire",
  conceptIds: ["OSI_REFERENCE_MODEL", "TCP_IP_STACK", "LAYER_RESPONSIBILITIES"],
  sourceIds: ["ACADEMIC-NETWORK-CH01-001"],
  sectionIds: ["SECTION-PDF-REFERENCE-MODELS"],
  pageReferences: [{ sourceId: "ACADEMIC-NETWORK-CH01-001", pageStart: 17, pageEnd: 17 }],
  nodes: [
    { id: "application", type: "CONCEPT", label: "Application", conceptId: "OSI_REFERENCE_MODEL", metadata: { layer: "7" } },
    { id: "presentation", type: "CONCEPT", label: "Présentation", conceptId: "OSI_REFERENCE_MODEL", metadata: { layer: "6" } },
    { id: "session", type: "CONCEPT", label: "Session", conceptId: "OSI_REFERENCE_MODEL", metadata: { layer: "5" } },
    { id: "transport", type: "CONCEPT", label: "Transport", conceptId: "LAYER_RESPONSIBILITIES", metadata: { layer: "4" } },
    { id: "network", type: "CONCEPT", label: "Réseau", conceptId: "LAYER_RESPONSIBILITIES", metadata: { layer: "3" } },
    { id: "data-link", type: "CONCEPT", label: "Liaison de données", conceptId: "LAYER_RESPONSIBILITIES", metadata: { layer: "2" } },
    { id: "physical", type: "CONCEPT", label: "Physique", conceptId: "LAYER_RESPONSIBILITIES", metadata: { layer: "1" } },
  ],
  initialNodeOrder: ["network", "application", "physical", "session", "transport", "presentation", "data-link"],
  expectedNodeOrder: ["application", "presentation", "session", "transport", "network", "data-link", "physical"],
  expectedClassifications: {
    application: "TCP_IP_APPLICATION",
    presentation: "TCP_IP_APPLICATION",
    session: "TCP_IP_APPLICATION",
    transport: "TCP_IP_TRANSPORT",
    network: "TCP_IP_NETWORK",
    "data-link": "TCP_IP_DATA_LINK",
    physical: "TCP_IP_PHYSICAL",
  },
  classificationGroups: ["TCP_IP_APPLICATION", "TCP_IP_TRANSPORT", "TCP_IP_NETWORK", "TCP_IP_DATA_LINK", "TCP_IP_PHYSICAL"],
  hints: ["Start with the layers closest to the user, then move down toward physical transmission. Three OSI layers are grouped into the TCP/IP application layer."],
  evidencePolicy: "GUIDED_PRACTICE_ONLY",
  reviewMappings: {
    order: "OSI_LAYER_ORDER_CONFUSION",
    classification: "OSI_TCPIP_MAPPING_CONFUSION",
  },
} satisfies VisualTaskDefinition;
