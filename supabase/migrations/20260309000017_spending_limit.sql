-- Migration: spending_limit
-- Pay-as-you-go foundation.
-- 1) users.monthly_spend_limit_cents: the owner's monthly spending limit for their
--    LiAIson's AI usage (default €15, owner can change it in Settings, 0–€500).
--    When the month's metered usage reaches it, the LiAIson pauses for visitors.
-- 2) ai_usage_since(): server-only aggregate of ai_usage per feature and model,
--    so usage can be summed without loading every row. Not callable by anon or
--    signed-in users; only the service role may execute it.

begin;

alter table public.users
  add column if not exists monthly_spend_limit_cents integer not null default 1500;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_monthly_spend_limit_range'
  ) then
    alter table public.users
      add constraint users_monthly_spend_limit_range
      check (monthly_spend_limit_cents between 0 and 50000);
  end if;
end $$;

create or replace function public.ai_usage_since(p_user_id uuid, p_since timestamptz)
returns table (
  feature text,
  model text,
  calls bigint,
  prompt_tokens bigint,
  completion_tokens bigint
)
language sql
stable
set search_path = public
as $$
  select
    u.feature,
    u.model,
    count(*)::bigint as calls,
    coalesce(sum(u.prompt_tokens), 0)::bigint as prompt_tokens,
    coalesce(sum(u.completion_tokens), 0)::bigint as completion_tokens
  from public.ai_usage u
  where u.user_id = p_user_id
    and u.created_at >= p_since
  group by u.feature, u.model;
$$;

revoke all on function public.ai_usage_since(uuid, timestamptz) from public;
revoke all on function public.ai_usage_since(uuid, timestamptz) from anon;
revoke all on function public.ai_usage_since(uuid, timestamptz) from authenticated;
grant execute on function public.ai_usage_since(uuid, timestamptz) to service_role;

commit;
