Dar Al Amirat beta.8.2 - Campaign Qualification

1) Apply this patch over beta.8.1.
2) Run docs/PHASE_08_2_PREFLIGHT.sql in Supabase SQL Editor.
3) If all required checks are OK, run docs/PHASE_08_2_DB_PATCH.sql once.
4) Run npm ci, npm run i18n:audit, npm run typecheck, npm run build.
5) Open a campaign -> Applications -> Review applications.
6) Configure campaign qualification criteria and save one creator evaluation.
7) Run docs/PHASE_08_2_POSTCHECK.sql and review the result.

Do not use supabase db push on this workstation unless Supabase CLI is intentionally installed and migration history has been reconciled.
