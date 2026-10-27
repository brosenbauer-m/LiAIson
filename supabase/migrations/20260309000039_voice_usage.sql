-- Migration: voice_usage
-- Owner decision 2026-10-27: voice in the LiAIson chat (Mistral Voxtral).
-- Speaking a message (transcription) and hearing an answer read aloud are paid
-- per use by the person who uses them, like messages. Two new features in the
-- AI usage log. For these rows prompt_tokens holds the billed amount instead
-- of tokens: seconds of audio ('voice_transcribe') or characters read aloud
-- ('voice_speech'); completion_tokens is 0. No audio is ever stored.

begin;

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('chat', 'topic', 'insight', 'echo', 'search', 'index', 'similarity', 'proofread', 'similarity_topic', 'voice_transcribe', 'voice_speech'));

commit;
