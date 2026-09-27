-- Migration: add_vault_folders
-- Created: 2026-09-27T14:41:28.668Z

begin;

create table public.vault_folders (
	id uuid default uuid_generate_v4() primary key,
	user_id uuid references public.users(id) on delete cascade not null,
	name text not null,
	color text not null default '#6366f1',
	created_at timestamptz default now()
);

alter table public.vault_folders enable row level security;

create policy "Users manage own folders"
	on public.vault_folders for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

alter table public.vault_sections
	add column if not exists folder_id uuid references public.vault_folders(id) on delete set null;

commit;
