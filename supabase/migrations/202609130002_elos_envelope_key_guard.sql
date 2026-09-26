-- Fail closed on unexpected canonical-envelope fields at the database boundary.
-- Values remain metadata-only by contract; unknown field names cannot smuggle raw content.
create or replace function elos.json_keys_allowed(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  child jsonb;
  allowed constant text[] := array[
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
  case jsonb_typeof(value)
    when 'object' then
      for item in select key, value from jsonb_each(value) loop
        if not (item.key = any(allowed)) or not elos.json_keys_allowed(item.value) then
          return false;
        end if;
      end loop;
    when 'array' then
      for child in select element from jsonb_array_elements(value) as elements(element) loop
        if not elos.json_keys_allowed(child) then return false; end if;
      end loop;
    else
      return true;
  end case;
  return true;
end;
$$;

revoke all on function elos.json_keys_allowed(jsonb) from public,anon,authenticated;
alter table elos.canonical_events
  add constraint canonical_envelope_allowed_keys check (elos.json_keys_allowed(envelope));

insert into elos.schema_versions(version,checksum)
values (2,'sha256:3335ddf4dd174322408314cb2f5eea0ab34d3e77a574e003d4865586a105f98f')
on conflict (version) do nothing;
