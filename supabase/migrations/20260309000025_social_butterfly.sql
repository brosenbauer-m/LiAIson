-- Migration: social_butterfly
-- Social Butterfly (roadmap item 2; decisions in claude/roadmap.md):
-- 1. A fourth plan, 'butterfly'. Its fee follows sliders the person chooses
--    (extra circles, AI searches, Similarity comparisons). The choices are kept
--    with each plan change (plan_changes.options) so month-end bills can charge
--    the most expensive setup held in the month; users.plan_options is a cache.
--    Read-only for users, like plan.
-- 2. Custom circles: named groups of accepted connections (e.g. "Family").
--    A Vault section can be in one custom circle (circle = 'custom' +
--    custom_circle_id). Only that circle's members (and the owner) see it,
--    and only while the owner's plan has custom circles; the app re-checks
--    the accepted connection every time (lib/access/resolveScope.ts).
--    Server-only (circle names and members are never shown to others).
--    Deleting a circle turns its sections into drafts (never more public).
-- 3. Several people compared at once (Similarity for Social Butterfly):
--    similarity_group_results keeps the last result per group, like
--    similarity_results. Server-only. Removed with the viewer or any person in it.
-- Nothing uses 'butterfly' yet; the app adds it in the next changes.

begin;

-- 1. Plan id and slider choices ------------------------------------------

alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check
  check (plan in ('introvert', 'ambivert', 'extrovert', 'butterfly'));

alter table public.users drop constraint if exists users_pending_plan_check;
alter table public.users add constraint users_pending_plan_check
  check (pending_plan is null or pending_plan in ('introvert', 'ambivert', 'extrovert', 'butterfly'));

alter table public.plan_changes drop constraint if exists plan_changes_from_plan_check;
alter table public.plan_changes add constraint plan_changes_from_plan_check
  check (from_plan is null or from_plan in ('introvert', 'ambivert', 'extrovert', 'butterfly'));

alter table public.plan_changes drop constraint if exists plan_changes_to_plan_check;
alter table public.plan_changes add constraint plan_changes_to_plan_check
  check (to_plan in ('introvert', 'ambivert', 'extrovert', 'butterfly'));

alter table public.billing_documents drop constraint if exists billing_documents_plan_check;
alter table public.billing_documents add constraint billing_documents_plan_check
  check (plan is null or plan in ('introvert', 'ambivert', 'extrovert', 'butterfly'));

alter table public.users add column if not exists plan_options jsonb;
alter table public.plan_changes add column if not exists options jsonb;
alter table public.billing_documents add column if not exists plan_options jsonb;

-- Same as before, plus plan_options.
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.billing_exempt := false;
      new.trial_ends_at := now() + interval '30 days';
      new.plan := 'introvert';
      new.pending_plan := null;
      new.plan_options := null;
    elsif new.billing_exempt is distinct from old.billing_exempt
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.plan is distinct from old.plan
       or new.pending_plan is distinct from old.pending_plan
       or new.plan_options is distinct from old.plan_options then
      raise exception 'billing fields can only be changed by LiAIson';
    end if;
  end if;
  return new;
end;
$$;

-- Social Butterfly keeps Extrovert's Vault size (bigger Vaults would make
-- every message to it more expensive for the sender). Keep in sync with lib/plans.ts.
create or replace function public.plan_vault_limit(p text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p when 'butterfly' then 30000 when 'extrovert' then 30000 when 'ambivert' then 15000 else 3000 end;
$$;

-- 2. Custom circles ------------------------------------------------------

create table if not exists public.custom_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index if not exists custom_circles_owner_name_idx
  on public.custom_circles (owner_id, lower(btrim(name)));

create table if not exists public.custom_circle_members (
  circle_id uuid not null references public.custom_circles(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_id, member_id)
);

create index if not exists custom_circle_members_member_idx
  on public.custom_circle_members (member_id);

alter table public.custom_circles enable row level security;
alter table public.custom_circle_members enable row level security;
revoke all on table public.custom_circles from anon, authenticated;
revoke all on table public.custom_circle_members from anon, authenticated;

-- The owner is never a member of their own circle.
create or replace function public.check_custom_circle_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.custom_circles c where c.id = new.circle_id and c.owner_id = new.member_id) then
    raise exception 'owner cannot be a member of their own circle';
  end if;
  return new;
end;
$$;

drop trigger if exists check_custom_circle_member on public.custom_circle_members;
create trigger check_custom_circle_member
  before insert or update on public.custom_circle_members
  for each row execute function public.check_custom_circle_member();

alter table public.vault_sections
  add column if not exists custom_circle_id uuid references public.custom_circles(id) on delete set null;

alter table public.vault_sections drop constraint if exists vault_sections_circle_check;
alter table public.vault_sections add constraint vault_sections_circle_check
  check (circle in ('outer', 'inner', 'draft', 'custom'));

-- A circle id only on custom-circle sections. A 'custom' section without an
-- id (its circle was removed) is seen by no one, like a draft.
alter table public.vault_sections drop constraint if exists vault_sections_custom_circle_check;
alter table public.vault_sections add constraint vault_sections_custom_circle_check
  check (custom_circle_id is null or circle = 'custom');

create index if not exists vault_sections_custom_circle_idx
  on public.vault_sections (custom_circle_id) where custom_circle_id is not null;

-- A section can only use one of its owner's own circles.
create or replace function public.check_section_custom_circle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.custom_circle_id is not null and not exists (
    select 1 from public.custom_circles c where c.id = new.custom_circle_id and c.owner_id = new.user_id
  ) then
    raise exception 'unknown circle';
  end if;
  return new;
end;
$$;

drop trigger if exists check_section_custom_circle on public.vault_sections;
create trigger check_section_custom_circle
  before insert or update of custom_circle_id, user_id on public.vault_sections
  for each row execute function public.check_section_custom_circle();

-- Deleting a circle: its sections become drafts.
create or replace function public.custom_circle_sections_to_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vault_sections
    set circle = 'draft', custom_circle_id = null
    where custom_circle_id = old.id;
  return old;
end;
$$;

drop trigger if exists custom_circle_sections_to_draft on public.custom_circles;
create trigger custom_circle_sections_to_draft
  before delete on public.custom_circles
  for each row execute function public.custom_circle_sections_to_draft();

-- 3. Several people compared at once ----------------------------------------

create table if not exists public.similarity_group_results (
  viewer_id uuid not null references public.users(id) on delete cascade,
  -- the other people's ids, sorted and joined (one row per group)
  group_key text not null,
  target_ids uuid[] not null,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, group_key)
);

create index if not exists similarity_group_results_targets_idx
  on public.similarity_group_results using gin (target_ids);

alter table public.similarity_group_results enable row level security;
revoke all on table public.similarity_group_results from anon, authenticated;

create or replace function public.drop_group_similarity_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.similarity_group_results where old.id = any(target_ids);
  return old;
end;
$$;

drop trigger if exists drop_group_similarity_for_user on public.users;
create trigger drop_group_similarity_for_user
  after delete on public.users
  for each row execute function public.drop_group_similarity_for_user();

commit;
