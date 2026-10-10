# LiAIson — current state
Updated 2026-10-10. Rules + code map: `CLAUDE.md`. How to ship: `claude/handover.md`. Old history: claude.ai project doc `claude/archive/roadmap-history.md` (only if needed).
Keep this file short: 1–3 lines per change, commit it with the work.

## Live (all on main)
- Accounts: sign-up with plan picker, email confirm via button page (/auth/confirm), unconfirmed accounts reminded day 7/27, deleted day 30; change email in Settings; account deletion. Forgot password (emailed link via /auth/confirm → /reset-password, `/api/auth/forgot`, same answer for every email, rate-limited), change password in Settings (`/api/account/password`, current password needed, other devices signed out), sign out on all devices, Download my data (`/api/account/export`, JSON).
- Visibility: Public / Private (`users.public_scope`, 'none' = Private) + Discoverable switch.
- Circles: Vault sections are Outer / Inner / Draft (`vault_sections.circle`); Inner Circle chosen on accepting a connection (`connection_interests.in_inner_circle`); Inner only on Ambivert/Extrovert; Introvert → inner becomes draft. Access = `resolveCircles`.
- Nested circles (migration 30, 2026-10-10): own circles sit in the Outer Circle, inside the Inner Circle (`custom_circles.in_inner`) or inside another own circle (`parent_id`, max 4 deep, no loops). Members see their circle + every circle around it (inside Inner → also Inner). Circle Studio on Connections (`app/connections/CustomCircles.tsx`, `components/circles/`): drag circles into each other (springs, sounds with mute, works on touch) or tap → Move to. Deleting a circle moves its inner circles up one level.
- Chat: sign-in required, sender pays, reader's own Vault as context (opt-out), AI disclosure line, EU Mistral.
- Plans (2026-10-10): Introvert €0 / Ambivert €3 / Extrovert €6 / Social Butterfly from €9 + messages at cost+30% (markup never shown). Vault 1k/15k/30k/30–60k chars (DB trigger, Butterfly slider). Tier chosen at sign-up (TierPicker), changed in Settings → Subscription; /plans redirects. Upgrade now, downgrade at month end, refused until Vault fits. Echoes: none / monthly / weekly+monthly.
- Free month: 5 messages/day total. After it: card required (account locked to /billing/setup); paying users unlimited within spending limit (default €15).
- Billing (Mollie, TEST mode): card via €0 check, month-end bill (≥€5 else carried over), top-ups, receipts, plan fee pro-rated, VAT switch off (small business).
- Echoes: weekly/monthly visitor-interest reports + email (insights cron).
- Discover: name search + AI search by what people share (Outer Circle of Public+Discoverable only; 10/20 per month; reasons only, never Vault text).
- Similarity (9957a16 + a85e6d7, owner-verified 2026-10-09): LiAIson points out similarities in chat (all plans, small note under the reply ≤1×/chat/day); Extrovert+ score (5 levels) + bubble map on profiles, 100/month, cached in similarity_results.
- Social Butterfly (live 2026-10-10): sliders Vault 30–60k (+€1/10k), own circles 2–10 (+€0.50), AI searches 20–100 (+€1/20), comparisons 100–500 (+€1/100) → €9–25. Choices in plan_changes.options (DB normalize_plan_options); more = now, less = next month. Own circles on Connections; /compare for 2–4 people.
- Exempt accounts (never billed, Social Butterfly with every slider at max incl. 60k Vault): @brosenbauerm, @adminuser.
- Review 2026-10-09 (02265ce…9f97c0e): open redirect on login fixed; notifications cron fails closed (it sends emails); chat history validated (no injected system turns, 20 turns, length caps); profile fields checked in DB when users change them (migration 27); one Avatar component (own storage only), safe contact links; security headers; connection requests rate-limited; parallel checks in chat; one Redis client (lib/redis.ts) + `underLimit`, one `messageText` helper.
- Remove a connection (855c1cd): owner removes = declined (no new request, leaves own circles); visitor can disconnect on the profile.
- Same AI search same day reused (7396411): per-user Redis cache, people re-checked Public+Discoverable, not counted.
- UI polish (9f97c0e): press/focus/motion styles in globals.css, page fade (app/template.tsx), frosted pill header, dashboard Copy link + quick tiles.
- 2026-10-10 owner changes: home page rebuilt (full-screen snap slides: story hero + rising circles, How it Works carousel with annotated pictures in components/landing, On Your Terms, Make Yourself Known); Settings = Profile (photo, name, email + Echo emails, bio, links) + Profile Privacy + Subscription + delete (/profile redirects); Profile Bio = undeletable always-Outer Vault section synced to users.short_bio (migration 29), new accounts get only it; own Vault always used in chat (switch removed); dashboard = link + Echoes; notifications in header bell; suggestions on Connections; Discover "By Information".
- Redesign step 1: warm brown palette app-wide (tokens in tailwind.config.ts + globals.css, contrast-checked), Fraunces (headlines) + Inter self-hosted via next/font, new landing page (hero with chat + Similarity visuals, facts strip, how it works, feature grid, plans teaser from lib/plans.ts, CTA). cerebrium.ai is blocked from cloud sessions, so the look is from the brief, not a copy.

## Not yet verified (needs test accounts)
- Inner Circle visibility with two accounts.
- AI search end-to-end (test account with Outer Circle text, search from another).
- Social Butterfly on the live site (exempt account): own circle + member sees its section, others don't; circle inside Inner gives its member the Inner Circle; Circle Studio drag on phone; /compare with 2+ people; sign-up with Butterfly sliders.
- Trial limits / card lock on a non-exempt account (first trials end 2026-11-07).
- Owner test bill (Settings → Monthly bill → Run test bill) and saved-card top-up.

## Next (agreed order)
1. Owner: check the new home page, sign-up tiers, Settings, Vault bio, password reset email and the Circle Studio live.
2. Redesign step 2: app pages in the new style (serif page titles, grid-line section style) — dashboard, Vault, profile/chat, Discover, Plans, Settings, auth pages.
Later: cache identical searches/day, HNSW index at scale, chat retrieval for big vaults, 16 unused Vercel env vars. (ESLint: 0 errors since 2026-10-09; 8 warnings left: <img> and hook deps.)

## Owner to-dos
- Register Einzelunternehmen → seller details in `lib/billing/seller.ts`, Mollie live key (Vercel), accountant: VAT/receipt wording.
- Vercel Pro before charging real money.
- Scaleway API key expires Sept 2027 (rotate in Vercel + Supabase SMTP).

## Key decisions (short)
- Sender pays for every message; nobody pays for others talking to their LiAIson.
- EU-only AI (Mistral EU endpoint). Marketing: "GDPR-compliant, data in EU data centres" OK; "100% European" not OK.
- Comparison/search: one opt-in (Discoverable); facts only, no rankings or hiring decisions.
- Discoverable + Public needed for content search; no city/age fields for now.
