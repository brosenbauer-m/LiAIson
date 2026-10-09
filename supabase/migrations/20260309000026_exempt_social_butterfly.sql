-- Migration: exempt_social_butterfly
-- The exempt accounts (owner's test accounts, never billed) get Social
-- Butterfly with every slider at its maximum, so the owner can test own
-- circles and comparing several people before Social Butterfly opens to
-- everyone. Keep the values in sync with MAX_PLAN_OPTIONS in lib/plans.ts.

begin;

insert into public.plan_changes (user_id, from_plan, to_plan, options, effective_at)
select u.id, u.plan, 'butterfly', '{"extraCircles": 10, "aiSearches": 100, "similarities": 500}'::jsonb, now()
from public.users u
where u.billing_exempt = true
  and u.plan <> 'butterfly';

update public.users
set plan = 'butterfly',
    pending_plan = null,
    plan_options = '{"extraCircles": 10, "aiSearches": 100, "similarities": 500}'::jsonb
where billing_exempt = true;

commit;
