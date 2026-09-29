-- Migration: own_vault_in_chats
-- Two-vault chat: when a signed-in user chats with someone else's LiAIson,
-- their own (non-draft) vault may be used to answer them. On by default;
-- the user can switch it off in Settings.

begin;

alter table public.users
  add column if not exists use_own_vault_in_chats boolean not null default true;

commit;
