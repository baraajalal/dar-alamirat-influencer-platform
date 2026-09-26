Dar Al Amirat beta.9.1 — Phase 09.1 Assignment + Brief + Execution Workflow

1) Apply this patch over beta.8.2.
2) Run docs/PHASE_09_1_PREFLIGHT.sql in Supabase SQL Editor.
3) If all required checks are OK, run docs/PHASE_09_1_DB_PATCH.sql once.
4) Run npm ci, npm run i18n:audit, npm run typecheck, npm run build.
5) Test one assignment from acceptance → brief → PR/product → content pending.
6) Run docs/PHASE_09_1_POSTCHECK.sql and review the single result set.

Do not run supabase db push if Supabase CLI is not installed/configured.
