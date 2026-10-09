-- Migration: circles
-- Circles replace Professional / Personal (owner decisions 2026-10-09):
-- - Each Vault section is in the Outer Circle (everyone who can see the
--   profile), the Inner Circle (only people the owner put there) or a Draft.
-- - Introvert has one circle (Outer + Drafts); Ambivert and Extrovert have
--   Inner + Outer. People join the Inner Circle when the owner accepts their
--   connection request (connection_interests.in_inner_circle).
-- - Public / Private stays (users.public_scope: 'none' = Private).
-- This migration only adds and fills the new columns. The app switches to
-- them in the next change; the old columns stay for now (forward-only).
--
-- Filling rules (never makes anything more public than today):
-- - Section with neither flag → draft.
-- - Section the public can see today → outer.
-- - Section only connections can see today → inner (Ambivert/Extrovert);
--   Introvert: outer if the profile is Private (only accepted people can see
--   anything), otherwise draft.
-- - Accepted connection that today sees more than the public → Inner Circle.

begin;

alter table public.vault_sections
  add column if not exists circle text not null default 'outer'
    check (circle in ('outer', 'inner', 'draft'));

alter table public.connection_interests
  add column if not exists in_inner_circle boolean not null default false;

with owner_plan as (
  select
    u.id,
    u.public_scope,
    coalesce(
      (select c.to_plan from public.plan_changes c
        where c.user_id = u.id and c.effective_at <= now()
        order by c.effective_at desc, c.id desc limit 1),
      u.plan
    ) as plan
  from public.users u
)
update public.vault_sections s
set circle = case
  when not (coalesce(s.is_professional, false) or coalesce(s.is_personal, false)) then 'draft'
  when o.public_scope = 'both'
    or (o.public_scope = 'professional' and coalesce(s.is_professional, false))
    or (o.public_scope = 'personal' and coalesce(s.is_personal, false)) then 'outer'
  when o.plan in ('ambivert', 'extrovert') then 'inner'
  when o.public_scope = 'none' then 'outer'
  else 'draft'
end
from owner_plan o
where o.id = s.user_id;

update public.connection_interests ci
set in_inner_circle = case
  when u.public_scope = 'both' then false
  when u.public_scope = 'none' then ci.allowed_scope <> 'none'
  when u.public_scope = 'professional' then ci.allowed_scope in ('personal', 'both')
  when u.public_scope = 'personal' then ci.allowed_scope in ('professional', 'both')
  else false
end
from public.users u
where u.id = ci.to_user_id
  and ci.status = 'accepted';

create index if not exists vault_sections_user_circle_idx
  on public.vault_sections (user_id, circle);

commit;
