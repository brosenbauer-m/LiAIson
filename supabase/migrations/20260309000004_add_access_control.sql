-- Migration: add_access_control
-- Created: 2026-09-27T10:46:47.488Z

begin;

-- Public profile toggle: what scope (if any) is open to anyone without a link
alter table public.users
	add column if not exists public_scope text not null default 'none'
	check (public_scope in ('none', 'professional', 'personal', 'both'));

-- Per-connection access: once two users are matched, each row's from_user_id
-- controls what scope to_user_id may access of from_user_id's vault
alter table public.connection_interests
	add column if not exists allowed_scope text not null default 'none'
	check (allowed_scope in ('none', 'professional', 'personal', 'both'));

-- Shareable unguessable links, each scoped to one chat type
create table public.share_links (
	id uuid default uuid_generate_v4() primary key,
	user_id uuid references public.users(id) on delete cascade not null,
	scope text not null check (scope in ('professional', 'personal', 'both')),
	token text not null unique,
	created_at timestamptz default now(),
	revoked_at timestamptz
);

alter table public.share_links enable row level security;

create policy "Users manage own share links"
	on public.share_links for all
	using (auth.uid() = user_id);

commit;
