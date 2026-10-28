-- Migration: coupons_and_admin
-- Owner decisions 2026-10-28:
-- - Event codes: an organisation (a conference, a company) pays for its
--   participants to get a paid tier free for a period plus some AI credit.
--   A campaign has either ONE shared code with a number of seats, or many
--   single-use codes. Codes can be for new accounts, existing accounts or both.
--   Leftover event credit is gone when the period ends (handled by the app).
-- - One admin account (email contact@my-liaison.app) for creating codes and
--   running the site. It is marked once, at sign-up, and there can only ever
--   be one admin.
-- All new tables are server-only (RLS on, no policies; service role via API
-- routes). Redeeming is one database function so the seat, the credit and the
-- period are given together (never a seat without credit or the reverse).

begin;

-- 1. The admin account -------------------------------------------------------

alter table public.users add column if not exists is_admin boolean not null default false;

-- Only one admin, ever.
create unique index if not exists users_single_admin on public.users (is_admin) where is_admin;

-- Signed-in users can't make themselves admin (same guard as the billing columns).
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin can only be changed by LiAIson';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_flag on public.users;
create trigger protect_admin_flag
  before insert or update on public.users
  for each row execute function public.protect_admin_flag();

-- The account that signs up with the admin email becomes the admin, once:
-- only while no admin exists yet. Runs after handle_new_user made the profile.
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
      set is_admin = true, is_discoverable = false, discover_mode = 'unlisted', public_scope = 'none', billing_exempt = true
      where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute function public.mark_admin_account();

-- 2. Event codes ---------------------------------------------------------------

-- The period a code gives (end of the free tier + credit) on the account.
alter table public.users add column if not exists sponsored_until timestamptz;

create table if not exists public.coupon_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- e.g. "Web Summit 2026"
  organisation text,                        -- who pays
  mode text not null check (mode in ('shared', 'individual')),
  audience text not null default 'both' check (audience in ('new', 'existing', 'both')),
  tier text not null check (tier in ('introvert', 'ambivert', 'extrovert', 'butterfly')),
  plan_options jsonb,                       -- Social Butterfly slider choices
  free_days integer not null check (free_days between 1 and 365),
  credit_eur numeric(10, 2) not null default 0 check (credit_eur >= 0 and credit_eur <= 1000),
  seats integer not null check (seats between 1 and 10000),
  expires_at timestamptz,                   -- last moment a code can be entered
  active boolean not null default true,
  archived_at timestamptz,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.coupon_campaigns(id) on delete cascade,
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9-]{4,40}$'),
  max_uses integer not null check (max_uses >= 1),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create index if not exists coupon_codes_campaign_idx on public.coupon_codes (campaign_id);

create table if not exists public.coupon_redemptions (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.coupon_campaigns(id) on delete cascade,
  code_id uuid not null references public.coupon_codes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  new_account boolean not null,
  redeemed_at timestamptz not null default now(),
  period_ends_at timestamptz not null,
  credit_eur numeric(10, 2) not null,
  credit_expired_at timestamptz,            -- when leftover credit was taken away
  unique (campaign_id, user_id)             -- once per account per campaign
);

create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id);
create index if not exists coupon_redemptions_period_idx on public.coupon_redemptions (period_ends_at) where credit_expired_at is null;

alter table public.coupon_campaigns enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Event credit in the prepaid balance.
alter table public.billing_balance_entries drop constraint if exists billing_balance_entries_kind_check;
alter table public.billing_balance_entries add constraint billing_balance_entries_kind_check
  check (kind in ('topup', 'usage', 'refund', 'adjustment', 'coupon', 'coupon_expiry'));

-- Redeems a code for a user (server only). Takes the seat, adds the credit,
-- sets the period on the account — all or nothing. Errors (the app shows
-- them): coupon_not_found, coupon_inactive, coupon_expired, coupon_full,
-- coupon_new_accounts_only, coupon_existing_accounts_only, coupon_already_used.
-- p_new_account: true when called right after sign-up.
create or replace function public.redeem_coupon(p_code text, p_user_id uuid, p_new_account boolean)
returns table (campaign_id uuid, tier text, plan_options jsonb, free_days integer, credit_eur numeric, period_ends_at timestamptz, campaign_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.coupon_codes%rowtype;
  v_camp public.coupon_campaigns%rowtype;
  v_ends timestamptz;
begin
  select * into v_code from public.coupon_codes c where c.code = upper(trim(p_code)) for update;
  if not found then raise exception 'coupon_not_found'; end if;
  select * into v_camp from public.coupon_campaigns k where k.id = v_code.campaign_id for update;
  if not v_camp.active or v_camp.archived_at is not null then raise exception 'coupon_inactive'; end if;
  if v_camp.expires_at is not null and v_camp.expires_at < now() then raise exception 'coupon_expired'; end if;
  if v_camp.audience = 'new' and not p_new_account then raise exception 'coupon_new_accounts_only'; end if;
  if v_camp.audience = 'existing' and p_new_account then raise exception 'coupon_existing_accounts_only'; end if;
  if exists (select 1 from public.coupon_redemptions r where r.campaign_id = v_camp.id and r.user_id = p_user_id) then
    raise exception 'coupon_already_used';
  end if;
  if v_code.uses >= v_code.max_uses then raise exception 'coupon_full'; end if;

  v_ends := now() + make_interval(days => v_camp.free_days);

  update public.coupon_codes set uses = uses + 1 where id = v_code.id;
  insert into public.coupon_redemptions (campaign_id, code_id, user_id, new_account, period_ends_at, credit_eur)
    values (v_camp.id, v_code.id, p_user_id, p_new_account, v_ends, v_camp.credit_eur);
  if v_camp.credit_eur > 0 then
    insert into public.billing_balance_entries (user_id, amount_eur, kind) values (p_user_id, v_camp.credit_eur, 'coupon');
  end if;
  update public.users
    set sponsored_until = greatest(coalesce(sponsored_until, v_ends), v_ends),
        trial_ends_at = greatest(trial_ends_at, v_ends)
    where id = p_user_id;

  return query select v_camp.id, v_camp.tier, v_camp.plan_options, v_camp.free_days, v_camp.credit_eur, v_ends, v_camp.name;
end;
$$;

revoke all on function public.redeem_coupon(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.redeem_coupon(text, uuid, boolean) to service_role;

-- Gives a seat back when an account is deleted before its email was ever
-- confirmed (the daily cleanup calls this first). Server only.
create or replace function public.release_coupon_seats(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in select code_id from public.coupon_redemptions where user_id = p_user_id loop
    update public.coupon_codes set uses = greatest(0, uses - 1) where id = r.code_id;
    n := n + 1;
  end loop;
  delete from public.coupon_redemptions where user_id = p_user_id;
  return n;
end;
$$;

revoke all on function public.release_coupon_seats(uuid) from public, anon, authenticated;
grant execute on function public.release_coupon_seats(uuid) to service_role;

commit;
