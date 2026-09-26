-- V1-B04: Cover foreign keys used by canonical shadow cleanup and joins.
create index canonical_events_device_id_idx
  on elos.canonical_events (device_id);
create index canonical_events_learner_ref_idx
  on elos.canonical_events (learner_ref);
create index deletion_tombstones_learner_ref_idx
  on elos.deletion_tombstones (learner_ref);
create index device_registrations_learner_ref_idx
  on elos.device_registrations (learner_ref);

insert into elos.schema_versions(version, checksum)
values (3, 'sha256:355fa53bdadc9b29d76fd2680f4feda28635ec8cc178864bdb6006d2b7018d03')
on conflict (version) do nothing;
