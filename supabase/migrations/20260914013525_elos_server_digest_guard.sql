
create or replace function elos.stable_jsonb(value jsonb)
returns text language plpgsql immutable strict set search_path = '' as $$
declare rendered text;
begin
  case jsonb_typeof(value)
    when 'object' then
      select '{' || coalesce(string_agg(
        to_jsonb(entry.key)::text || ':' || elos.stable_jsonb(entry.value),
        ',' order by entry.key collate "C"
      ), '') || '}' into rendered
      from jsonb_each(value) as entry;
    when 'array' then
      select '[' || coalesce(string_agg(
        elos.stable_jsonb(item.value), ',' order by item.ordinality
      ), '') || ']' into rendered
      from jsonb_array_elements(value) with ordinality as item(value, ordinality);
    else
      rendered := value::text;
  end case;
  return rendered;
end;
$$;

create or replace function elos.sync_envelope_digest(value jsonb)
returns text language sql immutable strict set search_path = '' as $$
  select 'sha256:' || encode(
    extensions.digest(
      convert_to(elos.stable_jsonb(jsonb_build_object('event', value->'event', 'job', value->'job')), 'UTF8'),
      'sha256'
    ),
    'hex'
  )
$$;

do $$
begin
  if elos.sync_envelope_digest('{"event":{"b":"x","a":1},"job":{"z":true}}'::jsonb)
     <> 'sha256:c6bc36d77f97f2adfd77d7f2ebd87e4ee76247f2ae00945c0e0675eaeef7c1dc' then
    raise exception 'stable_json_digest_mismatch';
  end if;
end;
$$;

alter table elos.canonical_events
  add constraint canonical_envelope_digest_matches
  check (envelope_digest = elos.sync_envelope_digest(envelope));


revoke all on function elos.stable_jsonb(jsonb) from public, anon, authenticated;
revoke all on function elos.sync_envelope_digest(jsonb) from public, anon, authenticated;

insert into elos.schema_versions(version, checksum)
values (4, 'sha256:2c5f4280c8abe579de7c2cffc8ca06386dfd65be2020fe68b9a139f4419f9b7f')
on conflict (version) do nothing;
