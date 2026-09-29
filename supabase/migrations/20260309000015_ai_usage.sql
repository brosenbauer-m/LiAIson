-- Migration: ai_usage
-- Records AI token usage per LiAIson (whose LiAIson the call was for), per call:
-- feature, model, who caused it (owner / member / visitor / system) and token counts.
-- No message content, prompts or visitor identities are stored.
-- Used to measure costs before introducing usage-based pricing.

begin;

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  feature text not null check (feature in ('chat', 'topic', 'insight', 'echo')),
  model text not null,
  actor text not null check (actor in ('owner', 'member', 'visitor', 'system')),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- Server-only table: RLS on and no policies, so only the service role can read/write.
alter table public.ai_usage enable row level security;

commit;
