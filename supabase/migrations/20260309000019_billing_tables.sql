-- Migration: billing_tables
-- Billing foundation for Mollie (owner decisions 2026-10-09). Nothing uses these
-- tables yet; the app code comes in later changes.
--
-- 1) billing_accounts: one row per user. Mollie customer + card mandate (the saved
--    card) and the billing country used for VAT (with the evidence it came from).
-- 2) billing_documents: monthly usage bills and top-up receipts. Each receipt gets a
--    unique, sequential number (legal requirement for invoices). Amounts are EUR.
--    VAT fields are always filled: 0 while the owner is a small business (no VAT).
--    Kept for 7 years for tax law, so user_id is set to NULL (not deleted) when an
--    account is deleted; the snapshot fields keep what the receipt needs.
-- 3) billing_balance_entries: prepaid balance ledger (top-ups add, usage spends).
--    Balance = sum(amount_eur) per user.
-- All three are server-only: RLS on, no policies (only the service role can read/write).

begin;

create table if not exists public.billing_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  mollie_customer_id text unique,
  mandate_id text,
  mandate_status text not null default 'none'
    check (mandate_status in ('none', 'pending', 'valid', 'invalid')),
  card_label text,                       -- e.g. "Visa •••• 4242", for display only
  billing_country text check (billing_country ~ '^[A-Z]{2}$'),
  card_country text check (card_country ~ '^[A-Z]{2}$'),
  ip_country text check (ip_country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.billing_receipt_seq start 1;

create table if not exists public.billing_documents (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('monthly', 'topup')),
  period_start timestamptz,              -- monthly bills only
  period_end timestamptz,
  usage_eur numeric(12, 4) not null default 0 check (usage_eur >= 0),
  carried_in_eur numeric(12, 4) not null default 0 check (carried_in_eur >= 0),
  prepaid_applied_eur numeric(12, 4) not null default 0 check (prepaid_applied_eur >= 0),
  net_eur numeric(12, 4) not null default 0 check (net_eur >= 0),
  vat_rate numeric(5, 2) not null default 0 check (vat_rate >= 0 and vat_rate < 100),
  vat_eur numeric(12, 4) not null default 0 check (vat_eur >= 0),
  total_eur numeric(12, 2) not null default 0 check (total_eur >= 0),
  vat_exempt boolean not null default true,
  country text check (country ~ '^[A-Z]{2}$'),
  customer_name text,                    -- snapshot for the receipt
  customer_email text,                   -- snapshot for the receipt
  status text not null default 'draft'
    check (status in ('draft', 'carried_over', 'pending', 'paid', 'failed', 'canceled')),
  mollie_payment_id text unique,
  receipt_number text unique,            -- set only when a receipt is issued
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists billing_documents_user_created_idx
  on public.billing_documents (user_id, created_at desc);

-- At most one monthly bill per user and period.
create unique index if not exists billing_documents_monthly_unique
  on public.billing_documents (user_id, period_start)
  where kind = 'monthly';

create table if not exists public.billing_balance_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_eur numeric(12, 4) not null,    -- + top-up, - usage spent from the balance
  kind text not null check (kind in ('topup', 'usage', 'refund', 'adjustment')),
  document_id bigint references public.billing_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists billing_balance_entries_user_idx
  on public.billing_balance_entries (user_id, created_at desc);

-- Unique, sequential receipt numbers like "LIA-2026-000001", issued by the server only.
create or replace function public.next_receipt_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'LIA-' || to_char(now() at time zone 'Europe/Vienna', 'YYYY') || '-' ||
         lpad(nextval('public.billing_receipt_seq')::text, 6, '0');
$$;

revoke all on function public.next_receipt_number() from public, anon, authenticated;
grant execute on function public.next_receipt_number() to service_role;
revoke all on sequence public.billing_receipt_seq from public, anon, authenticated;
grant usage, select on sequence public.billing_receipt_seq to service_role;

alter table public.billing_accounts enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_balance_entries enable row level security;

commit;
