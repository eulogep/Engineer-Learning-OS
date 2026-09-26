import { z } from 'zod';
import { parseCanonicalEvent } from '../events';
import { parseSyncQueueJob } from '../sync-job';
import { UUIDV7_CANONICAL_PATTERN } from '../schemas';
import { stableJson, sha256 } from '../export/integrity';
import type { CanonicalEvent } from '../types';
import type { SyncQueueJob } from '../sync-job';

export class SyncProtocolError extends Error {
  readonly reason:string;
  constructor(reason:string){super('Canonical sync: '+reason);this.name='SyncProtocolError';this.reason=reason;}
}
const uuid=z.string().regex(UUIDV7_CANONICAL_PATTERN);
const integer=z.number().int().nonnegative().safe();
const hash=z.string().regex(/^sha256:[0-9a-f]{64}$/);
const checkpointSchema=z.object({streamId:uuid,token:uuid,sequence:integer}).strict();
export type RemoteCheckpoint=z.infer<typeof checkpointSchema>;
const ackSchema=z.object({version:z.literal(1),jobId:uuid,eventId:uuid,idempotencyKey:z.string().min(1).max(160),
  digest:hash,checkpoint:checkpointSchema}).strict();
export type SyncAck=z.infer<typeof ackSchema>;
export type SyncEnvelope=Readonly<{version:1;event:CanonicalEvent;job:SyncQueueJob;digest:string}>;
export type RetryState=Readonly<{attempts:number;nextAttemptAt:number;status:'READY'|'IN_FLIGHT'|'WAITING_FOR_NETWORK'|'RETRY'|'ACKNOWLEDGED'|'POISON';ack?:SyncAck;reason?:string}>;
export type PoisonJob=Readonly<{jobId:string;reason:'RETRIES_EXHAUSTED'|'REMOTE_REJECTED';attempts:number}>;
export interface SyncTransport { upload(envelope:SyncEnvelope,signal:AbortSignal):Promise<unknown> }
export type SyncPolicy=Readonly<{metadataTransfer:'APPROVED'|'BLOCKED'|'UNKNOWN';companyRestricted:boolean}>;
export const MAX_SYNC_ATTEMPTS=5;

