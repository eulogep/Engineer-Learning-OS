import { parseCanonicalEvent } from '../events';
import { validateDefinitionIdentity } from '../definitions';
import { RepositoryInvariantError } from '../repository-errors';
import { stableJson, sha256 } from '../export/integrity';
import type { CanonicalEvent, DefinitionIdentity, AssistanceProvenance } from '../types';
import type { CanonicalHistoryRepository } from '../repository';

export const PROJECTION_VERSION = 1;
export type ProjectionPolicy = Readonly<{
  version: 1;
  transferDefinitions: readonly DefinitionIdentity[];
  retrievalDefinitions: readonly DefinitionIdentity[];
  retentionDelayMs: number;
  reviewDelayMs: number;
}>;
export type CompetencyStateProjection = Readonly<{ competencyId: string; state: 'PRACTICED'|'DEMONSTRATED'|'RETAINED'; evidenceIds: readonly string[] }>;
export type ErrorPatternProjection = Readonly<{ conceptId: string; errorCode: string; occurrenceIds: readonly string[]; count: number }>;
export type ReviewScheduleProjection = Readonly<{ evidenceId: string; dueAt: number; sourceEventIds: readonly string[] }>;
export type ProgressProjection = Readonly<{ significantAttempts: number; completedMissions: number; evidenceCount: number; reviewCount: number }>;
export type ProjectionSnapshot = Readonly<{
  version: 1; policyDigest: string; sourceDigest: string;
  competencies: readonly CompetencyStateProjection[]; errors: readonly ErrorPatternProjection[];
  reviews: readonly ReviewScheduleProjection[]; progress: ProgressProjection; digest: string;
}>;

function autonomous(a: AssistanceProvenance): boolean {
  return a.modes.length===1 && a.modes[0]==='NONE' && a.hintCount===0 && a.retryCount===0;
}
function references(event: CanonicalEvent): string[] {
  const refs=['EVENT:'+event.id];
  if(event.eventType==='DELETION_REQUESTED') return refs;
  refs.push('ATTEMPT:'+event.attemptId);
  if(event.eventType==='EVIDENCE_CREATED') {
    refs.push('EVIDENCE:'+event.payload.evidenceId);
    for(const ref of [...event.payload.sourceRefs,...event.payload.artifactRefs]) refs.push('SOURCE_METADATA:'+ref.referenceId,'DERIVED_ARTIFACT:'+ref.referenceId);
  }
  if(event.eventType==='ATTEMPT_ANSWERED') refs.push('DERIVED_ARTIFACT:'+event.payload.responseRef.referenceId);
  if(event.eventType==='ERROR_OBSERVED') {
    if(event.payload.evidenceId) refs.push('EVIDENCE:'+event.payload.evidenceId);
    for(const ref of event.payload.context.sourceRefs) refs.push('SOURCE_METADATA:'+ref.referenceId);
  }
  if(event.eventType==='REVIEW_COMPLETED') refs.push('REVIEW_RESULT:'+event.payload.reviewResultId,...event.payload.sourceEvidenceIds.map(id=>'EVIDENCE:'+id));
  return refs;
}

/** Append order/UUID order never decide pedagogical authority. Deletion dominates every arrival order. */
export function effectiveHistory(input: readonly CanonicalEvent[]): CanonicalEvent[] {
  const byId=new Map<string,CanonicalEvent>();
  for(const raw of input) {
    const event=parseCanonicalEvent(raw), previous=byId.get(event.id);
    if(previous && stableJson(previous)!==stableJson(event)) throw new RepositoryInvariantError('Conflicting canonical identity.');
    byId.set(event.id,event);
  }
  const events=[...byId.values()];
  if(new Set(events.map(e=>e.learnerRef)).size>1) throw new RepositoryInvariantError('Projection requires one learner scope.');
  const deleted=new Set(events.flatMap(e=>e.eventType==='DELETION_REQUESTED'?[e.payload.targetType+':'+e.payload.targetId]:[]));
  // Cascading evidence removal also suppresses dependent reviews/errors.
  for(const e of events) if(e.eventType==='EVIDENCE_CREATED' && references(e).some(r=>deleted.has(r))) deleted.add('EVIDENCE:'+e.payload.evidenceId);
  const result=events.filter(e=>e.eventType!=='DELETION_REQUESTED' && !references(e).some(r=>deleted.has(r)));
  const errors=new Set(result.filter(e=>e.eventType==='ERROR_OBSERVED').map(e=>e.payload.errorOccurrenceId));
  return result.filter(e=>e.eventType!=='REVIEW_COMPLETED' || e.payload.sourceErrorOccurrenceIds.every(id=>errors.has(id)));
}

