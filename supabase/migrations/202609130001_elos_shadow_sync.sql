-- T-0020Q: Supabase persistence behind provider-neutral contracts.
-- SHADOW mode only. This migration does not enable real data synchronization.
create schema if not exists elos;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema elos from public, anon, authenticated;
grant usage on schema elos to authenticated;

create table elos.schema_versions (
  version integer primary key check (version > 0),
  checksum text not null check (checksum ~ '^sha256:[0-9a-f]{64}$'),
  applied_at timestamptz not null default statement_timestamp()
);
create table elos.learner_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  learner_ref uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);
create table elos.device_registrations (
  device_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  learner_ref uuid not null references elos.learner_identities(learner_ref) on delete cascade,
  credential_hash text not null check (credential_hash ~ '^[0-9a-f]{64}$'),
  client_kind text not null check (client_kind in ('DESKTOP', 'MOBILE_LIMITED_WRITE')),
  registered_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique (user_id, device_id),
  check (expires_at > registered_at),
  check (revoked_at is null or revoked_at >= registered_at)
);
create table elos.remote_checkpoints (
  user_id uuid primary key references auth.users(id) on delete cascade,
  learner_ref uuid not null unique references elos.learner_identities(learner_ref) on delete cascade,
  stream_id uuid not null,
  token uuid not null,
  sequence bigint not null default 0 check (sequence >= 0),
  updated_at timestamptz not null default statement_timestamp()
);
create table elos.canonical_events (
  event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  learner_ref uuid not null references elos.learner_identities(learner_ref) on delete cascade,
  device_id uuid not null references elos.device_registrations(device_id),
  remote_sequence bigint not null,
  event_type text not null,
  classification text not null check (classification = 'SYNC_ALLOWED'),
  envelope_digest text not null check (envelope_digest ~ '^sha256:[0-9a-f]{64}$'),
  envelope jsonb not null,
  recorded_at bigint not null check (recorded_at >= 0),
  device_local_order bigint not null check (device_local_order >= 0),
  received_at timestamptz not null default statement_timestamp(),
  unique (user_id, remote_sequence),
  primary key (user_id, event_id)
);
create table elos.sync_acknowledgements (
  job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 160),
  envelope_digest text not null check (envelope_digest ~ '^sha256:[0-9a-f]{64}$'),
  checkpoint_token uuid not null,
  checkpoint_sequence bigint not null check (checkpoint_sequence > 0),
  acknowledged_at timestamptz not null default statement_timestamp(),
  primary key (user_id, job_id),
  foreign key (user_id, event_id) references elos.canonical_events(user_id, event_id) on delete cascade,
  unique (user_id, event_id),
  unique (user_id, idempotency_key)
);
create table elos.replay_requests (
  device_id uuid not null references elos.device_registrations(device_id) on delete cascade,
  request_id uuid not null,
  request_digest text not null check (request_digest ~ '^sha256:[0-9a-f]{64}$'),
  retain_until timestamptz not null,
  primary key (device_id, request_id)
);
create table elos.deletion_tombstones (
  deletion_event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  learner_ref uuid not null references elos.learner_identities(learner_ref) on delete cascade,
  target_type text not null,
  target_id text not null,
  requested_at timestamptz not null default statement_timestamp(),
  primary key (user_id, deletion_event_id),
  foreign key (user_id, deletion_event_id) references elos.canonical_events(user_id, event_id) on delete cascade,
  unique (user_id, target_type, target_id)
);
create index canonical_events_pull_idx on elos.canonical_events (user_id, remote_sequence);
create index replay_requests_expiry_idx on elos.replay_requests (retain_until);
create index device_registrations_active_idx on elos.device_registrations (user_id, revoked_at, expires_at);

