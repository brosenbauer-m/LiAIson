-- Migration: proofread_usage
-- Owner decision 2026-10-10: Vault "Proofread" (grammar, spelling,
-- punctuation and capitalisation only) is an AI feature paid per use by the
-- person who uses it, like messages. One new feature in the AI usage log.

begin;

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('chat', 'topic', 'insight', 'echo', 'search', 'index', 'similarity', 'proofread'));

commit;
