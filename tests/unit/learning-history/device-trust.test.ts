import assert from 'node:assert/strict';import test from 'node:test';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {authorizeCanonicalWrite,revokeDevice}=await import('../../../src/modules/learning-history/auth/device-trust.ts');
import type {DeviceRegistration,AuthorizationRequest,LearnerIdentityRef,AuthorizationContext} from '../../../src/modules/learning-history/auth/device-trust.ts';
const {event,uuid}=await import('./sprint-fixtures.ts');
function harness(client:DeviceRegistration['client']='MOBILE_LIMITED_WRITE'){
 let device:DeviceRegistration={deviceId:uuid(901),learnerRef:uuid(900),credentialRef:uuid(700),client,registeredAt:1,expiresAt:1000000,revokedAt:null};
 let context:AuthorizationContext={sessionRef:uuid(800),deviceId:device.deviceId,learnerRef:device.learnerRef,credentialRef:device.credentialRef,issuedAt:2,expiresAt:900000};
 const used=new Set<string>();
 const ports={directory:{getDevice:async()=>device},sessions:{resolve:async()=>context},replay:{claim:async(key:string)=>{if(used.has(key))return false;used.add(key);return true;}}};
 const request:AuthorizationRequest={requestId:uuid(600),issuedAt:100,capability:'CONFIDENCE',event:event(1,'CONFIDENCE_RECORDED')};
 return {ports,request,authorize:(r=request,now=100)=>authorizeCanonicalWrite(uuid(900) as LearnerIdentityRef,uuid(800),r,now,ports),
 setDevice:(v:Partial<DeviceRegistration>)=>{device={...device,...v};},setContext:(v:Partial<AuthorizationContext>)=>{context={...context,...v};},device:()=>device};
}
test('O pseudonymous private learner, valid session and allowed mobile write',async()=>{const h=harness();assert.equal((await h.authorize()).event.id,h.request.event.id);});
test('O per-device revocation and lost-device flow never activate restored state',async()=>{
 const h=harness();const result=revokeDevice(h.device(),100,'LOST');h.setDevice(result.device);await assert.rejects(h.authorize(),{reason:'DEVICE_REVOKED'});
 assert.equal(result.recovery.autoActivate,false);assert.equal(result.recovery.requireVerifiedRestore,true);assert.equal(revokeDevice(result.device,200,'LOST').device.revokedAt,100);
 const other=harness();assert.ok(await other.authorize());
});
test('O session expiry, future session, rotated credential and identity mismatch fail closed',async()=>{
 for(const change of [{expiresAt:100},{issuedAt:101},{learnerRef:uuid(999)},{credentialRef:uuid(999)}]){const h=harness();h.setContext(change);await assert.rejects(h.authorize());}
 const h=harness();await assert.rejects(h.authorize({...h.request,event:event(1,'CONFIDENCE_RECORDED',{deviceRef:uuid(999)})}),{reason:'IDENTITY_MISMATCH'});
});
test('O concurrent replay is atomically refused and request timestamps are bounded',async()=>{
 const h=harness();const results=await Promise.allSettled([h.authorize(),h.authorize()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(h.authorize({...h.request,requestId:uuid(601),issuedAt:101}),{reason:'REQUEST_EXPIRED'});
 await assert.rejects(h.authorize({...h.request,requestId:uuid(602),issuedAt:0},300001),{reason:'REQUEST_EXPIRED'});
});
for(const capability of ['FILE_INGESTION','AUDIO_WORKFLOW','CODING','ADMIN','VISUAL_AUTHORING'] as const){
 test('O mobile refuses '+capability,async()=>{const h=harness();await assert.rejects(h.authorize({...h.request,capability}),{reason:'LIMITED_WRITE_REFUSED'});});
}
test('O allowed capability names cannot smuggle a forbidden event or local-only history',async()=>{
 const h=harness();await assert.rejects(h.authorize({...h.request,capability:'SYNC_QUEUE',event:event(1)}),{reason:'LIMITED_WRITE_REFUSED'});
 const e=event(2,'REVIEW_COMPLETED');if(e.eventType!=='REVIEW_COMPLETED')throw Error();
 await assert.rejects(h.authorize({...h.request,capability:'REVIEW',event:{...e,payload:{...e.payload,responseMode:'AUDIO'}}}),{reason:'LIMITED_WRITE_REFUSED'});
 await assert.rejects(h.authorize({...h.request,event:event(1,'CONFIDENCE_RECORDED',{classification:'LOCAL_ONLY'})}),{reason:'CLASSIFICATION_REFUSED'});
});
test('O revocation between session resolution and replay claim fails before authorization',async()=>{
 const h=harness();h.ports.sessions.resolve=async()=>{h.setDevice({revokedAt:99});return {sessionRef:uuid(800),deviceId:uuid(901),learnerRef:uuid(900),credentialRef:uuid(700),issuedAt:2,expiresAt:900000};};
 await assert.rejects(h.authorize(),{reason:'DEVICE_REVOKED'});
});
