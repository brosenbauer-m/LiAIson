# How Claude works on LiAIson (short)
Rules + code map: `CLAUDE.md`. State/backlog: `claude/roadmap.md`. Pricing: `claude/pricing.md`. Old history: claude.ai project doc `claude/archive/roadmap-history.md` (read only if needed).
These files live in the repo; keep them updated in the same commits as the work (short — 1–3 lines per change).

## Shipping a change
1. Edit and test in your clone (`npx tsc --noEmit`, `npm run build` with dummy env vars). Risky SQL: test on a local Postgres (+ pgvector) first.
2. Commit straight to `main` and push (no branches/PRs). Migrations auto-apply; the bot commits `types/database.types.ts` — pull before the next change.
3. Verify live after the Vercel deploy (~90 s) in the owner's signed-in browser pane, if available; otherwise ask the owner to check one thing.
4. Report in 1–3 lines; update `claude/roadmap.md`.
Fallback if direct push is unavailable: paste a quoted heredoc into the owner's Codespace terminal (desktop browser pane, xterm textarea paste event), md5-check, `git apply`, build, push. Set `git config --global core.pager cat` first (a pager swallows pastes).

## Lessons
- Check the real commit/diff, not an agent's report.
- Privacy rules are re-checked in the DB at query time where possible (see search_match_chunks).
- University mail scanners auto-click links → email confirmation needs a button page (/auth/confirm).
- `bg-warning` in the Tailwind config is black; avoid.
- Never type the owner's passwords or card data; test with test accounts.
