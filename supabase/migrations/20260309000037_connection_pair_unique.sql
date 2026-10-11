-- One row per direction of a connection (from_user_id → to_user_id).
-- Two quick clicks at the same time (accepting on the dashboard while pressing
-- Connect on the profile) could otherwise create a second row, after which
-- lookups of the connection fail. Any duplicates are removed first, keeping the
-- most meaningful row (accepted, then pending, then the newest).
begin;

with ranked as (
	select id, row_number() over (
		partition by from_user_id, to_user_id
		order by case status when 'accepted' then 0 when 'pending' then 1 else 2 end,
			in_inner_circle desc, created_at desc, id
	) as rn
	from public.connection_interests
)
delete from public.connection_interests c
using ranked r
where c.id = r.id and r.rn > 1;

create unique index if not exists connection_interests_pair_key
	on public.connection_interests (from_user_id, to_user_id);

drop index if exists public.connection_interests_from_to_idx;

commit;