alter table elos.learner_identities enable row level security;
alter table elos.learner_identities force row level security;
alter table elos.device_registrations enable row level security;
alter table elos.device_registrations force row level security;
alter table elos.remote_checkpoints enable row level security;
alter table elos.remote_checkpoints force row level security;
alter table elos.canonical_events enable row level security;
alter table elos.canonical_events force row level security;
alter table elos.sync_acknowledgements enable row level security;
alter table elos.sync_acknowledgements force row level security;
alter table elos.replay_requests enable row level security;
alter table elos.replay_requests force row level security;
alter table elos.deletion_tombstones enable row level security;
alter table elos.deletion_tombstones force row level security;
create policy learner_identity_isolation on elos.learner_identities for select to authenticated using ((select auth.uid()) = user_id);
create policy device_isolation on elos.device_registrations for select to authenticated using ((select auth.uid()) = user_id);
create policy checkpoint_isolation on elos.remote_checkpoints for select to authenticated using ((select auth.uid()) = user_id);
create policy canonical_event_isolation on elos.canonical_events for select to authenticated using ((select auth.uid()) = user_id);
create policy acknowledgement_isolation on elos.sync_acknowledgements for select to authenticated using ((select auth.uid()) = user_id);
create policy replay_isolation on elos.replay_requests for select to authenticated using (
  exists (select 1 from elos.device_registrations d where d.device_id = replay_requests.device_id and d.user_id = (select auth.uid()))
);
create policy tombstone_isolation on elos.deletion_tombstones for select to authenticated using ((select auth.uid()) = user_id);
revoke all on all tables in schema elos from public, anon, authenticated;

