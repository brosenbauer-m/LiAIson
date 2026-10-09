-- Migration: vault_char_limit
-- Vault size limit per plan (owner decisions 2026-10-09):
-- Introvert 3,000 / Ambivert 15,000 / Extrovert 30,000 characters in total
-- across all of a user's Vault sections (keep in sync with lib/plans.ts).
-- - The plan comes from plan_changes (latest row in effect). If a downgrade is
--   scheduled, the smaller limit already applies (the Vault must fit it).
-- - A save is refused only if it makes the Vault bigger AND the total is over
--   the limit, so people over the limit can always shorten or delete text.
-- - Enforced in the database, so it applies to every way of saving.

begin;

create or replace function public.plan_vault_limit(p text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p when 'extrovert' then 30000 when 'ambivert' then 15000 else 3000 end;
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
      (select public.plan_vault_limit(c.to_plan) from public.plan_changes c
        where c.user_id = uid and c.effective_at <= now()
        order by c.effective_at desc, c.id desc limit 1),
      (select public.plan_vault_limit(u.plan) from public.users u where u.id = uid),
      3000
    ),
    coalesce(
      (select min(public.plan_vault_limit(c.to_plan)) from public.plan_changes c
        where c.user_id = uid and c.effective_at > now()),
      2147483647
    )
  );
$$;

revoke all on function public.vault_char_limit(uuid) from public, anon, authenticated;

create or replace function public.enforce_vault_char_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_total bigint;
  new_total bigint;
  lim integer;
begin
  select coalesce(sum(char_length(coalesce(s.content, ''))), 0)
    into old_total
    from public.vault_sections s
    where s.user_id = new.user_id;

  new_total := old_total + char_length(coalesce(new.content, ''));
  if tg_op = 'UPDATE' and old.user_id = new.user_id then
    new_total := new_total - char_length(coalesce(old.content, ''));
  end if;

  if new_total <= old_total then
    return new;
  end if;

  lim := public.vault_char_limit(new.user_id);
  if new_total > lim then
    raise exception 'VAULT_LIMIT:%', lim using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_vault_char_limit on public.vault_sections;
create trigger enforce_vault_char_limit
  before insert or update of content on public.vault_sections
  for each row execute function public.enforce_vault_char_limit();

commit;
