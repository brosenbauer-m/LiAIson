-- Migration: similarity_topic_usage
-- Owner decision 2026-10-20: on the Similarities Chart, "Learn More*" on a
-- topic writes a short AI summary comparing the people on that topic. Paid
-- per use by the person who asks, like messages. One new feature in the AI
-- usage log.

begin;

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('chat', 'topic', 'insight', 'echo', 'search', 'index', 'similarity', 'proofread', 'similarity_topic'));

commit;
