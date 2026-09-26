import { parseCanonicalEvent } from '../../../src/modules/learning-history/events';
import { parseSyncQueueJob } from '../../../src/modules/learning-history/sync-job';
import type { CanonicalEvent, DefinitionIdentity } from '../../../src/modules/learning-history/types';
export const uuid=(n:number)=>'00000000-0000-7000-8000-'+n.toString().padStart(12,'0');
export const definition={definitionId:uuid(800),definitionVersion:1,definitionHash:'sha256:'+'a'.repeat(64)} as DefinitionIdentity;
export const policy={version:1 as const,transferDefinitions:[definition],retrievalDefinitions:[definition],retentionDelayMs:86400000,reviewDelayMs:86400000};
export function event(n:number, type:CanonicalEvent['eventType']='EVIDENCE_CREATED', overrides:Record<string,unknown>={}):CanonicalEvent {
 const none={modes:['NONE'],hintCount:0,retryCount:0};
 const payload=type==='EVIDENCE_CREATED'?{evidenceId:uuid(1000+n),evidenceType:'TRANSFER',conceptIds:['concept'],competencyIds:['competency'],result:{status:'VALID',outcomeCode:'VALIDATED',criteria:[]},assistance:none,evidenceClassification:'SYNC_ALLOWED',artifactRefs:[],sourceRefs:[]}
 :type==='ERROR_OBSERVED'?{errorOccurrenceId:uuid(2000+n),evidenceId:uuid(1001),conceptIds:['concept'],competencyIds:['competency'],errorType:'PROCEDURAL',errorCode:'SYNTHETIC',severity:'LOW',context:{sourceRefs:[]}}
 :type==='REVIEW_COMPLETED'?{reviewResultId:uuid(3000+n),sourceEvidenceIds:[uuid(1001)],sourceErrorOccurrenceIds:[],conceptIds:['concept'],competencyIds:['competency'],outcome:'CORRECT',responseMode:'TEXT',durationMs:1000,confidence:4,assistance:none}
 :type==='MISSION_COMPLETED'?{missionRef:'synthetic-mission',completion:'COMPLETED',assistance:none}
 :type==='CONFIDENCE_RECORDED'?{subjectRef:'synthetic',subjectType:'ATTEMPT',value:3}
 :type==='DELETION_REQUESTED'?{targetType:'EVIDENCE',targetId:uuid(1001),scope:'LOCAL_AND_REMOTE',requestedBy:'LEARNER'}:{};
 return parseCanonicalEvent({id:uuid(n),schemaVersion:1,learnerRef:uuid(900),deviceRef:uuid(901),occurredAt:100,recordedAt:101,deviceLocalOrder:n,classification:'SYNC_ALLOWED',
 ...(type==='DELETION_REQUESTED'?{}:{definitionIdentity:definition,attemptId:uuid(4000+n)}),eventType:type,payload,...overrides});
}
export function job(e:CanonicalEvent) { return parseSyncQueueJob({id:uuid(100000+Number(e.id.slice(-6))),eventId:e.id,idempotencyKey:'sync-'+e.id,state:'PENDING',createdAt:101,attempts:0,classification:'SYNC_ALLOWED'}); }
