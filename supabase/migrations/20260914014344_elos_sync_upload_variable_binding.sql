-- V1-B04: Remove PL/pgSQL variable/column ambiguity observed by the hosted gate.
create or replace function public.elos_sync_upload(
  p_learner_ref text, p_device_id text, p_request_id text, p_requested_at timestamptz,
  p_device_credential text, p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := auth.uid();
  v_learner uuid := elos.assert_uuid_v7(p_learner_ref,'learner_ref');
  v_device uuid := elos.assert_uuid_v7(p_device_id,'device_id');
  v_request_id uuid := elos.assert_uuid_v7(p_request_id,'request_id');
  v_event_id uuid;
  v_job_id uuid;
  v_digest text;
  v_idempotency_key text;
  v_next_sequence bigint;
  v_existing elos.sync_acknowledgements;
begin
  if v_caller is null or p_requested_at is null
     or abs(extract(epoch from statement_timestamp()-p_requested_at)) > 300 then
    raise exception using errcode = '42501', message = 'request_expired';
  end if;
  perform elos.assert_active_device(v_caller,v_learner,v_device,p_device_credential);
  if jsonb_typeof(p_envelope) <> 'object' or octet_length(p_envelope::text) > 65536
     or (select count(*) from jsonb_object_keys(p_envelope)) <> 4
     or not (p_envelope ?& array['version','event','job','digest']) or p_envelope->>'version' <> '1'
     or p_envelope->'event'->>'classification' <> 'SYNC_ALLOWED'
     or p_envelope->'job'->>'classification' <> 'SYNC_ALLOWED'
     or p_envelope::text ~* '"(rawContent|answerText|prompt|cookie|token|secret|password|companyData)"[[:space:]]*:' then
    raise exception using errcode = '22023', message = 'envelope_refused';
  end if;
  v_event_id := elos.assert_uuid_v7(p_envelope->'event'->>'id','event_id');
  v_job_id := elos.assert_uuid_v7(p_envelope->'job'->>'id','job_id');
  if elos.assert_uuid_v7(p_envelope->'event'->>'learnerRef','event_learner_ref') <> v_learner
     or elos.assert_uuid_v7(p_envelope->'event'->>'deviceRef','event_device_ref') <> v_device
     or elos.assert_uuid_v7(p_envelope->'job'->>'eventId','job_event_id') <> v_event_id then
    raise exception using errcode = '42501', message = 'identity_mismatch';
  end if;
  v_digest := p_envelope->>'digest';
  v_idempotency_key := p_envelope->'job'->>'idempotencyKey';
  if v_digest !~ '^sha256:[0-9a-f]{64}$' or length(v_idempotency_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'envelope_refused';
  end if;
  select acknowledgement.* into v_existing
  from elos.sync_acknowledgements as acknowledgement
  where acknowledgement.user_id = v_caller
    and (
      acknowledgement.job_id = v_job_id
      or acknowledgement.event_id = v_event_id
      or acknowledgement.idempotency_key = v_idempotency_key
    )
  limit 1;
  if v_existing.job_id is not null then
    if v_existing.job_id <> v_job_id
       or v_existing.event_id <> v_event_id
       or v_existing.idempotency_key <> v_idempotency_key
       or v_existing.envelope_digest <> v_digest then
      raise exception using errcode = '23505', message = 'canonical_identity_conflict';
    end if;
    return jsonb_build_object(
      'version',1,'jobId',v_job_id,'eventId',v_event_id,
      'idempotencyKey',v_idempotency_key,'digest',v_digest,
      'checkpoint',jsonb_build_object(
        'streamId',v_learner,
        'token',v_existing.checkpoint_token,
        'sequence',v_existing.checkpoint_sequence
      )
    );
  end if;
  insert into elos.replay_requests(device_id,request_id,request_digest,retain_until)
    values (v_device,v_request_id,v_digest,p_requested_at+interval '5 minutes')
    on conflict do nothing;
  if not found then
    raise exception using errcode = '23505', message = 'request_replayed';
  end if;
  update elos.remote_checkpoints
  set sequence=sequence+1,token=v_request_id,updated_at=statement_timestamp()
  where user_id=v_caller and learner_ref=v_learner
  returning sequence into v_next_sequence;
  if v_next_sequence is null then
    raise exception using errcode = '42501', message = 'learner_not_registered';
  end if;
  insert into elos.canonical_events(
    event_id,user_id,learner_ref,device_id,remote_sequence,event_type,
    classification,envelope_digest,envelope,recorded_at,device_local_order
  ) values (
    v_event_id,v_caller,v_learner,v_device,v_next_sequence,
    p_envelope->'event'->>'eventType','SYNC_ALLOWED',v_digest,p_envelope,
    (p_envelope->'event'->>'recordedAt')::bigint,
    (p_envelope->'event'->>'deviceLocalOrder')::bigint
  );
  insert into elos.sync_acknowledgements(
    job_id,user_id,event_id,idempotency_key,envelope_digest,
    checkpoint_token,checkpoint_sequence
  ) values (
    v_job_id,v_caller,v_event_id,v_idempotency_key,v_digest,
    v_request_id,v_next_sequence
  );
  if p_envelope->'event'->>'eventType'='DELETION_REQUESTED' then
    insert into elos.deletion_tombstones(
      deletion_event_id,user_id,learner_ref,target_type,target_id
    ) values (
      v_event_id,v_caller,v_learner,
      p_envelope->'event'->'payload'->>'targetType',
      p_envelope->'event'->'payload'->>'targetId'
    ) on conflict (user_id,target_type,target_id) do nothing;
  end if;
  return jsonb_build_object(
    'version',1,'jobId',v_job_id,'eventId',v_event_id,
    'idempotencyKey',v_idempotency_key,'digest',v_digest,
    'checkpoint',jsonb_build_object(
      'streamId',v_learner,'token',v_request_id,'sequence',v_next_sequence
    )
  );
end;
$$;

revoke all on function public.elos_sync_upload(text,text,text,timestamptz,text,jsonb) from public, anon;
grant execute on function public.elos_sync_upload(text,text,text,timestamptz,text,jsonb) to authenticated;

insert into elos.schema_versions(version, checksum)
values (5, 'sha256:065fdb13a94cfa7b71422de43d13ceaf81104e4dc89990713eefe4b0692a2d47')
on conflict (version) do nothing;
