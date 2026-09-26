create or replace function public.elos_resolve_learner_identity(p_proposed_learner_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  proposed uuid := elos.assert_uuid_v7(p_proposed_learner_ref, 'proposed_learner_ref');
  resolved uuid;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  insert into elos.learner_identities(user_id, learner_ref)
  values (caller, proposed)
  on conflict (user_id) do nothing;

  select learner_ref into resolved
  from elos.learner_identities
  where user_id = caller;

  if resolved is null then
    raise exception using errcode = '42501', message = 'learner_identity_unavailable';
  end if;

  return jsonb_build_object('learnerRef', resolved);
end;
$$;

revoke all on function public.elos_resolve_learner_identity(text) from public, anon;
grant execute on function public.elos_resolve_learner_identity(text) to authenticated;

insert into elos.schema_versions(version, checksum)
values (7, 'sha256:0df123462c1c604eb7aefcc1ddce3fed6a6c17baf839a86546fd592cc765ce34')
on conflict (version) do nothing;
