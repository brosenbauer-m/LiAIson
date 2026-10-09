-- Migration: profile_field_checks
-- Signed-in users can update their own users row directly (RLS "update own
-- profile"). The app checks these fields, but direct API calls skipped those
-- checks. This trigger enforces the same rules in the database, only for
-- users themselves (not the server) and only for fields that actually change,
-- so existing rows are never blocked.
-- - username: same format and reserved names as lib/constants/username.ts
-- - display_name: 1–80 characters
-- - short_bio: at most 300 characters (the app allows 160)
-- - contact_links: a list of at most 10 { platform, url } items, url ≤ 300 characters
-- - avatar_url: an https address of at most 500 characters (the app also only
--   shows pictures from our own storage)

begin;

create or replace function public.check_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  link jsonb;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.username is distinct from old.username and (
    new.username !~ '^[a-z0-9-]{3,30}$'
    or new.username in ('api', 'admin', 'dashboard', 'vault', 'discover', 'login', 'signup', 'settings', 'profile', 'privacy', 'demo')
  ) then
    raise exception 'invalid username';
  end if;

  if new.display_name is distinct from old.display_name
     and char_length(btrim(coalesce(new.display_name, ''))) not between 1 and 80 then
    raise exception 'invalid display name';
  end if;

  if new.short_bio is distinct from old.short_bio and char_length(coalesce(new.short_bio, '')) > 300 then
    raise exception 'bio too long';
  end if;

  if new.contact_links is distinct from old.contact_links and new.contact_links is not null then
    if jsonb_typeof(new.contact_links) <> 'array' or jsonb_array_length(new.contact_links) > 10 then
      raise exception 'invalid contact links';
    end if;
    for link in select * from jsonb_array_elements(new.contact_links) loop
      if jsonb_typeof(link) <> 'object'
         or jsonb_typeof(link->'url') is distinct from 'string'
         or char_length(link->>'url') > 300
         or (link ? 'platform' and jsonb_typeof(link->'platform') <> 'string') then
        raise exception 'invalid contact links';
      end if;
    end loop;
  end if;

  if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
     and (new.avatar_url !~ '^https://' or char_length(new.avatar_url) > 500) then
    raise exception 'invalid avatar';
  end if;

  return new;
end;
$$;

drop trigger if exists check_profile_fields on public.users;
create trigger check_profile_fields
  before update on public.users
  for each row execute function public.check_profile_fields();

commit;