export async function makeSyncEnvelope(eventValue:CanonicalEvent,jobValue:SyncQueueJob,policy:SyncPolicy):Promise<SyncEnvelope>{
  if(policy.metadataTransfer!=='APPROVED'||policy.companyRestricted!==false)throw new SyncProtocolError('CLASSIFICATION_REFUSED');
  let event:CanonicalEvent,job:SyncQueueJob;
  try{event=parseCanonicalEvent(eventValue);job=parseSyncQueueJob(jobValue);}catch{throw new SyncProtocolError('INVALID_RECORD');}
  if(event.classification!=='SYNC_ALLOWED'||job.classification!=='SYNC_ALLOWED'||job.eventId!==event.id)throw new SyncProtocolError('CLASSIFICATION_REFUSED');
  return Object.freeze({version:1,event,job,digest:await sha256(stableJson({event,job}))});
}
export async function validateSyncEnvelope(value:unknown):Promise<SyncEnvelope>{
  const schema=z.object({version:z.literal(1),event:z.unknown(),job:z.unknown(),digest:hash}).strict();
  let raw:z.infer<typeof schema>;
  try{raw=schema.parse(value);}catch{throw new SyncProtocolError('INVALID_ENVELOPE');}
  const parsed=await makeSyncEnvelope(raw.event as CanonicalEvent,raw.job as SyncQueueJob,{metadataTransfer:'APPROVED',companyRestricted:false});
  if(parsed.digest!==raw.digest)throw new SyncProtocolError('CONTENT_DIGEST_MISMATCH');
  return parsed;
}
export function advanceRemoteCheckpoint(previous:RemoteCheckpoint|null,nextValue:RemoteCheckpoint):RemoteCheckpoint{
  let next:RemoteCheckpoint;
  try{next=checkpointSchema.parse(nextValue);}catch{throw new SyncProtocolError('INVALID_CHECKPOINT');}
  if(previous && (previous.streamId!==next.streamId || next.sequence<previous.sequence
    || (next.sequence===previous.sequence && next.token!==previous.token)))throw new SyncProtocolError('STALE_CHECKPOINT');
  return Object.freeze(next);
}
export function acceptAck(envelope:SyncEnvelope,value:unknown):SyncAck{
  let ack:SyncAck;
  try{ack=ackSchema.parse(value);}catch{throw new SyncProtocolError('INVALID_ACK');}
  if(ack.jobId!==envelope.job.id||ack.eventId!==envelope.event.id||ack.idempotencyKey!==envelope.job.idempotencyKey||ack.digest!==envelope.digest)throw new SyncProtocolError('ACK_IDENTITY_MISMATCH');
  return Object.freeze(ack);
}
export function initialRetryState():RetryState{return {status:'READY',attempts:0,nextAttemptAt:0};}
function validateRetry(state:RetryState,now:number):void{
  if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(state.attempts)||state.attempts<0||state.attempts>MAX_SYNC_ATTEMPTS
    ||!Number.isSafeInteger(state.nextAttemptAt)||state.nextAttemptAt<0
    ||!['READY','IN_FLIGHT','WAITING_FOR_NETWORK','RETRY','ACKNOWLEDGED','POISON'].includes(state.status))throw new SyncProtocolError('INVALID_RETRY_STATE');
}
export function beginUpload(state:RetryState,online:boolean,now:number):RetryState{
  validateRetry(state,now);
  if(state.status==='ACKNOWLEDGED'||state.status==='POISON')return state;
  if(state.attempts>=MAX_SYNC_ATTEMPTS)return {...state,status:'POISON',reason:'RETRIES_EXHAUSTED'};
  if(!online)return {...state,status:'WAITING_FOR_NETWORK'};
  if(now<state.nextAttemptAt)return state;
  return {status:'IN_FLIGHT',attempts:state.attempts+1,nextAttemptAt:now};
}
export function failUpload(state:RetryState,now:number,permanent=false):RetryState{
  validateRetry(state,now);
  if(state.status!=='IN_FLIGHT')throw new SyncProtocolError('NO_IN_FLIGHT_JOB');
  if(permanent||state.attempts>=MAX_SYNC_ATTEMPTS)return {...state,status:'POISON',reason:permanent?'REMOTE_REJECTED':'RETRIES_EXHAUSTED'};
  const nextAttemptAt=now+Math.min(60000,1000*2**(state.attempts-1));
  if(!Number.isSafeInteger(nextAttemptAt))throw new SyncProtocolError('RETRY_TIME_OVERFLOW');
  return {status:'RETRY',attempts:state.attempts,nextAttemptAt};
}
export function acknowledgeUpload(state:RetryState,envelope:SyncEnvelope,ack:unknown):RetryState{
  if(state.status!=='IN_FLIGHT'&&state.status!=='ACKNOWLEDGED')throw new SyncProtocolError('NO_IN_FLIGHT_JOB');
  return {...state,status:'ACKNOWLEDGED',ack:acceptAck(envelope,ack)};
}
export function poisonJob(job:SyncQueueJob,state:RetryState):PoisonJob|null{
  return state.status==='POISON'?{jobId:job.id,attempts:state.attempts,reason:state.reason==='REMOTE_REJECTED'?'REMOTE_REJECTED':'RETRIES_EXHAUSTED'}:null;
}
/** The caller must persist IN_FLIGHT before upload and ACK before compacting any job.
 * This protocol never deletes the canonical durable outbox. ACK cursors are NOT download cursors. */
export async function uploadWithTimeout(transport:SyncTransport,envelope:SyncEnvelope,timeoutMs=5000):Promise<SyncAck>{
  if(!Number.isFinite(timeoutMs)||timeoutMs<1)throw new SyncProtocolError('INVALID_TIMEOUT');
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new SyncProtocolError('TIMEOUT'));},timeoutMs);});
    return acceptAck(envelope,await Promise.race([transport.upload(envelope,controller.signal),timeout]));
  }catch(error){
    if(error instanceof SyncProtocolError)throw error;
    throw new SyncProtocolError('TRANSPORT_UNAVAILABLE');
  }finally{clearTimeout(timer);}
}
