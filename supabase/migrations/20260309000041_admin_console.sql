-- Migration: admin_console
-- Owner decisions 2026-10-28, admin console (step 2):
-- - The admin account is called "admin" (username) whatever was typed at
--   sign-up, so the reserved name never has to be opened up for everyone.
-- - Summaries over the AI usage log and the bills for the admin pages, as
--   database functions (service role only): totals by month and feature,
--   per user, and for the people who used an event code.

begin;

create or replace function public.mark_admin_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'contact@my-liaison.app'
     and not exists (select 1 from public.users where is_admin) then
    update public.users
      set is_admin = true,
          display_name = 'LiAIson',
          username = case when exists (select 1 from public.users where username = 'admin') then username else 'admin' end,
          is_discoverable = false, discover_mode = 'unlisted', public_scope = 'none', billing_exempt = true
      where id = new.id;
  end if;
  return new;
end;
$$;

-- AI usage between two moments, by month (Vienna), feature and model.
-- With p_campaign: only what the people who used that event code did during
-- their sponsored period.
create or replace function public.admin_usage_summary(p_since timestamptz, p_until timestamptz, p_campaign uuid default null)
returns table (month date, feature text, model text, calls bigint, prompt_tokens bigint, completion_tokens bigint, users bigint)
language sql
stable
set search_path = public
as $$
  select
    date_trunc('month', u.created_at at time zone 'Europe/Vienna')::date as month,
    u.feature,
    u.model,
    count(*)::bigint as calls,
    coalesce(sum(u.prompt_tokens), 0)::bigint as prompt_tokens,
    coalesce(sum(u.completion_tokens), 0)::bigint as completion_tokens,
    count(distinct u.user_id)::bigint as users
  from public.ai_usage u
  where u.created_at >= p_since and u.created_at < p_until
    and (p_campaign is null or exists (
      select 1 from public.coupon_redemptions r
      where r.campaign_id = p_campaign and r.user_id = u.user_id
        and u.created_at >= r.redeemed_at and u.created_at < r.period_ends_at
    ))
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

-- AI usage per user since a moment, by feature and model (accounts list).
create or replace function public.admin_usage_by_user(p_since timestamptz)
returns table (user_id uuid, feature text, model text, calls bigint, prompt_tokens bigint, completion_tokens bigint)
language sql
stable
set search_path = public
as $$
  select u.user_id, u.feature, u.model, count(*)::bigint, coalesce(sum(u.prompt_tokens), 0)::bigint, coalesce(sum(u.completion_tokens), 0)::bigint
  from public.ai_usage u
  where u.created_at >= p_since
  group by 1, 2, 3;
$$;

-- Bills and receipts by month and status (money page).
create or replace function public.admin_billing_summary(p_since timestamptz)
returns table (month date, kind text, status text, documents bigint, usage_eur numeric, plan_fee_eur numeric, prepaid_applied_eur numeric, total_eur numeric)
language sql
stable
set search_path = public
as $$
  select
    date_trunc('month', coalesce(d.period_start, d.created_at) at time zone 'Europe/Vienna')::date as month,
    d.kind, d.status,
    count(*)::bigint,
    coalesce(sum(d.usage_eur), 0), coalesce(sum(d.plan_fee_eur), 0), coalesce(sum(d.prepaid_applied_eur), 0), coalesce(sum(d.total_eur), 0)
  from public.billing_documents d
  where coalesce(d.period_start, d.created_at) >= p_since
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

-- Balance movements by month and kind (top-ups, event credit, expiry…).
create or replace function public.admin_balance_summary(p_since timestamptz)
returns table (month date, kind text, entries bigint, amount_eur numeric)
language sql
stable
set search_path = public
as $$
  select date_trunc('month', e.created_at at time zone 'Europe/Vienna')::date, e.kind, count(*)::bigint, coalesce(sum(e.amount_eur), 0)
  from public.billing_balance_entries e
  where e.created_at >= p_since
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.admin_usage_summary(timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.admin_usage_by_user(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_billing_summary(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_balance_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_usage_summary(timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.admin_usage_by_user(timestamptz) to service_role;
grant execute on function public.admin_billing_summary(timestamptz) to service_role;
grant execute on function public.admin_balance_summary(timestamptz) to service_role;

commit;
