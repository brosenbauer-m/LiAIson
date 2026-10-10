-- Migration: echo_email_choices
-- Owner decision 2026-10-10: Echo emails are chosen separately for the weekly
-- and the monthly Echo (Settings → Profile). Both start as the old single
-- choice (users.report_emails, kept so nothing breaks; no longer used).

begin;

alter table public.users
  add column if not exists report_emails_weekly boolean not null default true,
  add column if not exists report_emails_monthly boolean not null default true;

update public.users
set report_emails_weekly = coalesce(report_emails, true),
    report_emails_monthly = coalesce(report_emails, true);

commit;
