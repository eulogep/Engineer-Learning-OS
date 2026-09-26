import { v7 as uuidv7 } from "uuid";

import type {
  AttemptId,
  CheckpointId,
  DefinitionId,
  DerivedArtifactId,
  DeviceId,
  ErrorOccurrenceId,
  EventId,
  EvidenceId,
  JobId,
  LearnerRef,
  ReviewResultId,
  TombstoneId,
} from "./types";

function createId<Id extends string>(): Id {
  return uuidv7() as Id;
}

export const createEventId = () => createId<EventId>();
export const createAttemptId = () => createId<AttemptId>();
export const createEvidenceId = () => createId<EvidenceId>();
export const createErrorOccurrenceId = () => createId<ErrorOccurrenceId>();
export const createReviewResultId = () => createId<ReviewResultId>();
export const createDefinitionId = () => createId<DefinitionId>();
export const createDeviceId = () => createId<DeviceId>();
export const createLearnerRef = () => createId<LearnerRef>();
export const createJobId = () => createId<JobId>();
export const createCheckpointId = () => createId<CheckpointId>();
export const createTombstoneId = () => createId<TombstoneId>();
export const createDerivedArtifactId = () => createId<DerivedArtifactId>();

