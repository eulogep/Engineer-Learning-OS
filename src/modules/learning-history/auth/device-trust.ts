import { z } from 'zod';
import { UUIDV7_CANONICAL_PATTERN } from '../schemas';
import { parseCanonicalEvent } from '../events';
import { utf8Length,stableJson,sha256 } from '../export/integrity';
import type { CanonicalEvent } from '../types';

declare const identityBrand:unique symbol;
export type LearnerIdentityRef=string & {readonly [identityBrand]:'LearnerIdentityRef'};
export type DeviceCredentialRef=string & {readonly [identityBrand]:'DeviceCredentialRef'};
const uuid=z.string().regex(UUIDV7_CANONICAL_PATTERN);
const time=z.number().int().nonnegative().safe();
export const deviceRegistrationSchema=z.object({deviceId:uuid,learnerRef:uuid,credentialRef:uuid,
  client:z.enum(['DESKTOP','MOBILE_LIMITED_WRITE']),registeredAt:time,expiresAt:time,revokedAt:time.nullable()}).strict();
export type DeviceRegistration=z.infer<typeof deviceRegistrationSchema>;
const contextSchema=z.object({sessionRef:uuid,deviceId:uuid,learnerRef:uuid,credentialRef:uuid,issuedAt:time,expiresAt:time}).strict();
export type AuthorizationContext=z.infer<typeof contextSchema>;
export type DeviceRevoked=Readonly<{version:1;deviceId:string;learnerRef:string;revokedAt:number;reason:'LOST'|'COMPROMISED'|'LEARNER_REQUEST'}>;
export type LostDeviceFlow=Readonly<{deviceId:string;revokeSessions:true;rotateCredential:true;requireVerifiedRestore:true;autoActivate:false}>;
export const LIMITED_WRITE_CAPABILITIES=['REVIEW','SMALL_QUIZ','CONFIDENCE','ERROR_OCCURRENCE','SYNC_QUEUE'] as const;
export type LimitedWriteClient=Readonly<{kind:'MOBILE_LIMITED_WRITE';capabilities:typeof LIMITED_WRITE_CAPABILITIES;maxMetadataBytes:16384}>;
export type Capability=typeof LIMITED_WRITE_CAPABILITIES[number]|'FILE_INGESTION'|'AUDIO_WORKFLOW'|'CODING'|'ADMIN'|'VISUAL_AUTHORING';
const capabilitySchema=z.enum(['REVIEW','SMALL_QUIZ','CONFIDENCE','ERROR_OCCURRENCE','SYNC_QUEUE','FILE_INGESTION','AUDIO_WORKFLOW','CODING','ADMIN','VISUAL_AUTHORING']);
export type AuthorizationRequest=Readonly<{requestId:string;issuedAt:number;capability:Capability;event:CanonicalEvent}>;
export interface DeviceTrustDirectory { getDevice(deviceId:string):Promise<DeviceRegistration|null> }
/** Implementations MUST verify provider proof, not return caller-supplied claims unchecked. */
export interface VerifiedSessionResolver { resolve(sessionRef:string):Promise<AuthorizationContext|null> }
/** Atomic per-device nonce claim. Real implementations must persist it for the request acceptance
 * window across process restart. Claim and eventual write need a transaction/idempotent boundary. */
export interface ReplayLedger { claim(key:string,digest:string,retainUntil:number):Promise<boolean> }
export class DeviceAuthorizationError extends Error {
  readonly reason:string;
  constructor(reason:string){super('Device authorization: '+reason);this.name='DeviceAuthorizationError';this.reason=reason;}
}
function reject(reason:string):never{throw new DeviceAuthorizationError(reason);}
const WINDOW_MS=300000;
function mobileEventAllowed(event:CanonicalEvent):boolean{
  if(event.eventType==='REVIEW_COMPLETED')return event.payload.responseMode!=='AUDIO';
  if(event.eventType==='ERROR_OBSERVED'||event.eventType==='CONFIDENCE_RECORDED')return true;
  return event.eventType==='ATTEMPT_ANSWERED' && ['CHOICE','SHORT_TEXT'].includes(event.payload.responseKind);
}
function capabilityMatches(capability:Capability,event:CanonicalEvent):boolean{
  if(capability==='REVIEW')return event.eventType==='REVIEW_COMPLETED';
  if(capability==='SMALL_QUIZ')return event.eventType==='ATTEMPT_ANSWERED' && ['CHOICE','SHORT_TEXT'].includes(event.payload.responseKind);
  if(capability==='CONFIDENCE')return event.eventType==='CONFIDENCE_RECORDED';
  if(capability==='ERROR_OCCURRENCE')return event.eventType==='ERROR_OBSERVED';
  if(capability==='SYNC_QUEUE')return event.classification==='SYNC_ALLOWED';
  // Broader desktop capabilities are contracts only; this authorizer processes canonical writes.
  return false;
}

