# LiAIson — current state
Updated 2026-10-09. Rules + code map: `CLAUDE.md`. How to ship: `claude/handover.md`. Old history: claude.ai project doc `claude/archive/roadmap-history.md` (only if needed).
Keep this file short: 1–3 lines per change, commit it with the work.

## Live (all on main)
- Accounts: sign-up with plan picker, email confirm via button page (/auth/confirm), unconfirmed accounts reminded day 7/27, deleted day 30; change email in Settings; account deletion.
- Visibility: Public / Private (`users.public_scope`, 'none' = Private) + Discoverable switch.
- Circles: Vault sections are Outer / Inner / Draft (`vault_sections.circle`); Inner Circle chosen on accepting a connection (`connection_interests.in_inner_circle`); Inner only on Ambivert/Extrovert; Introvert → inner becomes draft. Access = `resolveCircles`.
- Chat: sign-in required, sender pays, reader's own Vault as context (opt-out), AI disclosure line, EU Mistral.
- Plans: Introvert €0 / Ambivert €2 / Extrovert €4 + messages at cost+30% (markup never shown). Vault limits 3k/15k/30k chars (DB trigger). Upgrade now, downgrade at month end, refused until Vault fits. Echoes: none / monthly / weekly+monthly.
- Free month: 5 messages/day total. After it: card required (account locked to /billing/setup); paying users unlimited within spending limit (default €15).
- Billing (Mollie, TEST mode): card via €0 check, month-end bill (≥€5 else carried over), top-ups, receipts, plan fee pro-rated, VAT switch off (small business).
- Echoes: weekly/monthly visitor-interest reports + email (insights cron).
- Discover: name search + AI search by what people share (Outer Circle of Public+Discoverable only; 10/20 per month; reasons only, never Vault text).
- Similarity (9957a16 + a85e6d7, owner-verified 2026-10-09): LiAIson points out similarities in chat (all plans, small note under the reply ≤1×/chat/day); Extrovert+ score (5 levels) + bubble map on profiles, 100/month, cached in similarity_results.
- Social Butterfly (0103e6a, 35136ab, cc943f2, e3369b8, 1d580e6) — built, shown as "Coming soon" (`PLANS.butterfly.available = false`); exempt accounts have it (all sliders max) for testing:
  - Sliders (Claude's proposal, owner to confirm): €6 base incl. 2 own circles / 20 AI searches / 100 comparisons; +€0.50 per extra circle (max 10), +€1 per +20 searches (max 100), +€1 per +100 comparisons (max 500) → €6–18. Vault stays 30k (bigger Vault = dearer messages for senders). Choices in plan_changes.options; more = now, less = next month; fee = max held in month.
  - Own circles: created on Connections (members = accepted connections only), sections placed in Vault. Access re-checked in resolveCircles (accepted connection + owner plan has own circles); leaving Butterfly → those sections become drafts, circles kept. Privacy tested on local Postgres + PostgREST.
  - Compare 2–4 people at once on /compare (group bubble map + score per person; each person = 1 comparison; cached in similarity_group_results).
- Exempt accounts (never billed, Extrovert): @brosenbauerm, @adminuser.

## Not yet verified (needs test accounts)
- Inner Circle visibility with two accounts.
- AI search end-to-end (test account with Outer Circle text, search from another).
- Social Butterfly on the live site (exempt account): own circle + member sees its section, others don't; /compare with 2+ people; Plans sliders.
- Trial limits / card lock on a non-exempt account (first trials end 2026-11-07).
- Owner test bill (Settings → Monthly bill → Run test bill) and saved-card top-up.

## Next (agreed order)
1. Owner: test Social Butterfly, confirm slider prices → then set `available: true` in lib/plans.ts.
2. Redesign (cerebrium.ai-inspired, brown palette; landing first).
Later: cache identical searches/day, HNSW index at scale, chat retrieval for big vaults, ESLint cleanup, 16 unused Vercel env vars.

## Owner to-dos
- Register Einzelunternehmen → seller details in `lib/billing/seller.ts`, Mollie live key (Vercel), accountant: VAT/receipt wording.
- Vercel Pro before charging real money.
- Scaleway API key expires Sept 2027 (rotate in Vercel + Supabase SMTP).

## Key decisions (short)
- Sender pays for every message; nobody pays for others talking to their LiAIson.
- EU-only AI (Mistral EU endpoint). Marketing: "GDPR-compliant, data in EU data centres" OK; "100% European" not OK.
- Comparison/search: one opt-in (Discoverable); facts only, no rankings or hiring decisions.
- Discoverable + Public needed for content search; no city/age fields for now.
