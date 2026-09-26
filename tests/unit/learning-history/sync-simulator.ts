// Deterministic test infrastructure only. No provider, network, credentials or production activation.
import { InMemoryCanonicalLearningRepository } from '../../../src/modules/learning-history/adapters/in-memory';
import { parseCanonicalEvent } from '../../../src/modules/learning-history/events';
import { stableJson,sha256 } from '../../../src/modules/learning-history/export/integrity';
import { rebuildProjections } from '../../../src/modules/learning-history/projections/rebuild';
import { makeSyncEnvelope,validateSyncEnvelope,initialRetryState,beginUpload,failUpload,acknowledgeUpload,advanceRemoteCheckpoint,SyncProtocolError } from '../../../src/modules/learning-history/sync/protocol';
import type { SyncEnvelope,SyncAck,RetryState,RemoteCheckpoint } from '../../../src/modules/learning-history/sync/protocol';
import type { CanonicalEvent } from '../../../src/modules/learning-history/types';
import { job,uuid,policy } from './sprint-fixtures';

export class RemoteSimulator {
  readonly envelopes:SyncEnvelope[]=[];
  readonly revoked=new Set<string>();
  readonly learner=uuid(900);
  checkpoint(sequence=this.envelopes.length):RemoteCheckpoint{return {streamId:uuid(700),token:uuid(1000000+sequence),sequence};}
  async upload(raw:unknown,deviceId:string):Promise<SyncAck>{
    const e=await validateSyncEnvelope(raw);
    if(this.revoked.has(deviceId)||e.event.deviceRef!==deviceId||e.event.learnerRef!==this.learner)throw new SyncProtocolError('DEVICE_REFUSED');
    const same=this.envelopes.find(v=>v.event.id===e.event.id||v.job.id===e.job.id||v.job.idempotencyKey===e.job.idempotencyKey);
    if(same && same.digest!==e.digest)throw new SyncProtocolError('REMOTE_CONFLICT');
    if(!same)this.envelopes.push(e);
    const sequence=this.envelopes.findIndex(v=>v.event.id===e.event.id)+1;
    return {version:1,jobId:e.job.id,eventId:e.event.id,idempotencyKey:e.job.idempotencyKey,digest:e.digest,checkpoint:this.checkpoint(sequence)};
  }
  download(after:RemoteCheckpoint|null){
    if(after && stableJson(after)!==stableJson(this.checkpoint(after.sequence)))throw new SyncProtocolError('INVALID_PULL_CHECKPOINT');
    if(after && after.sequence>this.envelopes.length)throw new SyncProtocolError('INVALID_PULL_CHECKPOINT');
    return {envelopes:this.envelopes.slice(after?.sequence??0),checkpoint:this.checkpoint()};
  }
}

export class SimulatedDevice {
  readonly id:string;
  online=true;
  records=new Map<string,SyncEnvelope>();
  retries=new Map<string,RetryState>();
  downloaded:RemoteCheckpoint|null=null;
  constructor(id:string){this.id=id;}
  async repository(){
    const repo=new InMemoryCanonicalLearningRepository();
    // Remote late delivery may contain historical facts covered by a tombstone. Replay historical
    // facts first, then tombstones; projections apply deletion independent of this physical order.
    const records=[...this.records.values()].sort((a,b)=>Number(a.event.eventType==='DELETION_REQUESTED')-Number(b.event.eventType==='DELETION_REQUESTED'));
    for(const e of records){
      if(e.event.eventType!=='DELETION_REQUESTED')await repo.putDefinition(e.event.definitionIdentity);
      await repo.appendEventWithOutbox(e.event,e.job);
    }
    return repo;
  }
  async localWrite(raw:CanonicalEvent){
    const e=parseCanonicalEvent({...raw,deviceRef:this.id});
    const envelope=await makeSyncEnvelope(e,job(e),{metadataTransfer:'APPROVED',companyRestricted:false});
    const repo=await this.repository();await repo.appendEventWithOutbox(e,envelope.job);
    this.records.set(e.id,envelope);
    if(!this.retries.has(e.id))this.retries.set(e.id,initialRetryState());
  }
  async push(remote:RemoteSimulator,now:number,options:{lostAck?:boolean;reverse?:boolean}={}){
    const jobs=[...this.retries];if(options.reverse)jobs.reverse();
    for(const [id,old] of jobs){
      const state=beginUpload(old,this.online,now);this.retries.set(id,state);
      if(state.status!=='IN_FLIGHT')continue;
      const e=this.records.get(id)!;
      try{
        const ack=await remote.upload(e,this.id);
        if(options.lostAck)throw new SyncProtocolError('LOST_ACK');
        this.retries.set(id,acknowledgeUpload(state,e,ack));
      }catch(error){this.retries.set(id,failUpload(state,now,error instanceof SyncProtocolError && error.reason==='DEVICE_REFUSED'));}
    }
  }
  async pull(remote:RemoteSimulator,options:{reverse?:boolean;duplicate?:boolean;crashBeforeCheckpoint?:boolean}={}){
    if(!this.online)return;
    const page=remote.download(this.downloaded);
    await this.receive(page.envelopes,page.checkpoint,options);
  }
  async receive(raw:readonly unknown[],checkpoint:RemoteCheckpoint,options:{reverse?:boolean;duplicate?:boolean;crashBeforeCheckpoint?:boolean}={}){
    advanceRemoteCheckpoint(this.downloaded,checkpoint);
    const values=await Promise.all(raw.map(validateSyncEnvelope));
    if(options.reverse)values.reverse();if(options.duplicate)values.push(...values);
    const next=new Map(this.records);
    for(const e of values){
      if(e.event.learnerRef!==uuid(900))throw new SyncProtocolError('LEARNER_REFUSED');
      const previous=next.get(e.event.id);
      if(previous && previous.digest!==e.digest)throw new SyncProtocolError('LOCAL_CONFLICT');
      next.set(e.event.id,e);
    }
    this.records=next;
    if(!options.crashBeforeCheckpoint)this.downloaded=checkpoint;
  }
  restart():SimulatedDevice{
    // A separate object reconstructed from serializable durable model state: no live shared maps.
    const disk=JSON.parse(JSON.stringify({records:[...this.records],retries:[...this.retries],downloaded:this.downloaded}));
    const fresh=new SimulatedDevice(this.id);fresh.records=new Map(disk.records);fresh.retries=new Map(disk.retries);fresh.downloaded=disk.downloaded;fresh.online=this.online;
    return fresh;
  }
  async digests(){
    const events=[...this.records.values()].map(e=>e.event);
    return {canonical:await sha256(stableJson(events.map(stableJson).sort())),projection:(await rebuildProjections(events,policy)).digest};
  }
}

export async function converge(a:SimulatedDevice,b:SimulatedDevice,remote:RemoteSimulator){
 a.online=true;b.online=true;
 await a.push(remote,1000000);await b.push(remote,1000000,{reverse:true});
 await a.pull(remote,{reverse:true,duplicate:true});await b.pull(remote,{duplicate:true});
 return {a:await a.digests(),b:await b.digests()};
}
