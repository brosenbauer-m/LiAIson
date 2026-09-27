-- Migration: connections_request_accept
-- Created: 2026-09-27T23:04:59.978Z

begin;

alter table public.connection_interests
	drop constraint if exists connection_interests_status_check;

update public.connection_interests c
set allowed_scope = r.allowed_scope
from public.connection_interests r
where c.status = 'matched'
	and r.status = 'matched'
	and r.from_user_id = c.to_user_id
	and r.to_user_id = c.from_user_id
	and r.id <> c.id;

update public.connection_interests set status = 'accepted' where status = 'matched';
update public.connection_interests set status = 'pending' where status = 'owner_opened';
update public.connection_interests set status = 'pending' where status is null;

alter table public.connection_interests
	alter column status set default 'pending',
	alter column status set not null;

alter table public.connection_interests
	add constraint connection_interests_status_check
	check (status in ('pending', 'accepted', 'declined'));

drop policy if exists "Users manage own connections" on public.connection_interests;
drop policy if exists "Users view own connections" on public.connection_interests;
drop policy if exists "Users insert own outgoing interest" on public.connection_interests;
drop policy if exists "Users update own outgoing connection" on public.connection_interests;

alter table public.connection_interests enable row level security;

create index if not exists connection_interests_from_to_idx
	on public.connection_interests (from_user_id, to_user_id);
create index if not exists connection_interests_to_status_idx
	on public.connection_interests (to_user_id, status);

commit;
