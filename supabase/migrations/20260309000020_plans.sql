-- Migration: plans
-- Plans (owner decisions 2026-10-09):
-- - Plans: introvert (free), ambivert, extrovert. Chosen at sign-up; the free
--   month gives that plan's features, then it continues automatically (card required).
-- - Upgrades apply at once; downgrades apply at the end of the month (pending_plan).
-- - plan_changes keeps the history, so the month-end bill can charge the highest
--   paid plan held in the month.
-- - plan / pending_plan are read-only for users (changed only by the server).
-- - billing_accounts.mandate_since: when the saved card first became valid
--   (the plan fee starts from the later of trial end and this date).
-- - billing_documents.plan / plan_fee_eur: the plan fee line on monthly bills.
-- - The two exempt accounts get extrovert (never billed).
-- Nothing reads these columns yet; enforcement comes in later changes.

begin;

alter table public.users
  add column if not exists plan text not null default 'introvert'
    check (plan in ('introvert', 'ambivert', 'extrovert'));

alter table public.users
  add column if not exists pending_plan text
    check (pending_plan is null or pending_plan in ('introvert', 'ambivert', 'extrovert'));

update public.users set plan = 'extrovert' where billing_exempt = true;

create table if not exists public.plan_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  from_plan text check (from_plan is null or from_plan in ('introvert', 'ambivert', 'extrovert')),
  to_plan text not null check (to_plan in ('introvert', 'ambivert', 'extrovert')),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists plan_changes_user_effective_idx
  on public.plan_changes (user_id, effective_at);

-- Server only: RLS on, no policies.
alter table public.plan_changes enable row level security;

alter table public.billing_accounts
  add column if not exists mandate_since timestamptz;

update public.billing_accounts
  set mandate_since = updated_at
  where mandate_status = 'valid' and mandate_since is null;

alter table public.billing_documents
  add column if not exists plan text
    check (plan is null or plan in ('introvert', 'ambivert', 'extrovert'));

alter table public.billing_documents
  add column if not exists plan_fee_eur numeric(12, 4) not null default 0
    check (plan_fee_eur >= 0);

-- Users may not change their own billing fields (incl. plan) directly.
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
    elsif new.billing_exempt is distinct from old.billing_exempt
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.plan is distinct from old.plan
       or new.pending_plan is distinct from old.pending_plan then
      raise exception 'billing fields can only be changed by LiAIson';
    end if;
  end if;
  return new;
end;
$$;

-- Sign-up: same as before, plus the plan chosen on the sign-up form
-- (only known plan names are accepted; anything else → introvert).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_plan text := coalesce(new.raw_user_meta_data->>'plan', 'introvert');
begin
  if chosen_plan not in ('introvert', 'ambivert', 'extrovert') then
    chosen_plan := 'introvert';
  end if;

  insert into public.users (id, display_name, username, is_discoverable, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'is_discoverable', 'true') <> 'false',
    chosen_plan
  );

  insert into public.plan_changes (user_id, from_plan, to_plan)
  values (new.id, null, chosen_plan);

  insert into public.vault_sections
    (user_id, domain, section_type, label, content, source, is_professional, is_personal)
  values
    (new.id, 'professional', 'current_role',  'Current Role',            '', 'manual', true,  false),
    (new.id, 'professional', 'skills',        'Skills & Expertise',      '', 'manual', true,  false),
    (new.id, 'professional', 'work_history',  'Work History',            '', 'manual', true,  false),
    (new.id, 'professional', 'education',     'Education',               '', 'manual', true,  false),
    (new.id, 'professional', 'projects',      'Projects & Publications', '', 'manual', true,  false),
    (new.id, 'professional', 'opportunities', 'Open to Opportunities',   '', 'manual', true,  false),
    (new.id, 'personal',     'bio',           'About Me',                '', 'manual', false, true),
    (new.id, 'personal',     'hobbies',       'Hobbies & Interests',     '', 'manual', false, true),
    (new.id, 'personal',     'location',      'Location',                '', 'manual', false, true),
    (new.id, 'personal',     'looking_for',   'Looking For',             '', 'manual', false, true),
    (new.id, 'personal',     'values',        'Values & Personality',    '', 'manual', false, true),
    (new.id, 'personal',     'lifestyle',     'Lifestyle',               '', 'manual', false, true);

  return new;
end;
$$;

-- Existing accounts: record their starting plan.
insert into public.plan_changes (user_id, from_plan, to_plan, effective_at)
select u.id, null, u.plan, coalesce(u.created_at, now())
from public.users u
where not exists (select 1 from public.plan_changes p where p.user_id = u.id);

commit;
