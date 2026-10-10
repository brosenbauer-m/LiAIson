# Pricing (decided) — short
Limits live in code: `lib/plans.ts`. Full reasoning: claude.ai project doc `claude/archive/pricing-proposal-full.md`.

- Price rule: AI cost × 1.3 (+ VAT when switched on, shown as one final price). Markup never shown to users.
- Plans (2026-10-10): Introvert €0 (1,000-char Vault) · Ambivert €3 · Extrovert €6 · Social Butterfly from €9 (sliders). Features per plan: see `lib/plans.ts`.
- Social Butterfly sliders: €9 base (30k Vault, 2 own circles, 20 AI searches, 100 comparisons) + €1 per +10k Vault (≤60k) + €0.50/extra circle (≤10) + €1 per +20 searches (≤100) + €1 per +100 comparisons (≤500) → max €25. Change in `BUTTERFLY_SLIDERS` + DB `normalize_plan_options`/`plan_vault_limit`.
- Messages: sender pays (≈0.5–2 ct each); spending limit default €15/month.
- Free month: 5 messages/day total; features of the chosen plan.
- Billing: Mollie (EU). One charge at month end if ≥ €5, else carried over; prepaid top-ups used first; card via €0 check.
- VAT: Austrian small-business exemption for now (switch off); OSS later; accountant to confirm wording.
- Fixed costs ≈ €60/month (Vercel Pro, Supabase Pro, …).
- AI Act: no hiring rankings/decisions; recruiter positioning needs lawyer review before promotion.
