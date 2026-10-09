-- Migration: search index for Discover AI search
-- Owner decisions 2026-10-09:
-- - Only profiles that are Public AND Discoverable can be searched by content,
--   and only their Outer Circle. Private profiles can still be found by name.
-- - No extra profile fields (city, age): the search reads what people wrote.
--
-- search_chunks holds those Outer Circle paragraphs plus an embedding (a
-- numeric fingerprint made with mistral-embed, EU) so searches never need to
-- send whole Vaults to the AI. Server-only: RLS on, no policies.
--
-- Privacy is also checked at QUERY time (search_match_chunks): a stored
-- paragraph is only returned while its section is still in the Outer Circle
-- with exactly the same content (md5), and its owner is still Public and
-- Discoverable. So an index that is out of date can never reveal something
-- that was changed, moved to another circle, or made private.
-- Rows are deleted with the section or the account (on delete cascade).

begin;

create extension if not exists vector with schema extensions;

create table if not exists public.search_chunks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  section_id uuid not null references public.vault_sections(id) on delete cascade,
  -- md5 of the whole section content at the time it was indexed
  section_hash text not null,
  content text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists search_chunks_user_idx on public.search_chunks (user_id);
create index if not exists search_chunks_section_idx on public.search_chunks (section_id);

alter table public.search_chunks enable row level security;
revoke all on table public.search_chunks from anon, authenticated;

-- AI usage log: two new features (not billed to anyone; part of the plans).
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('chat', 'topic', 'insight', 'echo', 'search', 'index'));

-- Best-matching searchable paragraphs for a search: closest fingerprints
-- plus paragraphs containing one of the keywords. Only valid rows (see top).
create or replace function public.search_match_chunks(
  query_embedding extensions.vector(1024),
  keywords text[],
  match_count integer,
  exclude_user uuid
)
returns table (user_id uuid, section_id uuid, content text, distance double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with valid as (
    select c.id, c.user_id, c.section_id, c.content, c.embedding
    from public.search_chunks c
    join public.vault_sections s on s.id = c.section_id and s.user_id = c.user_id
    join public.users u on u.id = c.user_id
    where s.circle = 'outer'
      and md5(coalesce(s.content, '')) = c.section_hash
      and u.is_discoverable = true
      and coalesce(u.public_scope, 'none') <> 'none'
      and (exclude_user is null or c.user_id <> exclude_user)
  ),
  by_meaning as (
    select v.id from valid v
    order by v.embedding <=> query_embedding
    limit least(greatest(match_count, 1), 100)
  ),
  by_keyword as (
    select v.id from valid v
    where exists (
      select 1 from unnest(coalesce(keywords, '{}'::text[])) k
      where length(k) >= 3 and v.content ilike '%' || k || '%'
    )
    limit least(greatest(match_count, 1), 100)
  )
  select v.user_id, v.section_id, v.content, (v.embedding <=> query_embedding)::double precision as distance
  from valid v
  where v.id in (select id from by_meaning union select id from by_keyword)
  order by distance;
$$;

-- Users whose index needs work: a searchable section without an up-to-date
-- fingerprint, or stored rows that are no longer valid (to be removed).
create or replace function public.search_stale_users(max_users integer)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct x.user_id from (
    select s.user_id
    from public.vault_sections s
    join public.users u on u.id = s.user_id
    where u.is_discoverable = true
      and coalesce(u.public_scope, 'none') <> 'none'
      and s.circle = 'outer'
      and length(btrim(coalesce(s.content, ''))) > 0
      and not exists (
        select 1 from public.search_chunks c
        where c.section_id = s.id and c.section_hash = md5(coalesce(s.content, ''))
      )
    union all
    select c.user_id
    from public.search_chunks c
    join public.vault_sections s on s.id = c.section_id
    join public.users u on u.id = c.user_id
    where s.circle <> 'outer'
      or c.section_hash <> md5(coalesce(s.content, ''))
      or u.is_discoverable is not true
      or coalesce(u.public_scope, 'none') = 'none'
  ) x
  limit least(greatest(max_users, 1), 500);
$$;

revoke all on function public.search_match_chunks(extensions.vector, text[], integer, uuid) from public, anon, authenticated;
revoke all on function public.search_stale_users(integer) from public, anon, authenticated;
grant execute on function public.search_match_chunks(extensions.vector, text[], integer, uuid) to service_role;
grant execute on function public.search_stale_users(integer) to service_role;

commit;
