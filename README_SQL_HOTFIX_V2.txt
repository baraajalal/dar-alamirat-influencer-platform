Phase 07.2.3 SQL Hotfix v2

Reason:
Supabase SQL Editor reported that the temporary relation
_phase07_completion_updated_at did not exist when it was referenced later.

Fix:
The backfill no longer uses any temporary table. Instead it temporarily disables
only the influencers_set_updated_at trigger, recalculates profile_completion for
all influencers, and then re-enables the trigger inside the same transaction.

Run docs/PHASE_07_2_3_DB_PATCH.sql once from Supabase SQL Editor.
Do not run supabase db push for this manual hotfix step.
