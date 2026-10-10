-- Migration: isolated_circles
-- Owner decision 2026-10-10: an own circle can also sit on its own, outside
-- the Outer Circle (custom_circles.isolated). Its people see that circle (and,
-- for a circle inside it, the circles around theirs) but not the Outer Circle,
-- unless the profile is Public (then everyone sees the Outer Circle) or they
-- are also in a circle that shows it. Worked out in
-- lib/access/resolveScope.ts. isolated is only kept for a circle without
-- parent_id and never together with in_inner.

begin;

alter table public.custom_circles
  add column if not exists isolated boolean not null default false;

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
    -- On its own outside the Outer Circle, or in the Inner Circle: not both.
    if new.isolated then
      new.in_inner := false;
    end if;
    return new;
  end if;
  new.in_inner := false;
  new.isolated := false;

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
  before insert or update of parent_id, in_inner, isolated, owner_id on public.custom_circles
  for each row execute function public.check_custom_circle_parent();

revoke all on function public.check_custom_circle_parent() from public, anon, authenticated;

commit;
