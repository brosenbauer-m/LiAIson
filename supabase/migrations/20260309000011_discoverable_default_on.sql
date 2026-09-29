-- Migration: discoverable_default_on
-- Created: 2026-09-29T10:38:58.992Z

begin;

alter table public.users alter column is_discoverable set default true;
update public.users set is_discoverable = true where is_discoverable is distinct from true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, username, is_discoverable)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'is_discoverable', 'true') <> 'false'
  );

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

commit;
