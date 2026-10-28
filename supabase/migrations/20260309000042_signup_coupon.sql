-- Migration: signup_coupon
-- Owner decision 2026-10-28 (event codes, step 3): a code typed at sign-up
-- travels in the sign-up metadata ("coupon") and is redeemed by the database
-- while the account is made — the person isn't signed in yet at that moment
-- (email confirmation first), so no API call could do it for them. The
-- account gets the higher of the tier they chose and the code's tier. If the
-- code can't be used any more (full, switched off), the account is still
-- made, just without it (the form checked the code a moment earlier).

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_plan text := coalesce(new.raw_user_meta_data->>'plan', 'introvert');
  chosen_options jsonb := null;
  coupon_code text := nullif(trim(coalesce(new.raw_user_meta_data->>'coupon', '')), '');
  ranks text[] := array['introvert', 'ambivert', 'extrovert', 'butterfly'];
  c_tier text;
  c_options jsonb;
begin
  if chosen_plan not in ('introvert', 'ambivert', 'extrovert', 'butterfly') then
    chosen_plan := 'introvert';
  end if;
  if chosen_plan = 'butterfly' then
    chosen_options := public.normalize_plan_options(
      case when jsonb_typeof(new.raw_user_meta_data->'plan_options') = 'object' then new.raw_user_meta_data->'plan_options' end
    );
  end if;

  insert into public.users (id, display_name, username, is_discoverable, plan, plan_options)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'is_discoverable', 'true') <> 'false',
    chosen_plan,
    chosen_options
  );

  if coupon_code is not null then
    begin
      select r.tier, r.plan_options into c_tier, c_options
      from public.redeem_coupon(coupon_code, new.id, true) r;
      if c_tier is not null and array_position(ranks, c_tier) > array_position(ranks, chosen_plan) then
        chosen_plan := c_tier;
        chosen_options := case when c_tier = 'butterfly' then public.normalize_plan_options(c_options) else null end;
        update public.users set plan = chosen_plan, plan_options = chosen_options where id = new.id;
      end if;
    exception when others then
      -- The code is no longer usable: the account is made without it.
      null;
    end;
  end if;

  insert into public.plan_changes (user_id, from_plan, to_plan, options)
  values (new.id, null, chosen_plan, chosen_options);

  insert into public.vault_sections (user_id, domain, section_type, label, content, source, circle)
  values (new.id, 'personal', 'profile_bio', 'Profile Bio', '', 'manual', 'outer');

  return new;
end;
$$;

commit;
