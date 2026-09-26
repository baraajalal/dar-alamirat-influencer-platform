Dar Al Amirat - Phase 07.2.3 SQL syntax hotfix

Reason:
PostgreSQL requires ON COMMIT DROP before AS SELECT in CREATE TEMP TABLE syntax.

Fixed statement:
create temporary table _phase07_completion_updated_at
on commit drop
as
select id, updated_at
from public.influencers;

This hotfix changes only:
- docs/PHASE_07_2_3_DB_PATCH.sql
- supabase/migrations/20260922151000_archive_profile_completion_sync.sql

No npm install, build, or Supabase CLI command is required for this SQL-only correction.
Copy the hotfix files over the project so the migration history on disk also contains the corrected SQL.
Then run docs/PHASE_07_2_3_DB_PATCH.sql in Supabase SQL Editor.
