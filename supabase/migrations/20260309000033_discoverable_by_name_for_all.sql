-- Migration: discoverable_by_name_for_all
-- Owner decision 2026-10-10: the separate "Discoverable" switch is removed and
-- folded into Public / Private:
-- - Public: found on Discover by name, username and description (AI search
--   over the Outer Circle).
-- - Private: found only by name and username.
-- So everyone is findable by name again (is_discoverable is kept but always
-- true); the AI search index already only covers Public profiles.

begin;

alter table public.users alter column is_discoverable set default true;
update public.users set is_discoverable = true where is_discoverable is distinct from true;

commit;
