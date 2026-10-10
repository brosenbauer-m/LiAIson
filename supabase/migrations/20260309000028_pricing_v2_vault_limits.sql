-- Migration: pricing_v2_vault_limits
-- Owner decisions 2026-10-10:
-- - Introvert (free) Vault: 1,000 characters (was 3,000). People already over
--   it can still shorten or delete text (the trigger only refuses growth).
-- - Social Butterfly: the Vault size is a slider (vaultChars, 30,000-60,000
--   in steps of 10,000) stored with the plan's other slider choices.
-- Keep in sync with lib/plans.ts (vaultChars, BUTTERFLY_SLIDERS).

begin;

-- Slider choices, cleaned: each value on its step and within its range.
create or replace function public.normalize_plan_options(opts jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with raw as (
    select
      case when jsonb_typeof(opts->'extraCircles') = 'number' then (opts->>'extraCircles')::numeric end as circles,
      case when jsonb_typeof(opts->'aiSearches') = 'number' then (opts->>'aiSearches')::numeric end as searches,
      case when jsonb_typeof(opts->'similarities') = 'number' then (opts->>'similarities')::numeric end as sims,
      case when jsonb_typeof(opts->'vaultChars') = 'number' then (opts->>'vaultChars')::numeric end as chars
  )
  select jsonb_build_object(
    'extraCircles', least(10, greatest(2, round(coalesce(circles, 2)))),
    'aiSearches', least(100, greatest(20, round(coalesce(searches, 20) / 20) * 20)),
    'similarities', least(500, greatest(100, round(coalesce(sims, 100) / 100) * 100)),
    'vaultChars', least(60000, greatest(30000, round(coalesce(chars, 30000) / 10000) * 10000))
  )::jsonb
  from raw;
$$;

-- Vault size per plan, now with the Social Butterfly slider.
drop function if exists public.plan_vault_limit(text);
create or replace function public.plan_vault_limit(p text, opts jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p
    when 'butterfly' then (public.normalize_plan_options(opts)->>'vaultChars')::integer
    when 'extrovert' then 30000
    when 'ambivert' then 15000
    else 1000
  end;
$$;

create or replace function public.vault_char_limit(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(
    coalesce(
      (select public.plan_vault_limit(c.to_plan, c.options) from public.plan_changes c
        where c.user_id = uid and c.effective_at <= now()
        order by c.effective_at desc, c.id desc limit 1),
      (select public.plan_vault_limit(u.plan, u.plan_options) from public.users u where u.id = uid),
      1000
    ),
    coalesce(
      (select min(public.plan_vault_limit(c.to_plan, c.options)) from public.plan_changes c
        where c.user_id = uid and c.effective_at > now()),
      2147483647
    )
  );
$$;

revoke all on function public.vault_char_limit(uuid) from public, anon, authenticated;

-- Exempt (test) accounts: every slider at its maximum, now incl. Vault size.
insert into public.plan_changes (user_id, from_plan, to_plan, options, effective_at)
select u.id, u.plan, 'butterfly', '{"extraCircles": 10, "aiSearches": 100, "similarities": 500, "vaultChars": 60000}'::jsonb, now()
from public.users u
where u.billing_exempt = true;

update public.users
set plan = 'butterfly',
    pending_plan = null,
    plan_options = '{"extraCircles": 10, "aiSearches": 100, "similarities": 500, "vaultChars": 60000}'::jsonb
where billing_exempt = true;

commit;
