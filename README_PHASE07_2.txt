Dar Al Amirat Creator Community — beta.7.2

Prerequisite: project upgraded through beta.7.1.3.

Apply order:
1) Database backup.
2) Run phase07_2_preflight.sql in Supabase SQL Editor. Duplicate-mobile query must return zero rows.
3) Copy migration 20260919154500_archive_registration_matching.sql to C:\DA-Supabase-Baseline\supabase\migrations\
4) From C:\DA-Supabase-Baseline run:
   npx supabase db push --dry-run
   npx supabase db push
   npx supabase migration list
5) Copy this patch over C:\DA-Creator-Beta\influencer_beta_work
6) From the project directory run:
   npm ci
   npm run i18n:audit
   npm run typecheck
   npm run build
   npm run dev

Expected package version: 0.1.0-beta.7.2

Core UAT:
- Import Jan/Feb/... 2026 archive files.
- Re-import a modified file: existing values remain, missing values fill, no duplicate work rows.
- Register a creator matching archive by 05..., +966..., Arabic digits, username, or profile URL.
- Verify request appears in /dashboard/match-requests and is admin-only.
- Confirm match: same influencer_id + old work history retained + missing fields filled.
- Reject a non-mobile match: a separate new influencer is created and proceeds to normal activation review.
- Reject an exact-mobile match: new record is blocked; creator must correct the number or admin confirms match.
- No-match registration goes directly to the existing activation review flow.
- Archived and activation_pending profiles cannot be assigned; active/managed can.
