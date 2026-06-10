# CLAUDE.md

All project rules, conventions, the Cursor/Claude Code division of labor, and
the cross-tool coordination protocol live in **`AGENTS.md`** at the repo root.
Read it before doing anything.

Claude Code-specific notes:
- You own architecture, specs, and plans (`docs/superpowers/`), Vercel/env
  debugging, security, and PR review.
- You write Cursor's mission briefs in `CURSOR_TASKS.md` (local-only file).
- Never bypass `.husky/pre-commit`; land work via branches + PRs.
