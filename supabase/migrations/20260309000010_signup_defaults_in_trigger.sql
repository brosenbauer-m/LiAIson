-- Migration: signup_defaults_in_trigger
-- Created: 2026-09-29T00:12:51.232Z

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.users (id, display_name, username)
	values (
		new.id,
		coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
		coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))
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

insert into public.vault_sections
	(user_id, domain, section_type, label, content, source, is_professional, is_personal)
select u.id, d.domain, d.section_type, d.label, '', 'manual', d.domain = 'professional', d.domain = 'personal'
from public.users u
cross join (values
	('professional', 'current_role',  'Current Role'),
	('professional', 'skills',        'Skills & Expertise'),
	('professional', 'work_history',  'Work History'),
	('professional', 'education',     'Education'),
	('professional', 'projects',      'Projects & Publications'),
	('professional', 'opportunities', 'Open to Opportunities'),
	('personal',     'bio',           'About Me'),
	('personal',     'hobbies',       'Hobbies & Interests'),
	('personal',     'location',      'Location'),
	('personal',     'looking_for',   'Looking For'),
	('personal',     'values',        'Values & Personality'),
	('personal',     'lifestyle',     'Lifestyle')
) as d(domain, section_type, label)
where not exists (select 1 from public.vault_sections v where v.user_id = u.id);

commit;
