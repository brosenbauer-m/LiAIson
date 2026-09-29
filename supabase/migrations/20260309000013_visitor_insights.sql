-- Migration: visitor_insights
-- Anonymous "what visitors want to know" statements for the owner's insights
-- and weekly/monthly reports. No visitor identity and no verbatim questions:
-- only a category and a short statement such as
-- "People want to know more about your climbing".
-- Rows are deleted after ~35 days by the daily insights job.

begin;

create table if not exists public.visitor_insights (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  statement text not null,
  created_at timestamptz not null default now()
);

create index if not exists visitor_insights_profile_created_idx
  on public.visitor_insights (profile_user_id, created_at desc);

-- Server-only table: RLS on and no policies, so only the service role can read/write.
alter table public.visitor_insights enable row level security;

commit;
