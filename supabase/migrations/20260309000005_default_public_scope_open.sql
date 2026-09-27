-- Migration: default_public_scope_open
-- Created: 2026-09-27T11:00:08.421Z

begin;

alter table public.users alter column public_scope set default 'both';
update public.users set public_scope = 'both' where public_scope = 'none';

commit;
