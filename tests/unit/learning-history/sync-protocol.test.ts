import assert from 'node:assert/strict';import test from 'node:test';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const p=await import('../../../src/modules/learning-history/sync/protocol.ts');
const {event,job,uuid}=await import('./sprint-fixtures.ts');
const approved={metadataTransfer:'APPROVED' as const,companyRestricted:false};
async function envelope(){const e=event(1);return p.makeSyncEnvelope(e,job(e),approved);}
function ack(e:Awaited<ReturnType<typeof envelope>>,sequence=1){return {version:1 as const,jobId:e.job.id,eventId:e.event.id,idempotencyKey:e.job.idempotencyKey,digest:e.digest,checkpoint:{streamId:uuid(700),token:uuid(700+sequence),sequence}};}
test('M envelope runtime validation refuses local, unknown, restricted, foreign and modified data',async()=>{
 const e=event(1);for(const classification of ['LOCAL_ONLY','UNKNOWN_BLOCKED'] as const){
  const local=event(1,'MISSION_COMPLETED',{classification});await assert.rejects(p.makeSyncEnvelope(local,job(local),approved));
 }
 for(const policy of [{...approved,metadataTransfer:'UNKNOWN' as const},{...approved,companyRestricted:true}])await assert.rejects(p.makeSyncEnvelope(e,job(e),policy));
 const value=await envelope();assert.deepEqual(await p.validateSyncEnvelope(value),value);
 await assert.rejects(p.validateSyncEnvelope({...value,event:{...value.event,recordedAt:999}}));
 await assert.rejects(p.validateSyncEnvelope({...value,credential:'synthetic-forbidden-field'}));
 await assert.rejects(p.makeSyncEnvelope(e,job(event(2)),approved));
});
test('M offline reconnect and lost ACK retry preserve outbox identity',async()=>{
 const value=await envelope();const original=JSON.stringify(value.job);
 let state=p.beginUpload(p.initialRetryState(),false,0);assert.equal(state.status,'WAITING_FOR_NETWORK');assert.equal(state.attempts,0);
 state=p.beginUpload(state,true,1);state=p.failUpload(state,2);assert.equal(state.status,'RETRY');
 assert.equal(p.beginUpload(state,true,3),state);state=p.beginUpload(state,true,state.nextAttemptAt);
 state=p.acknowledgeUpload(state,value,ack(value));assert.equal(state.status,'ACKNOWLEDGED');
 assert.equal(p.acknowledgeUpload(state,value,ack(value)).status,'ACKNOWLEDGED');assert.equal(JSON.stringify(value.job),original);
});
test('M bounded retry and permanent rejection retain poison job diagnostics without raw errors',()=>{
 let state=p.initialRetryState();for(let i=0;i<p.MAX_SYNC_ATTEMPTS;i++){state=p.beginUpload(state,true,state.nextAttemptAt);state=p.failUpload(state,state.nextAttemptAt);}
 assert.equal(state.status,'POISON');assert.equal(p.poisonJob(job(event(1)),state)?.reason,'RETRIES_EXHAUSTED');
 assert.equal(p.beginUpload(state,true,99999),state);
 assert.equal(p.failUpload(p.beginUpload(p.initialRetryState(),true,0),0,true).reason,'REMOTE_REJECTED');
});
test('M rejects wrong ACK, stale checkpoint, fork and foreign stream; out-of-order ACK remains separate from download position',async()=>{
 const e=await envelope();assert.throws(()=>p.acceptAck(e,{...ack(e),eventId:uuid(9)}));
 const first=ack(e,1).checkpoint,second=ack(e,2).checkpoint;
 assert.deepEqual(p.advanceRemoteCheckpoint(first,second),second);
 assert.throws(()=>p.advanceRemoteCheckpoint(second,first));assert.throws(()=>p.advanceRemoteCheckpoint(first,{...first,token:uuid(99)}));
 assert.throws(()=>p.advanceRemoteCheckpoint(first,{...second,streamId:uuid(98)}));
 assert.deepEqual(p.acceptAck(e,ack(e,1)),ack(e,1));
});
test('M real timeout aborts transport and malformed remote ACK fails closed',async()=>{
 let aborted=false;await assert.rejects(p.uploadWithTimeout({upload:async(_e,signal)=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});})},await envelope(),5),{reason:'TIMEOUT'});
 assert.equal(aborted,true);
 await assert.rejects(p.uploadWithTimeout({upload:async()=>({})},await envelope(),100),{reason:'INVALID_ACK'});
});