export async function authorizeCanonicalWrite(
  privateLearner:LearnerIdentityRef,sessionRef:string,raw:AuthorizationRequest,now:number,
  ports:{directory:DeviceTrustDirectory;sessions:VerifiedSessionResolver;replay:ReplayLedger},
):Promise<Readonly<{device:DeviceRegistration;event:CanonicalEvent;requestDigest:string}>>{
  if(!uuid.safeParse(privateLearner).success||!uuid.safeParse(sessionRef).success||!time.safeParse(now).success)reject('INVALID_CONTEXT');
  let request:AuthorizationRequest,context:AuthorizationContext,device:DeviceRegistration,event:CanonicalEvent;
  try{
    request=z.object({requestId:uuid,issuedAt:time,capability:capabilitySchema,event:z.unknown()}).strict().parse(raw) as AuthorizationRequest;
    context=contextSchema.parse(await ports.sessions.resolve(sessionRef));
    device=deviceRegistrationSchema.parse(await ports.directory.getDevice(context.deviceId));
    event=parseCanonicalEvent(request.event);
  }catch{reject('INVALID_CONTEXT');}
  if(context.sessionRef!==sessionRef||context.learnerRef!==privateLearner||device.learnerRef!==privateLearner||String(event.learnerRef)!==String(privateLearner)
    ||event.deviceRef!==device.deviceId||context.deviceId!==device.deviceId||context.credentialRef!==device.credentialRef)reject('IDENTITY_MISMATCH');
  if(device.revokedAt!==null)reject('DEVICE_REVOKED');
  if(device.registeredAt>now||device.expiresAt<=now||context.issuedAt>now||context.issuedAt<device.registeredAt
    ||context.expiresAt<=now||context.expiresAt>device.expiresAt)reject('SESSION_EXPIRED');
  if(request.issuedAt>now||now-request.issuedAt>WINDOW_MS)reject('REQUEST_EXPIRED');
  if(device.client==='MOBILE_LIMITED_WRITE' && (!(LIMITED_WRITE_CAPABILITIES as readonly string[]).includes(request.capability)
    ||!mobileEventAllowed(event)||utf8Length(stableJson(event))>16384))reject('LIMITED_WRITE_REFUSED');
  if(!capabilityMatches(request.capability,event))reject('CAPABILITY_MISMATCH');
  if(event.classification!=='SYNC_ALLOWED')reject('CLASSIFICATION_REFUSED');
  const requestDigest=await sha256(stableJson({...request,event}));
  const retainUntil=request.issuedAt+WINDOW_MS;
  if(!Number.isSafeInteger(retainUntil))reject('REQUEST_EXPIRED');
  // Recheck revocation/credential after awaits; remote adapter must repeat this in write transaction.
  let current:DeviceRegistration|null,claimed:boolean;
  try { current=await ports.directory.getDevice(device.deviceId); }
  catch { reject('TRUST_UNAVAILABLE'); }
  if(!current||current.revokedAt!==null||current.credentialRef!==device.credentialRef)reject('DEVICE_REVOKED');
  try { claimed=await ports.replay.claim(stableJson([privateLearner,device.deviceId,request.requestId]),requestDigest,retainUntil); }
  catch { reject('TRUST_UNAVAILABLE'); }
  if(!claimed)reject('REPLAY_REFUSED');
  return Object.freeze({device:Object.freeze(device),event,requestDigest});
}

export function revokeDevice(raw:DeviceRegistration,at:number,reason:DeviceRevoked['reason']):Readonly<{device:DeviceRegistration;fact:DeviceRevoked;recovery:LostDeviceFlow}>{
  const device=deviceRegistrationSchema.parse(raw);
  if(!time.safeParse(at).success||at<device.registeredAt||!['LOST','COMPROMISED','LEARNER_REQUEST'].includes(reason))reject('INVALID_REVOCATION');
  const revokedAt=device.revokedAt??at;
  return {device:Object.freeze({...device,revokedAt}),fact:{version:1,deviceId:device.deviceId,learnerRef:device.learnerRef,revokedAt,reason},
    recovery:{deviceId:device.deviceId,revokeSessions:true,rotateCredential:true,requireVerifiedRestore:true,autoActivate:false}};
}
