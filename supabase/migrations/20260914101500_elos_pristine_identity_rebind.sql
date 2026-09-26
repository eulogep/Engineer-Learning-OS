-- V1 production repair: explicitly bind local canonical history to a pristine remote identity.
-- Canonical events and EventIds are never rewritten. A rebind is refused after any remote history exists.
create table elos.learner_identity_rebindings (
  rebind_id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_learner_ref uuid not null,
  learner_ref uuid not null,
  rebound_at timestamptz not null default statement_timestamp(),
  rolled_back_at timestamptz,
  check (previous_learner_ref <> learner_ref),
  check (rolled_back_at is null or rolled_back_at >= rebound_at)
);

alter table elos.learner_identity_rebindings enable row level security;
alter table elos.learner_identity_rebindings force row level security;
revoke all on table elos.learner_identity_rebindings from public, anon, authenticated;

create or replace function public.elos_rebind_pristine_learner_identity(
  p_expected_remote_learner_ref text,
  p_local_learner_ref text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_expected uuid := elos.assert_uuid_v7(p_expected_remote_learner_ref, 'expected_remote_learner_ref');
  v_local uuid := elos.assert_uuid_v7(p_local_learner_ref, 'local_learner_ref');
  v_current uuid;
  v_rebind_id uuid;
begin
  if v_caller is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select identity.learner_ref into v_current
  from elos.learner_identities as identity
  where identity.user_id = v_caller
  for update;

  if v_current is null then
    raise exception using errcode = '42501', message = 'learner_identity_unavailable';
  end if;
  if v_current <> v_expected then
    raise exception using errcode = '40001', message = 'learner_identity_changed';
  end if;
  if v_current = v_local then
    return jsonb_build_object('status','UNCHANGED','learnerRef',v_local,'rebindId',null);
  end if;
  if exists (
    select 1 from elos.learner_identities as identity
    where identity.learner_ref = v_local and identity.user_id <> v_caller
  ) then
    raise exception using errcode = '23505', message = 'learner_identity_conflict';
  end if;
  if exists (select 1 from elos.device_registrations where user_id = v_caller)
     or exists (select 1 from elos.remote_checkpoints where user_id = v_caller)
     or exists (select 1 from elos.canonical_events where user_id = v_caller)
     or exists (select 1 from elos.sync_acknowledgements where user_id = v_caller)
     or exists (select 1 from elos.deletion_tombstones where user_id = v_caller) then
    raise exception using errcode = '23505', message = 'learner_identity_not_pristine';
  end if;

  insert into elos.learner_identity_rebindings(user_id, previous_learner_ref, learner_ref)
  values (v_caller, v_current, v_local)
  returning rebind_id into v_rebind_id;

  update elos.learner_identities
  set learner_ref = v_local
  where user_id = v_caller and learner_ref = v_current;
  if not found then
    raise exception using errcode = '40001', message = 'learner_identity_changed';
  end if;

  return jsonb_build_object('status','REBOUND','learnerRef',v_local,'rebindId',v_rebind_id);
end;
$$;

create or replace function public.elos_rollback_pristine_learner_identity_rebind(
  p_rebind_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_binding elos.learner_identity_rebindings;
begin
  if v_caller is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select binding.* into v_binding
  from elos.learner_identity_rebindings as binding
  where binding.rebind_id = p_rebind_id
    and binding.user_id = v_caller
    and binding.rolled_back_at is null
  for update;

  if v_binding.rebind_id is null then
    raise exception using errcode = '42501', message = 'identity_rebind_not_found';
  end if;
  if exists (select 1 from elos.canonical_events where user_id = v_caller)
     or exists (select 1 from elos.sync_acknowledgements where user_id = v_caller)
     or exists (select 1 from elos.deletion_tombstones where user_id = v_caller) then
    raise exception using errcode = '23505', message = 'identity_rebind_rollback_refused';
  end if;

  delete from elos.remote_checkpoints where user_id = v_caller;
  delete from elos.device_registrations where user_id = v_caller;
  update elos.learner_identities
  set learner_ref = v_binding.previous_learner_ref
  where user_id = v_caller and learner_ref = v_binding.learner_ref;
  if not found then
    raise exception using errcode = '40001', message = 'learner_identity_changed';
  end if;
  update elos.learner_identity_rebindings
  set rolled_back_at = statement_timestamp()
  where rebind_id = v_binding.rebind_id;

  return jsonb_build_object('status','ROLLED_BACK','rebindId',v_binding.rebind_id);
end;
$$;

revoke all on function public.elos_rebind_pristine_learner_identity(text,text) from public, anon;
revoke all on function public.elos_rollback_pristine_learner_identity_rebind(uuid) from public, anon;
grant execute on function public.elos_rebind_pristine_learner_identity(text,text) to authenticated;
grant execute on function public.elos_rollback_pristine_learner_identity_rebind(uuid) to authenticated;

insert into elos.schema_versions(version, checksum)
values (8, 'sha256:0b349038231d17e422ba80805023301dc976220836b81955a2cbf21ccec58af8')
on conflict (version) do nothing;