create or replace function elos.assert_uuid_v7(value text, label text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = 'invalid_' || label;
  end if;
  return value::uuid;
end;
$$;

create or replace function elos.assert_active_device(p_user_id uuid, p_learner_ref uuid, p_device_id uuid, p_device_credential text)
returns elos.device_registrations language plpgsql security definer set search_path = '' as $$
declare found elos.device_registrations;
begin
  select d.* into found from elos.device_registrations d
   where d.user_id = p_user_id and d.learner_ref = p_learner_ref and d.device_id = p_device_id
     and d.revoked_at is null and d.expires_at > statement_timestamp()
     and d.credential_hash = encode(extensions.digest(p_device_credential, 'sha256'), 'hex');
  if found.device_id is null then raise exception using errcode = '42501', message = 'device_not_authorized'; end if;
  return found;
end;
$$;

create or replace function public.elos_register_device(
  p_learner_ref text, p_device_id text, p_request_id text, p_requested_at timestamptz,
  p_device_credential text, p_client_kind text default 'DESKTOP',
  p_expires_at timestamptz default (statement_timestamp() + interval '90 days')
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  learner uuid := elos.assert_uuid_v7(p_learner_ref, 'learner_ref');
  device uuid := elos.assert_uuid_v7(p_device_id, 'device_id');
begin
  perform elos.assert_uuid_v7(p_request_id, 'request_id');
  if caller is null or p_requested_at is null or p_device_credential is null
     or length(p_device_credential) < 32 or length(p_device_credential) > 512
     or p_device_credential ~ '[[:space:]]' or p_client_kind not in ('DESKTOP', 'MOBILE_LIMITED_WRITE')
     or p_expires_at <= statement_timestamp()
     or abs(extract(epoch from statement_timestamp() - p_requested_at)) > 300 then
    raise exception using errcode = '42501', message = 'registration_refused';
  end if;
  insert into elos.learner_identities(user_id, learner_ref) values (caller, learner)
    on conflict (user_id) do update set learner_ref = excluded.learner_ref
      where elos.learner_identities.learner_ref = excluded.learner_ref;
  if not found then raise exception using errcode = '23505', message = 'learner_identity_conflict'; end if;
  if exists (select 1 from elos.device_registrations where device_id = device and revoked_at is not null) then
    raise exception using errcode = '42501', message = 'revoked_device_cannot_reregister';
  end if;
  insert into elos.device_registrations(device_id,user_id,learner_ref,credential_hash,client_kind,expires_at)
    values (device,caller,learner,encode(extensions.digest(p_device_credential,'sha256'),'hex'),p_client_kind,p_expires_at)
    on conflict (device_id) do update set expires_at = excluded.expires_at
      where elos.device_registrations.user_id = caller
        and elos.device_registrations.learner_ref = learner
        and elos.device_registrations.credential_hash = excluded.credential_hash
        and elos.device_registrations.revoked_at is null;
  if not found then raise exception using errcode = '42501', message = 'device_registration_conflict'; end if;
  insert into elos.remote_checkpoints(user_id,learner_ref,stream_id,token,sequence)
    values (caller,learner,learner,learner,0) on conflict (user_id) do nothing;
  return jsonb_build_object('status','REGISTERED','mode','SHADOW');
end;
$$;

create or replace function public.elos_sync_upload(
  p_learner_ref text, p_device_id text, p_request_id text, p_requested_at timestamptz,
  p_device_credential text, p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  learner uuid := elos.assert_uuid_v7(p_learner_ref,'learner_ref');
  device uuid := elos.assert_uuid_v7(p_device_id,'device_id');
  request_id uuid := elos.assert_uuid_v7(p_request_id,'request_id');
  event_id uuid; job_id uuid; digest text; idem text; next_sequence bigint;
  existing elos.sync_acknowledgements;
begin
  if caller is null or p_requested_at is null or abs(extract(epoch from statement_timestamp()-p_requested_at)) > 300 then
    raise exception using errcode = '42501', message = 'request_expired';
  end if;
  perform elos.assert_active_device(caller,learner,device,p_device_credential);
  if jsonb_typeof(p_envelope) <> 'object' or octet_length(p_envelope::text) > 65536
     or (select count(*) from jsonb_object_keys(p_envelope)) <> 4
     or not (p_envelope ?& array['version','event','job','digest']) or p_envelope->>'version' <> '1'
     or p_envelope->'event'->>'classification' <> 'SYNC_ALLOWED'
     or p_envelope->'job'->>'classification' <> 'SYNC_ALLOWED'
     or p_envelope::text ~* '"(rawContent|answerText|prompt|cookie|token|secret|password|companyData)"[[:space:]]*:' then
    raise exception using errcode = '22023', message = 'envelope_refused';
  end if;
  event_id := elos.assert_uuid_v7(p_envelope->'event'->>'id','event_id');
  job_id := elos.assert_uuid_v7(p_envelope->'job'->>'id','job_id');
  if elos.assert_uuid_v7(p_envelope->'event'->>'learnerRef','event_learner_ref') <> learner
     or elos.assert_uuid_v7(p_envelope->'event'->>'deviceRef','event_device_ref') <> device
     or elos.assert_uuid_v7(p_envelope->'job'->>'eventId','job_event_id') <> event_id then
    raise exception using errcode = '42501', message = 'identity_mismatch';
  end if;
  digest := p_envelope->>'digest'; idem := p_envelope->'job'->>'idempotencyKey';
  if digest !~ '^sha256:[0-9a-f]{64}$' or length(idem) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'envelope_refused';
  end if;
  select a.* into existing from elos.sync_acknowledgements a
   where a.user_id=caller and (a.job_id=job_id or a.event_id=event_id or a.idempotency_key=idem) limit 1;
  if existing.job_id is not null then
    if existing.job_id<>job_id or existing.event_id<>event_id or existing.idempotency_key<>idem or existing.envelope_digest<>digest then
      raise exception using errcode = '23505', message = 'canonical_identity_conflict';
    end if;
    return jsonb_build_object('version',1,'jobId',job_id,'eventId',event_id,'idempotencyKey',idem,'digest',digest,
      'checkpoint',jsonb_build_object('streamId',learner,'token',existing.checkpoint_token,'sequence',existing.checkpoint_sequence));
  end if;
  insert into elos.replay_requests(device_id,request_id,request_digest,retain_until)
    values (device,request_id,digest,p_requested_at+interval '5 minutes') on conflict do nothing;
  if not found then raise exception using errcode = '23505', message = 'request_replayed'; end if;
  update elos.remote_checkpoints set sequence=sequence+1,token=request_id,updated_at=statement_timestamp()
    where user_id=caller and learner_ref=learner returning sequence into next_sequence;
  if next_sequence is null then raise exception using errcode = '42501', message = 'learner_not_registered'; end if;
  insert into elos.canonical_events(event_id,user_id,learner_ref,device_id,remote_sequence,event_type,classification,envelope_digest,envelope,recorded_at,device_local_order)
    values (event_id,caller,learner,device,next_sequence,p_envelope->'event'->>'eventType','SYNC_ALLOWED',digest,p_envelope,
      (p_envelope->'event'->>'recordedAt')::bigint,(p_envelope->'event'->>'deviceLocalOrder')::bigint);
  insert into elos.sync_acknowledgements(job_id,user_id,event_id,idempotency_key,envelope_digest,checkpoint_token,checkpoint_sequence)
    values (job_id,caller,event_id,idem,digest,request_id,next_sequence);
  if p_envelope->'event'->>'eventType'='DELETION_REQUESTED' then
    insert into elos.deletion_tombstones(deletion_event_id,user_id,learner_ref,target_type,target_id)
      values (event_id,caller,learner,p_envelope->'event'->'payload'->>'targetType',p_envelope->'event'->'payload'->>'targetId')
      on conflict (user_id,target_type,target_id) do nothing;
  end if;
  return jsonb_build_object('version',1,'jobId',job_id,'eventId',event_id,'idempotencyKey',idem,'digest',digest,
    'checkpoint',jsonb_build_object('streamId',learner,'token',request_id,'sequence',next_sequence));
end;
$$;

create or replace function public.elos_sync_pull(
  p_learner_ref text,p_device_id text,p_request_id text,p_requested_at timestamptz,p_device_credential text,
  p_after jsonb default null,p_limit integer default 100
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid:=auth.uid(); learner uuid:=elos.assert_uuid_v7(p_learner_ref,'learner_ref');
  device uuid:=elos.assert_uuid_v7(p_device_id,'device_id');
  start_sequence bigint:=coalesce((p_after->>'sequence')::bigint,0);
  end_sequence bigint; end_token uuid; values_json jsonb; more boolean;
begin
  perform elos.assert_uuid_v7(p_request_id,'request_id');
  if caller is null or p_requested_at is null or p_limit not between 1 and 500
     or abs(extract(epoch from statement_timestamp()-p_requested_at)) > 300 then
    raise exception using errcode='42501',message='pull_refused';
  end if;
  perform elos.assert_active_device(caller,learner,device,p_device_credential);
  if p_after is not null then
    if elos.assert_uuid_v7(p_after->>'streamId','stream_id')<>learner or start_sequence<0 then
      raise exception using errcode='22023',message='invalid_checkpoint';
    end if;
    if start_sequence=0 and elos.assert_uuid_v7(p_after->>'token','checkpoint_token')<>learner then
      raise exception using errcode='22023',message='invalid_checkpoint';
    elsif start_sequence>0 and not exists (
      select 1 from elos.sync_acknowledgements where user_id=caller and checkpoint_sequence=start_sequence
       and checkpoint_token=elos.assert_uuid_v7(p_after->>'token','checkpoint_token')
    ) then raise exception using errcode='22023',message='invalid_checkpoint'; end if;
  end if;
  select coalesce(jsonb_agg(page.envelope order by page.remote_sequence),'[]'::jsonb),coalesce(max(page.remote_sequence),start_sequence)
    into values_json,end_sequence from (
      select e.envelope,e.remote_sequence from elos.canonical_events e
       where e.user_id=caller and e.learner_ref=learner and e.remote_sequence>start_sequence
       order by e.remote_sequence limit p_limit
    ) page;
  if end_sequence=0 then end_token:=learner;
  else select checkpoint_token into end_token from elos.sync_acknowledgements where user_id=caller and checkpoint_sequence=end_sequence;
  end if;
  select exists(select 1 from elos.canonical_events where user_id=caller and learner_ref=learner and remote_sequence>end_sequence) into more;
  return jsonb_build_object('envelopes',values_json,'checkpoint',
    jsonb_build_object('streamId',learner,'token',end_token,'sequence',end_sequence),'hasMore',more);
end;
$$;

create or replace function public.elos_revoke_device(
  p_learner_ref text,p_device_id text,p_request_id text,p_requested_at timestamptz,p_device_credential text,p_target_device_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid:=auth.uid(); learner uuid:=elos.assert_uuid_v7(p_learner_ref,'learner_ref');
  caller_device uuid:=elos.assert_uuid_v7(p_device_id,'device_id');
  target_device uuid:=elos.assert_uuid_v7(p_target_device_id,'target_device_id');
begin
  perform elos.assert_uuid_v7(p_request_id,'request_id');
  if caller is null or p_requested_at is null or abs(extract(epoch from statement_timestamp()-p_requested_at))>300 then
    raise exception using errcode='42501',message='revocation_refused';
  end if;
  perform elos.assert_active_device(caller,learner,caller_device,p_device_credential);
  update elos.device_registrations set revoked_at=coalesce(revoked_at,statement_timestamp())
    where user_id=caller and learner_ref=learner and device_id=target_device;
  if not found then raise exception using errcode='42501',message='target_device_not_found'; end if;
  return jsonb_build_object('status','REVOKED','deviceId',target_device);
end;
$$;

create or replace function public.elos_sync_health(
  p_learner_ref text,p_device_id text,p_request_id text,p_requested_at timestamptz,p_device_credential text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid:=auth.uid(); learner uuid:=elos.assert_uuid_v7(p_learner_ref,'learner_ref');
  device uuid:=elos.assert_uuid_v7(p_device_id,'device_id'); current_version integer;
begin
  perform elos.assert_uuid_v7(p_request_id,'request_id');
  if caller is null or p_requested_at is null or abs(extract(epoch from statement_timestamp()-p_requested_at))>300 then
    raise exception using errcode='42501',message='health_refused';
  end if;
  perform elos.assert_active_device(caller,learner,device,p_device_credential);
  select coalesce(max(version),1) into current_version from elos.schema_versions;
  return jsonb_build_object('status','HEALTHY','schemaVersion',current_version,'mode','SHADOW');
end;
$$;

revoke all on function elos.assert_uuid_v7(text,text) from public,anon,authenticated;
revoke all on function elos.assert_active_device(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.elos_register_device(text,text,text,timestamptz,text,text,timestamptz) from public,anon;
revoke all on function public.elos_sync_upload(text,text,text,timestamptz,text,jsonb) from public,anon;
revoke all on function public.elos_sync_pull(text,text,text,timestamptz,text,jsonb,integer) from public,anon;
revoke all on function public.elos_revoke_device(text,text,text,timestamptz,text,text) from public,anon;
revoke all on function public.elos_sync_health(text,text,text,timestamptz,text) from public,anon;
grant execute on function public.elos_register_device(text,text,text,timestamptz,text,text,timestamptz) to authenticated;
grant execute on function public.elos_sync_upload(text,text,text,timestamptz,text,jsonb) to authenticated;
grant execute on function public.elos_sync_pull(text,text,text,timestamptz,text,jsonb,integer) to authenticated;
grant execute on function public.elos_revoke_device(text,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.elos_sync_health(text,text,text,timestamptz,text) to authenticated;
insert into elos.schema_versions(version,checksum)
values (1,'sha256:037b65b6a5ee96a16a0f2425668405ce5f1622b672585edb6933e89b020b6548')
on conflict (version) do nothing;
