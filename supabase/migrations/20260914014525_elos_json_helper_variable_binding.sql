-- V1-B04: Remove recursive JSON helper parameter/column ambiguity observed by the hosted gate.
create or replace function elos.json_keys_allowed(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_entry record;
  v_child jsonb;
  v_allowed constant text[] := array[
    'version','event','job','digest',
    'id','schemaVersion','learnerRef','deviceRef','occurredAt','recordedAt',
    'deviceLocalOrder','classification','definitionIdentity','attemptId','eventType','payload',
    'definitionId','definitionVersion','definitionHash',
    'stepRef','responseKind','responseRef','outcome','assistance',
    'referenceId','storagePolicy','contentIncluded','sha256',
    'modes','hintCount','retryCount',
    'completion','evidenceId','evidenceType','conceptIds','competencyIds','result',
    'evidenceClassification','artifactRefs','sourceRefs',
    'status','outcomeCode','criteria','criterionId',
    'errorOccurrenceId','errorType','errorCode','severity','context','criterionRef',
    'reviewResultId','sourceEvidenceIds','sourceErrorOccurrenceIds','responseMode',
    'durationMs','confidence','hintRef','level','missionRef','assessmentRef',
    'subjectRef','subjectType','value','targetType','targetId','scope','requestedBy','reasonCode',
    'eventId','idempotencyKey','state','createdAt','attempts'
  ];
begin
  case jsonb_typeof(json_keys_allowed.value)
    when 'object' then
      for v_entry in
        select entry.key, entry.value
        from jsonb_each(json_keys_allowed.value) as entry(key, value)
      loop
        if not (v_entry.key = any(v_allowed))
           or not elos.json_keys_allowed(v_entry.value) then
          return false;
        end if;
      end loop;
    when 'array' then
      for v_child in
        select element.value
        from jsonb_array_elements(json_keys_allowed.value) as element(value)
      loop
        if not elos.json_keys_allowed(v_child) then
          return false;
        end if;
      end loop;
    else
      return true;
  end case;
  return true;
end;
$$;

create or replace function elos.stable_jsonb(value jsonb)
returns text language plpgsql immutable strict set search_path = '' as $$
declare
  v_rendered text;
begin
  case jsonb_typeof(stable_jsonb.value)
    when 'object' then
      select '{' || coalesce(string_agg(
        to_jsonb(entry.key)::text || ':' || elos.stable_jsonb(entry.value),
        ',' order by entry.key collate "C"
      ), '') || '}' into v_rendered
      from jsonb_each(stable_jsonb.value) as entry(key, value);
    when 'array' then
      select '[' || coalesce(string_agg(
        elos.stable_jsonb(item.value), ',' order by item.ordinality
      ), '') || ']' into v_rendered
      from jsonb_array_elements(stable_jsonb.value) with ordinality as item(value, ordinality);
    else
      v_rendered := stable_jsonb.value::text;
  end case;
  return v_rendered;
end;
$$;

revoke all on function elos.json_keys_allowed(jsonb) from public, anon, authenticated;
revoke all on function elos.stable_jsonb(jsonb) from public, anon, authenticated;

do $$
begin
  if not elos.json_keys_allowed('{"event":{"status":"VALID"},"job":{"attempts":0}}'::jsonb)
     or elos.json_keys_allowed('{"event":{"rawContent":"blocked"}}'::jsonb) then
    raise exception 'json_key_guard_self_test_failed';
  end if;
  if elos.sync_envelope_digest('{"event":{"b":"x","a":1},"job":{"z":true}}'::jsonb)
     <> 'sha256:c6bc36d77f97f2adfd77d7f2ebd87e4ee76247f2ae00945c0e0675eaeef7c1dc' then
    raise exception 'stable_json_digest_self_test_failed';
  end if;
end;
$$;

insert into elos.schema_versions(version, checksum)
values (6, 'sha256:b0e3cc94e956f3e97ef0e06a499eddbc5d37f6caa006f9d782b1d57f2b3e2b13')
on conflict (version) do nothing;
