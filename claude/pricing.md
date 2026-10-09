# Pricing (decided) — short
Limits live in code: `lib/plans.ts`. Full reasoning: claude.ai project doc `claude/archive/pricing-proposal-full.md`.

- Price rule: AI cost × 1.3 (+ VAT when switched on, shown as one final price). Markup never shown to users.
- Plans: Introvert €0 · Ambivert €2 · Extrovert €4 · Social Butterfly (later: sliders, custom extra circles, multi-person analysis). Features per plan: see `lib/plans.ts`.
- Messages: sender pays (≈0.5–2 ct each); spending limit default €15/month.
- Free month: 5 messages/day total; features of the chosen plan.
- Billing: Mollie (EU). One charge at month end if ≥ €5, else carried over; prepaid top-ups used first; card via €0 check.
- VAT: Austrian small-business exemption for now (switch off); OSS later; accountant to confirm wording.
- Fixed costs ≈ €60/month (Vercel Pro, Supabase Pro, …).
- AI Act: no hiring rankings/decisions; recruiter positioning needs lawyer review before promotion.
