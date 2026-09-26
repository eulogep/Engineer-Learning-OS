import assert from 'node:assert/strict';import test from 'node:test';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {RemoteSimulator,SimulatedDevice,converge}=await import('./sync-simulator.ts');
const {event,uuid}=await import('./sprint-fixtures.ts');

for(const scenario of ['A_ONLINE_B_OFFLINE','BOTH_OFFLINE','CONCURRENT','LOST_ACK','OUT_OF_ORDER','CLOCK_SKEW','CRASH_UPLOAD','CRASH_DOWNLOAD'] as const){
 test('N convergence: '+scenario,async()=>{
  const remote=new RemoteSimulator();let a=new SimulatedDevice(uuid(901));let b=new SimulatedDevice(uuid(902));
  if(scenario==='A_ONLINE_B_OFFLINE')b.online=false;
  if(scenario==='BOTH_OFFLINE'){a.online=false;b.online=false;}
  await a.localWrite(event(1));await b.localWrite(event(2,'CONFIDENCE_RECORDED',scenario==='CLOCK_SKEW'?{occurredAt:900000000000}:{}));
  await a.push(remote,1,{lostAck:scenario==='LOST_ACK'||scenario==='CRASH_UPLOAD'});
  await b.push(remote,1,{reverse:true});
  if(scenario==='CRASH_UPLOAD')a=a.restart();
  if(scenario==='CRASH_DOWNLOAD'){await a.pull(remote,{crashBeforeCheckpoint:true});a=a.restart();b=b.restart();}
  const result=await converge(a,b,remote);assert.deepEqual(result.a,result.b);
  assert.equal(a.records.size,2);assert.equal(b.records.size,2);assert.equal(remote.envelopes.length,2);
  assert.equal([...a.retries.values()][0].status,'ACKNOWLEDGED');assert.equal([...b.retries.values()][0].status,'ACKNOWLEDGED');
 });
}
test('N deletion and stale offline history converge without resurrecting pedagogical state',async()=>{
 const remote=new RemoteSimulator();const a=new SimulatedDevice(uuid(901));const b=new SimulatedDevice(uuid(902));
 await a.localWrite(event(1));await a.push(remote,0);await b.pull(remote);
 b.online=false;
 await a.localWrite(event(4,'DELETION_REQUESTED'));await a.push(remote,1);
 await b.localWrite(event(3,'REVIEW_COMPLETED',{occurredAt:90000000}));
 const results=await converge(a,b,remote);assert.deepEqual(results.a,results.b);
 const repo=await b.repository();assert.equal((await repo.readTombstones()).length,1);
 await assert.rejects(b.localWrite(event(5,'REVIEW_COMPLETED')));
 const {rebuildFromRepository}=await import('../../../src/modules/learning-history/projections/rebuild.ts');
 const {policy}=await import('./sprint-fixtures.ts');assert.equal((await rebuildFromRepository(repo,policy)).competencies.length,0);
});
test('N revocation rejects further upload and leaves local job diagnosable',async()=>{
 const remote=new RemoteSimulator(),a=new SimulatedDevice(uuid(901));await a.localWrite(event(1));remote.revoked.add(a.id);
 await a.push(remote,1);assert.equal(remote.envelopes.length,0);assert.equal(a.records.size,1);assert.equal([...a.retries.values()][0].status,'POISON');
});
test('N conflicting idempotent delivery, foreign device and poisoned download fail without partial merge',async()=>{
 const remote=new RemoteSimulator(),a=new SimulatedDevice(uuid(901)),b=new SimulatedDevice(uuid(902));await a.localWrite(event(1));await a.push(remote,0);
 const e=[...a.records.values()][0];await assert.rejects(remote.upload(e,b.id));
 const {makeSyncEnvelope}=await import('../../../src/modules/learning-history/sync/protocol.ts');
 const conflict=await makeSyncEnvelope({...e.event,recordedAt:999},e.job,{metadataTransfer:'APPROVED',companyRestricted:false});
 await assert.rejects(remote.upload(conflict,a.id));
 await assert.rejects(b.receive([e,{...e,digest:'sha256:'+'b'.repeat(64)}],remote.checkpoint()));assert.equal(b.records.size,0);
});
test('N seeded adversarial delivery schedules converge deterministically',async()=>{
 for(let seed=1;seed<=12;seed++){
  const remote=new RemoteSimulator();let a=new SimulatedDevice(uuid(901)),b=new SimulatedDevice(uuid(902));
  let state=seed;const random=()=>{state=(state*1664525+1013904223)>>>0;return state;};
  for(let n=1;n<=8;n++){
   const d=n%2?a:b;await d.localWrite(event(n,'CONFIDENCE_RECORDED',{occurredAt:random()}));
   d.online=random()%3!==0;await d.push(remote,n*10000,{lostAck:random()%4===0,reverse:random()%2===0});
   await d.pull(remote,{duplicate:true,reverse:true,crashBeforeCheckpoint:random()%4===0});
   if(n%3===0){a=a.restart();b=b.restart();}
  }
  const result=await converge(a,b,remote);assert.deepEqual(result.a,result.b,'seed '+seed);assert.equal(a.records.size,8);
 }
});
