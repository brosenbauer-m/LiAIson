-- Migration: display_currency
-- Owner decision 2026-10-10: people can choose the currency in which amounts
-- (usage, limits, credit) are shown. Billing stays in euros; other currencies
-- are shown at the European Central Bank's daily reference rate.

begin;

alter table public.users
  add column if not exists display_currency text not null default 'EUR';

alter table public.users drop constraint if exists users_display_currency_check;
alter table public.users add constraint users_display_currency_check
  check (display_currency in ('EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'JPY', 'CAD', 'AUD'));

commit;
