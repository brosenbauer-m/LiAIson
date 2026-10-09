-- Migration: similarity
-- Similarity (owner decisions 2026-10-09):
-- - Extrovert only: a score (5 levels) and a bubble map of shared interests,
--   worked out when the viewer taps "See what we have in common".
-- - Compares the viewer's own Outer + Inner Circle with only what the other
--   person lets the viewer see (resolveCircles). Drafts are never used. Only
--   the viewer sees the result; the other person is not notified.
-- - Included in the plan with a monthly limit (counted in ai_usage as
--   feature 'similarity', not billed).
--
-- similarity_results keeps the last result per viewer and person so opening
-- it again costs nothing. input_hash is an md5 of both texts used; when
-- either Vault or the visible circles change, the hash no longer matches and
-- the result is worked out again (the app never shows a stale result).
-- Stores only short interest labels and reasons, never Vault text.
-- Server-only: RLS on, no policies. Rows go with either account (cascade).

begin;

create table if not exists public.similarity_results (
  viewer_id uuid not null references public.users(id) on delete cascade,
  target_id uuid not null references public.users(id) on delete cascade,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, target_id)
);

create index if not exists similarity_results_target_idx on public.similarity_results (target_id);

alter table public.similarity_results enable row level security;
revoke all on table public.similarity_results from anon, authenticated;

-- AI usage log: one new feature (not billed to anyone; part of the plan).
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('chat', 'topic', 'insight', 'echo', 'search', 'index', 'similarity'));

commit;
