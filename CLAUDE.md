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
- Server-only tables (RLS on, no policies; service role via API routes): connection_interests, plan_changes, billing_*, ai_usage, visitor_insights, visitor_reports, search_chunks, similarity_results, similarity_group_results, custom_circles, custom_circle_members, coupon_campaigns, coupon_codes, coupon_redemptions.
- Admin: one account only (`users.is_admin`, set once at sign-up for contact@my-liaison.app, username forced to `admin`, migrations 40–41); never a second. Console `app/admin/*` (+ `app/api/admin/*`, `lib/admin/*`: `requireAdmin()` first in every route); `proxy.ts` keeps the admin on /admin and everyone else out; the admin has no LiAIson page (404), no tabs, no usage/bell. Event codes: `lib/admin/coupons.ts` (campaigns, codes, CSV); people redeem via `lib/coupons` (`/api/coupons/preview|redeem`, sign-up metadata `coupon` → `handle_new_user`), DB `redeem_coupon`.
- New third-party data processor → add to `app/privacy/page.tsx`; prefer EU. Keep `.env.example` in sync. Never commit secrets.

## Stack
Next.js 16 (`proxy.ts` = middleware), React 19, Tailwind · Supabase EU (Postgres, Auth, Storage `avatars`) · Mistral EU (`lib/mistral/client.ts`: medium = chat, small = fast tasks, mistral-embed = search) · Upstash Redis · Scaleway email (`lib/email/scaleway.ts`) · Mollie payments · Vercel fra1 (2 crons in `vercel.json`).

## Code map
- Phones: bottom tab bar in `components/nav/SiteHeader.tsx` (body `has-tabbar` padding in globals.css); `app/manifest.ts` + `public/icon-*.png` (home-screen app)
- Shared: `lib/redis.ts` (one client + `underLimit`), `lib/safeRedirect.ts`, `lib/mistral/client.ts` (`messageText`), `components/ui/Avatar.tsx` (only own-storage pictures)
- `app/page.tsx` + `components/landing/` home (snap slides, RisingCircles, HowItWorks carousel, Annotated diagrams)
- `app/[username]/` profile + chat UI (interest map: `components/profile/InterestMap.tsx` → `app/api/interests/[username]` → `lib/interests/map.ts`, viewer-visible text only, viewer pays, feature 'topic', Ambivert+ viewers) · `app/api/chat/[username]/` chat (sign-in, trial limits, sender pays, reader's own vault as context)
- `app/api/connections/*` request/status/respond/access/remove — connections are mutual (two rows; each person places the other: `lib/connections/placement.ts`, `components/connections/CirclePicker.tsx`)
- `/circles` (tiers with 2+ circles; replaces Connections there): `app/circles/CirclesWorkspace.tsx` = Connections panel + `components/circles/CircleBoard.tsx` + Sections panel, filtered by the selected circle; group move via `app/api/circles/place` (people) and vault_sections updates (sections). `/connections` = Introvert only (redirects otherwise)
- `app/discover/` + `app/api/discover/` name search; `/search` AI search (plan quota); `/index` refresh own index → `lib/search/`
- `lib/similarity/`, `app/api/similarity/[username]`, `components/similarity/` Similarity (Extrovert+: score + floating `BubbleChart` on the button press, cached in similarity_results); `/similarities` (Similarities Chart: people + lines for who shares what, Include Me off by default, Learn More* `app/api/compare/topic`, group LiAIson `app/api/compare/talk` → `lib/similarity/talk.ts`; never say "compare" in the UI; `/compare` redirects) + `app/api/compare` several people (Butterfly, `group.ts`); chat similarity marker/note → `lib/chat/signals.ts`
- Own circles (Social Butterfly): `app/api/circles` (+`/members`; PATCH `parent` moves), nested via `custom_circles.parent_id`/`in_inner`/`isolated` (members see every circle around theirs; isolated = outside the Outer Circle; `circleChain` in `lib/circles.ts`); Introvert sees no circles (`components/ui/CirclesNote.tsx`), circle board `components/circles/` (layout, sound), sections via `circle='custom'` + `custom_circle_id`
- `app/vault/`, `components/vault/` Vault editor (circles: outer/inner/draft, `lib/circles.ts`; ⋯ menu: Import File, Optimize Text → `app/api/vault/optimize`, Delete Section)
- Voice in the chat (Voxtral only): `components/chat/MicButton.tsx` + `ReadAloudButton.tsx` → `app/api/voice/{transcribe,speech}` → `lib/voice/server.ts` (preset voice only, never cloned/`refAudio`; no audio stored); browser side `lib/voice/{recorder,player,wav}.ts`; billed as `voice_transcribe`/`voice_speech` (seconds/characters, `lib/usage/spend.ts`)
- Right-click menus: `openContextMenu(e, items)` from `components/ui/ContextMenu.tsx` (host in root layout)
- Unsaved changes: `useUnsavedChanges(dirty, save)` / `confirmLeave()` in `lib/unsaved.ts`, dialog `components/ui/UnsavedChangesGuard.tsx` (root layout)
- `app/settings/`, `components/settings/` Profile (bio = Vault `profile_bio` section), Profile Privacy, Subscription (TierSection, usage, credits, card, invoices), delete; `/profile` + `/plans` redirect
- `components/plans/TierPicker.tsx` (sign-up + Settings), `lib/plans.ts` (all plan limits + texts; Butterfly sliders, `planLimits(plan, options)`), `lib/billing/plan.ts` (plan state/changes; `plan_changes` incl. `options` is the source of truth)
- `lib/billing/*` Mollie, month-end bills (`monthly.ts`), plan fee (`planFee.ts`), card lock (`access.ts`, used by `proxy.ts`), receipts, VAT
- `lib/ratelimit/trial.ts` free-month limits · `lib/usage/` AI usage log + spend/markup
- `lib/insights/` visitor insights + Echoes (weekly/monthly) · `app/api/cron/insights` daily
- `app/api/cron/billing` daily: unconfirmed accounts (`lib/auth/unverified.ts`), search index sweep, month-end billing on the 1st
- `app/auth/confirm` email confirm button (also password reset) · `/forgot-password` + `app/api/auth/forgot` · `/reset-password` · `app/api/account/password` · `app/api/account/export` · `app/api/auth/discard-signup` · `app/api/account/delete`

## Scripts
`npm run build` · `npm run lint` · `npm run sb:migration "name"` · `npm run check:migrations`