export async function rebuildProjections(input: readonly CanonicalEvent[], policy: ProjectionPolicy): Promise<ProjectionSnapshot> {
  if(policy.version!==1 || !Number.isSafeInteger(policy.retentionDelayMs) || policy.retentionDelayMs<86400000
    || !Number.isSafeInteger(policy.reviewDelayMs) || policy.reviewDelayMs<0) throw new RepositoryInvariantError('Unsupported projection policy.');
  const trusted=(values:readonly DefinitionIdentity[])=>new Set(values.map(v=>stableJson(validateDefinitionIdentity(v))));
  const transfers=trusted(policy.transferDefinitions), retrievals=trusted(policy.retrievalDefinitions);
  const events=effectiveHistory(input);
  const evidence=events.filter(e=>e.eventType==='EVIDENCE_CREATED');
  const reviews=events.filter(e=>e.eventType==='REVIEW_COMPLETED');
  const errors=events.filter(e=>e.eventType==='ERROR_OBSERVED');
  // Identity conflicts fail closed even if the envelopes have distinct EventIds.
  for(const ids of [evidence.map(e=>e.payload.evidenceId),errors.map(e=>e.payload.errorOccurrenceId),reviews.map(e=>e.payload.reviewResultId)]) {
    if(new Set<string>(ids).size!==ids.length) throw new RepositoryInvariantError('Conflicting pedagogical identity.');
  }
  const competency=new Map<string,{rank:number; evidenceIds:Set<string>}>();
  for(const e of evidence) {
    if(e.payload.result.status!=='VALID' || e.payload.result.criteria.some(c=>c.status!=='VALID')) continue;
    if(e.payload.assistance.modes.includes('FULL_SOLUTION') || e.payload.assistance.modes.includes('EXTERNAL_AI')) continue;
    if(e.payload.evidenceType==='NOTEBOOKLM_ARTIFACT') continue;
    const demonstrated=transfers.has(stableJson(e.definitionIdentity)) && autonomous(e.payload.assistance);
    // Same-device elapsed evidence avoids treating cross-device wall-clock skew as retention proof.
    const retained=demonstrated && reviews.some(r=>retrievals.has(stableJson(r.definitionIdentity))
      && r.payload.sourceEvidenceIds.includes(e.payload.evidenceId) && r.payload.outcome==='CORRECT'
      && autonomous(r.payload.assistance) && r.deviceRef===e.deviceRef
      && r.occurredAt-e.occurredAt>=policy.retentionDelayMs);
    for(const id of e.payload.competencyIds) {
      const item=competency.get(id)??{rank:0,evidenceIds:new Set<string>()};
      item.rank=Math.max(item.rank,retained?3:demonstrated?2:1); item.evidenceIds.add(e.payload.evidenceId); competency.set(id,item);
    }
  }
  const patterns=new Map<string,{conceptId:string;errorCode:string;ids:Set<string>}>();
  for(const e of errors) for(const conceptId of e.payload.conceptIds) {
    const key=stableJson([conceptId,e.payload.errorCode]);
    const item=patterns.get(key)??{conceptId,errorCode:e.payload.errorCode,ids:new Set<string>()};
    item.ids.add(e.payload.errorOccurrenceId); patterns.set(key,item);
  }
  const schedule:ReviewScheduleProjection[]=evidence.map(e=>{
    const linked=[...reviews.filter(r=>r.payload.sourceEvidenceIds.includes(e.payload.evidenceId)),...errors.filter(r=>r.payload.evidenceId===e.payload.evidenceId)];
    const last=Math.max(e.occurredAt,...linked.map(r=>r.occurredAt));
    const dueAt=last+policy.reviewDelayMs;
    if(!Number.isSafeInteger(dueAt)) throw new RepositoryInvariantError('Review time overflow.');
    return {evidenceId:e.payload.evidenceId,dueAt,sourceEventIds:[e.id,...linked.map(r=>r.id)].sort()};
  });
  const normalizedPolicy={...policy,transferDefinitions:[...transfers].sort(),retrievalDefinitions:[...retrievals].sort()};
  const content={version:PROJECTION_VERSION,policyDigest:await sha256(stableJson(normalizedPolicy)),
    sourceDigest:await sha256(stableJson([...new Set(input.map(e=>stableJson(parseCanonicalEvent(e))))].sort())),
    competencies:[...competency].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([competencyId,v])=>({competencyId,state:(['PRACTICED','DEMONSTRATED','RETAINED'] as const)[v.rank-1],evidenceIds:[...v.evidenceIds].sort()})),
    errors:[...patterns].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>({conceptId:v.conceptId,errorCode:v.errorCode,occurrenceIds:[...v.ids].sort(),count:v.ids.size})),
    reviews:schedule.sort((a,b)=>a.evidenceId<b.evidenceId?-1:a.evidenceId>b.evidenceId?1:0),
    progress:{significantAttempts:new Set(events.filter(e=>e.eventType!=='ATTEMPT_STARTED' && e.eventType!=='DELETION_REQUESTED').map(e=>e.attemptId)).size,
      completedMissions:events.filter(e=>e.eventType==='MISSION_COMPLETED').length,evidenceCount:evidence.length,reviewCount:reviews.length}} as const;
  return Object.freeze({...content,digest:await sha256(stableJson(content))});
}

export async function rebuildFromRepository(repository: Pick<CanonicalHistoryRepository,'iterateEventsForExport'>, policy:ProjectionPolicy) {
  const events:CanonicalEvent[]=[];
  for await(const event of repository.iterateEventsForExport()) events.push(event);
  return rebuildProjections(events,policy);
}
export async function projectionDiverges(snapshot:ProjectionSnapshot, events:readonly CanonicalEvent[], policy:ProjectionPolicy):Promise<boolean> {
  const {digest,...content}=snapshot;
  return snapshot.version!==PROJECTION_VERSION || await sha256(stableJson(content))!==digest || (await rebuildProjections(events,policy)).digest!==digest;
}
