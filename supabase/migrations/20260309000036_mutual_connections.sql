-- Migration: mutual_connections
-- Owner decision 2026-10-11: a connection goes both ways. When B accepts A's
-- request, both see each other (each in the circle the other chose). A row
-- in connection_interests stays one direction (from_user sees to_user, in the
-- circle to_user chose), so an accepted connection is now always a pair.
-- - requester_placement: the circle the requester chose for the other person
--   when sending ('outer', 'inner' or one of the requester's own circle ids;
--   null = Outer). Applied by /api/connections/respond on accept.
-- - Existing accepted connections get their missing other half, in the
--   Outer Circle (existing circle choices are kept).

begin;

alter table public.connection_interests
  add column if not exists requester_placement text;

-- A pending request the other way round is accepted too.
update public.connection_interests r
set status = 'accepted', allowed_scope = 'both'
where r.status = 'pending'
  and exists (
    select 1 from public.connection_interests c
    where c.status = 'accepted' and c.from_user_id = r.to_user_id and c.to_user_id = r.from_user_id
  );

insert into public.connection_interests (from_user_id, to_user_id, status, allowed_scope, in_inner_circle)
select distinct c.to_user_id, c.from_user_id, 'accepted', 'both', false
from public.connection_interests c
where c.status = 'accepted'
  and not exists (
    select 1 from public.connection_interests r
    where r.from_user_id = c.to_user_id and r.to_user_id = c.from_user_id
  );

commit;
