-- Migration: profile_bio_section
-- Owner decisions 2026-10-10:
-- - The profile bio is part of the Vault: one "Profile Bio" section per person
--   (section_type 'profile_bio'). It can't be deleted, always stays in the
--   Outer Circle (so everyone who can see the profile, in every circle, sees
--   it) and holds at most 300 characters. users.short_bio (shown on the
--   profile and in Discover) is kept in step with it automatically.
-- - New accounts start with only this section (no more pre-made empty
--   sections). Existing empty pre-made sections are removed.
-- - Sign-up accepts Social Butterfly with its slider choices.

begin;

-- 1. One Profile Bio section per person, filled from today's bio.
alter table public.vault_sections disable trigger enforce_vault_char_limit;

insert into public.vault_sections (user_id, domain, section_type, label, content, source, circle)
select u.id, 'personal', 'profile_bio', 'Profile Bio', left(coalesce(u.short_bio, ''), 300), 'manual', 'outer'
from public.users u
where not exists (
  select 1 from public.vault_sections s where s.user_id = u.id and s.section_type = 'profile_bio'
);

alter table public.vault_sections enable trigger enforce_vault_char_limit;

create unique index if not exists vault_sections_one_profile_bio
  on public.vault_sections (user_id) where section_type = 'profile_bio';

-- 2. Rules for the Profile Bio section.
create or replace function public.protect_profile_bio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.section_type = 'profile_bio' and current_user in ('authenticated', 'anon') then
      raise exception 'The profile bio can''t be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.section_type = 'profile_bio' then
    new.section_type := 'profile_bio';
  end if;
  if new.section_type = 'profile_bio' then
    new.label := 'Profile Bio';
    new.circle := 'outer';
    new.custom_circle_id := null;
    if char_length(coalesce(new.content, '')) > 300 then
      raise exception 'The profile bio can have at most 300 characters';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_bio on public.vault_sections;
create trigger protect_profile_bio
  before insert or update or delete on public.vault_sections
  for each row execute function public.protect_profile_bio();

-- users.short_bio follows the Profile Bio section.
create or replace function public.sync_profile_bio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.section_type = 'profile_bio' then
    update public.users set short_bio = nullif(left(coalesce(new.content, ''), 300), '') where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_bio on public.vault_sections;
create trigger sync_profile_bio
  after insert or update of content on public.vault_sections
  for each row execute function public.sync_profile_bio();

-- 3. Remove pre-made sections that were never filled in.
delete from public.vault_sections s
where btrim(coalesce(s.content, '')) = ''
  and s.source = 'manual'
  and (s.section_type, s.label) in (
    ('current_role', 'Current Role'), ('skills', 'Skills & Expertise'), ('work_history', 'Work History'),
    ('education', 'Education'), ('projects', 'Projects & Publications'), ('opportunities', 'Open to Opportunities'),
    ('bio', 'About Me'), ('hobbies', 'Hobbies & Interests'), ('location', 'Location'),
    ('looking_for', 'Looking For'), ('values', 'Values & Personality'), ('lifestyle', 'Lifestyle')
  );

-- 4. Sign-up: plan (incl. Social Butterfly with its sliders) and only the Profile Bio section.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_plan text := coalesce(new.raw_user_meta_data->>'plan', 'introvert');
  chosen_options jsonb := null;
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

  insert into public.plan_changes (user_id, from_plan, to_plan, options)
  values (new.id, null, chosen_plan, chosen_options);

  insert into public.vault_sections (user_id, domain, section_type, label, content, source, circle)
  values (new.id, 'personal', 'profile_bio', 'Profile Bio', '', 'manual', 'outer');

  return new;
end;
$$;

commit;
