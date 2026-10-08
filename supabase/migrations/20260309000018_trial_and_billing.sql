-- Migration: trial_and_billing
-- Free trial foundation (owner decisions 2026-10-08).
-- 1) users.trial_ends_at: end of the free month. New accounts: 30 days after sign-up.
--    Existing accounts: 30 days from today (the day trials go live).
-- 2) users.billing_exempt: accounts that never need a trial or payment.
--    Only the two original accounts (@brosenbauerm, @adminuser) are exempt.
-- 3) Both columns are read-only for users: the users table has an "update own row"
--    policy, so a trigger blocks signed-in users from changing them. Only the
--    server (service role) and migrations can change them.
-- Nothing reads these columns yet; enforcement comes in a later change.

begin;

alter table public.users
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '30 days');

alter table public.users
  add column if not exists billing_exempt boolean not null default false;

update public.users
  set billing_exempt = true
  where username in ('brosenbauerm', 'adminuser');

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
    elsif new.billing_exempt is distinct from old.billing_exempt
       or new.trial_ends_at is distinct from old.trial_ends_at then
      raise exception 'billing fields can only be changed by LiAIson';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.users;
create trigger protect_billing_columns
  before insert or update on public.users
  for each row execute function public.protect_billing_columns();

commit;
