-- Migration: drop_vault_visibility
-- Created: 2026-09-27T09:50:27.255Z

begin;

drop policy if exists "Public vault sections viewable" on public.vault_sections;

alter table public.vault_sections
	drop column if exists visibility;

commit;
