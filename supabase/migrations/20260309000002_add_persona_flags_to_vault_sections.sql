-- Migration: add_persona_flags_to_vault_sections
-- Created: 2026-09-27T00:21:10.775Z

begin;

alter table public.vault_sections
	add column is_professional boolean not null default false,
	add column is_personal boolean not null default false;

update public.vault_sections
set is_professional = true
where domain = 'professional';

update public.vault_sections
set is_personal = true
where domain = 'personal';

commit;
