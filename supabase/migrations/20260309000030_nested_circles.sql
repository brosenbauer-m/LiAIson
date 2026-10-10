-- Migration: nested_circles
-- Owner decision 2026-10-10: circles form a hierarchy, so the same text never
-- has to be added to several circles. Everyone in a circle also sees every
-- circle around it:
--   Outer Circle  >  Inner Circle  >  own circles placed inside the Inner Circle
--   Outer Circle  >  own circles placed directly in the Outer Circle
--   an own circle  >  own circles placed inside it
-- - custom_circles.parent_id: the own circle this one sits in (null = it sits
--   directly in the Outer or the Inner Circle).
-- - custom_circles.in_inner: for a circle without parent_id, whether it sits in
--   the Inner Circle. Always false when parent_id is set (the outermost own
--   circle decides).
-- Who sees what is worked out in lib/access/resolveScope.ts. Deleting a circle
-- moves the circles inside it up one level (done by /api/circles); if that is
-- ever skipped, they end up directly in the Outer Circle, which shows less.

begin;

alter table public.custom_circles
  add column if not exists parent_id uuid references public.custom_circles(id) on delete set null,
  add column if not exists in_inner boolean not null default false;

create index if not exists custom_circles_parent_idx
  on public.custom_circles (parent_id) where parent_id is not null;

-- A circle can only sit in another circle of the same person, never in
-- itself or in a circle inside it, and at most 4 own circles deep.
create or replace function public.check_custom_circle_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cursor_id uuid := new.parent_id;
  parent_owner uuid;
  depth int := 1;
begin
  if new.parent_id is null then
    return new;
  end if;
  new.in_inner := false;

  -- One change per person at a time, so two moves can't form a loop together.
  perform pg_advisory_xact_lock(hashtext('custom_circles:' || new.owner_id::text));

  select owner_id into parent_owner from public.custom_circles where id = new.parent_id;
  if parent_owner is null or parent_owner <> new.owner_id then
    raise exception 'CIRCLE_PARENT_INVALID' using errcode = 'P0001';
  end if;

  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'CIRCLE_PARENT_LOOP' using errcode = 'P0001';
    end if;
    depth := depth + 1;
    if depth > 4 then
      raise exception 'CIRCLE_TOO_DEEP' using errcode = 'P0001';
    end if;
    select parent_id into cursor_id from public.custom_circles where id = cursor_id;
  end loop;

  -- Circles already inside this one count towards the depth too.
  if tg_op = 'UPDATE' and depth + (
    with recursive below(id, level) as (
      select c.id, 1 from public.custom_circles c where c.parent_id = new.id
      union all
      select c.id, b.level + 1 from public.custom_circles c join below b on c.parent_id = b.id where b.level < 5
    )
    select coalesce(max(level), 0) from below
  ) > 4 then
    raise exception 'CIRCLE_TOO_DEEP' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists check_custom_circle_parent on public.custom_circles;
create trigger check_custom_circle_parent
  before insert or update of parent_id, in_inner, owner_id on public.custom_circles
  for each row execute function public.check_custom_circle_parent();

revoke all on function public.check_custom_circle_parent() from public, anon, authenticated;

commit;
