import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(error){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw error;}}});
const {event,policy,uuid}=await import('./sprint-fixtures.ts');
const {rebuildProjections,projectionDiverges,rebuildFromRepository}=await import('../../../src/modules/learning-history/projections/rebuild.ts');
const {InMemoryCanonicalLearningRepository}=await import('../../../src/modules/learning-history/adapters/in-memory.ts');
const {exportCanonicalHistory,importCanonicalHistory}=await import('../../../src/modules/learning-history/export/recovery.ts');

test('L deterministic permutation, duplicate replay and tamper divergence',async()=>{
 const events=[event(1),event(2,'ERROR_OBSERVED'),event(3,'REVIEW_COMPLETED',{occurredAt:86400200})];
 const result=await rebuildProjections(events,policy);
 assert.equal(result.competencies[0].state,'RETAINED'); assert.equal(result.errors[0].count,1);
 assert.equal(result.digest,(await rebuildProjections([...events].reverse().concat(events),policy)).digest);
 assert.equal(await projectionDiverges(result,events,policy),false);
 assert.equal(await projectionDiverges({...result,progress:{...result.progress,evidenceCount:999}},events,policy),true);
 assert.equal(await projectionDiverges(result,events,{...policy,reviewDelayMs:2}),true);
});
test('L guided, full-solution, untrusted and NotebookLM evidence cannot manufacture mastery',async()=>{
 const e=event(1); if(e.eventType!=='EVIDENCE_CREATED')throw Error();
 for(const [modes,expected] of [[['HINT'],'PRACTICED'],[['FULL_SOLUTION'],undefined],[['EXTERNAL_AI'],undefined]] as const){
   const value=event(1,'EVIDENCE_CREATED',{payload:{...e.payload,assistance:{modes:[...modes],hintCount:1,retryCount:0}}});
   assert.equal((await rebuildProjections([value],policy)).competencies[0]?.state,expected);
 }
 assert.equal((await rebuildProjections([e],{...policy,transferDefinitions:[]})).competencies[0].state,'PRACTICED');
 assert.equal((await rebuildProjections([event(1,'EVIDENCE_CREATED',{payload:{...e.payload,evidenceType:'NOTEBOOKLM_ARTIFACT'}})],policy)).competencies.length,0);
 assert.equal((await rebuildProjections([event(1,'MISSION_COMPLETED')],policy)).competencies.length,0);
});
test('L retention requires delayed autonomous retrieval on a comparable device clock',async()=>{
 for(const overrides of [{occurredAt:200},{occurredAt:86400200,deviceRef:uuid(902)}]){
  assert.equal((await rebuildProjections([event(1),event(2,'REVIEW_COMPLETED',overrides)],policy)).competencies[0].state,'DEMONSTRATED');
 }
});
test('L deletion dominates arrival order and removes evidence-derived state',async()=>{
 const events=[event(1),event(2,'ERROR_OBSERVED'),event(3,'REVIEW_COMPLETED'),event(4,'DELETION_REQUESTED')];
 const result=await rebuildProjections(events.reverse(),policy);
 assert.equal(result.competencies.length,0);assert.equal(result.errors.length,0);assert.equal(result.reviews.length,0);
});
test('L conflicting identities, future policy and mixed learner scope fail closed',async()=>{
 await assert.rejects(rebuildProjections([event(1),event(1,'EVIDENCE_CREATED',{recordedAt:999})],policy));
 await assert.rejects(rebuildProjections([event(1),event(2,'EVIDENCE_CREATED',{learnerRef:uuid(999)})],policy));
 await assert.rejects(rebuildProjections([],{...policy,version:2 as 1}));
});
test('L projection rebuild after portable restore is equivalent and source remains unchanged',async()=>{
 const source=new InMemoryCanonicalLearningRepository();await source.appendEvent(event(1));await source.appendEvent(event(2,'ERROR_OBSERVED'));
 const before=await rebuildFromRepository(source,policy);
 const archive=await exportCanonicalHistory(source,{exportId:uuid(90),createdAt:1,sourceDatabaseVersion:1,containsPersonalMetadata:true,containsCompanyRestrictedMetadata:false});
 const target=new InMemoryCanonicalLearningRepository();await importCanonicalHistory(archive,target);
 assert.equal((await rebuildFromRepository(target,policy)).digest,before.digest);
 assert.equal((await rebuildFromRepository(source,policy)).digest,before.digest);
});
