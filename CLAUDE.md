# LiAIson — agent guide

Production app (www.my-liaison.app). Owner is non-technical. Every push to `main` deploys.
State, next steps and how to ship: `claude/roadmap.md`, `claude/handover.md`, `claude/pricing.md` (keep them short and updated).

## Workflow
- Work directly on `main` (`git pull` first). No branches, no PRs.
- Given a patch: `git apply` it exactly; never retype or "improve" it. If it fails, stop and report.
- Before committing: `npm run build` (+ `npm run check:migrations` if a migration changed). Failing → don't commit, report.
- Commit with the given message, `git push origin main`, report hash + changed files.

## Risk rules
- Low = UI, Medium = API/logic, High = DB/RLS/auth/migration/AI prompt/rate limiting/vault privacy. Never bundle High with unrelated edits.
- Migrations (`supabase/migrations/`) are forward-only, auto-applied on push (`supabase-db-auto.yml`, which also commits `types/database.types.ts` — never edit that by hand, never `supabase db push`). New file numbers come after the latest.
- `lib/prompts/buildSystemPrompt.ts`: keep all 9 strict rules; no outside knowledge; never reveal vault structure.
- Vault privacy: visitors see only what `resolveCircles` allows (`lib/access/resolveScope.ts`; read sections with `.or(visibleSectionsFilter(scope))`) — on every route (profile, chat, prompts, Similarity, Discover, search).
- Rate-limit key `chat:${ip}:${userId}` (`lib/ratelimit/index.ts`) never changes without a plan.
- Cron routes require `CRON_SECRET`; never remove the check.
- Server-only tables (RLS on, no policies; service role via API routes): connection_interests, plan_changes, billing_*, ai_usage, visitor_insights, visitor_reports, search_chunks, similarity_results, similarity_group_results, custom_circles, custom_circle_members.
- New third-party data processor → add to `app/privacy/page.tsx`; prefer EU. Keep `.env.example` in sync. Never commit secrets.

## Stack
Next.js 16 (`proxy.ts` = middleware), React 19, Tailwind · Supabase EU (Postgres, Auth, Storage `avatars`) · Mistral EU (`lib/mistral/client.ts`: medium = chat, small = fast tasks, mistral-embed = search) · Upstash Redis · Scaleway email (`lib/email/scaleway.ts`) · Mollie payments · Vercel fra1 (2 crons in `vercel.json`).

## Code map
- Shared: `lib/redis.ts` (one client + `underLimit`), `lib/safeRedirect.ts`, `lib/mistral/client.ts` (`messageText`), `components/ui/Avatar.tsx` (only own-storage pictures)
- `app/page.tsx` + `components/landing/` home (snap slides, RisingCircles, HowItWorks carousel, Annotated diagrams)
- `app/[username]/` profile + chat UI · `app/api/chat/[username]/` chat (sign-in, trial limits, sender pays, reader's own vault as context)
- `app/api/prompts/[username]/` suggested prompts · `app/api/connections/*` request/status/respond/access/remove
- `app/discover/` + `app/api/discover/` name search; `/search` AI search (plan quota); `/index` refresh own index → `lib/search/`
- `lib/similarity/`, `app/api/similarity/[username]`, `components/similarity/` Similarity (Extrovert+: score + bubble map, cached in similarity_results); `/compare` + `app/api/compare` several people (Butterfly, `group.ts`); chat similarity marker/note → `lib/chat/signals.ts`
- Own circles (Social Butterfly): `app/api/circles` (+`/members`), `app/connections/CustomCircles.tsx`, sections via `circle='custom'` + `custom_circle_id` (`lib/circles.ts` placements)
- `app/vault/`, `components/vault/` Vault editor (circles: outer/inner/draft, `lib/circles.ts`)
- `app/settings/`, `components/settings/` Profile (bio = Vault `profile_bio` section), Profile Privacy, Subscription (TierSection, usage, credits, card, invoices), delete; `/profile` + `/plans` redirect
- `components/plans/TierPicker.tsx` (sign-up + Settings), `lib/plans.ts` (all plan limits + texts; Butterfly sliders, `planLimits(plan, options)`), `lib/billing/plan.ts` (plan state/changes; `plan_changes` incl. `options` is the source of truth)
- `lib/billing/*` Mollie, month-end bills (`monthly.ts`), plan fee (`planFee.ts`), card lock (`access.ts`, used by `proxy.ts`), receipts, VAT
- `lib/ratelimit/trial.ts` free-month limits · `lib/usage/` AI usage log + spend/markup
- `lib/insights/` visitor insights + Echoes (weekly/monthly) · `app/api/cron/insights` daily
- `app/api/cron/billing` daily: unconfirmed accounts (`lib/auth/unverified.ts`), search index sweep, month-end billing on the 1st
- `app/auth/confirm` email confirm button · `app/api/auth/discard-signup` · `app/api/account/delete`

## Scripts
`npm run build` · `npm run lint` · `npm run sb:migration "name"` · `npm run check:migrations`
