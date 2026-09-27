-- Migration: restrict_connection_updates
-- Created: 2026-09-27T11:24:46.612Z

begin;

drop policy "Users manage own connections" on public.connection_interests;

create policy "Users view own connections"
	on public.connection_interests for select
	using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users insert own outgoing interest"
	on public.connection_interests for insert
	with check (auth.uid() = from_user_id);

create policy "Users update own outgoing connection"
	on public.connection_interests for update
	using (auth.uid() = from_user_id)
	with check (auth.uid() = from_user_id);

commit;
