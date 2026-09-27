begin;
drop policy if exists "Users manage own share links" on public.share_links;
drop table if exists public.share_links;
commit;
