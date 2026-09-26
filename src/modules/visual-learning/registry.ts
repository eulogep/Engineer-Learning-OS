import { osiVisualReconstruction } from "./osi-model-definition";
import type { VisualTaskRegistryEntry } from "./types";

export const visualTaskRegistry: Record<string, VisualTaskRegistryEntry> = {
  OSI_TCPIP_RECONSTRUCTION: { definition: osiVisualReconstruction, status: "ACTIVE" },
};

export const networkEncapsulationSequenceDesign = {
  id: "NETWORK_ENCAPSULATION_SEQUENCE",
  status: "DESIGNED",
  taskType: "SEQUENCE",
  expectedOrder: ["MESSAGE", "SEGMENT", "PACKET_OR_DATAGRAM", "FRAME", "BITS"],
  conceptIds: ["NETWORK_ENCAPSULATION"],
  sourceIds: ["ACADEMIC-NETWORK-CH01-001"],
  sectionIds: ["SECTION-PDF-ENCAPSULATION"],
  pageReferences: [{ sourceId: "ACADEMIC-NETWORK-CH01-001", pageStart: 20, pageEnd: 20 }],
  evidencePolicy: "GUIDED_PRACTICE_ONLY",
  futureIndependentMode: "INDEPENDENT_VISUAL_TEST",
} as const;
