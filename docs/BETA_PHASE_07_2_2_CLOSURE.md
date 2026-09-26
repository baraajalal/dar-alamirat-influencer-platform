# Dar Al Amirat — beta.7.2.2 Phase 07 Closure

## Purpose
Close the archive-registration matching lifecycle before Phase 08.

## What this patch fixes
- When Admin confirms that a staged registration belongs to an archived creator, the canonical creator now enters the portal activation review state.
- A normal archived creator changes from `archived` to `activation_pending` via the existing `sync_influencer_directory_status` trigger.
- `portal_access_required` and the first `portal_access_requested_at` are recorded.
- `managed` and `suspended` directory decisions are not overwritten.
- Existing work history, social history and the canonical influencer ID remain unchanged.
- Restores the missing local Phase 07.1 migration file `20260915173000_unified_influencer_directory.sql` from the live DB migration record.

## Live DB application
Do **not** use `supabase db push` for this patch yet because the repository migration history still contains older version-number drift from the remote baseline.

Apply only:
`docs/PHASE_07_2_2_DB_PATCH.sql`
through Supabase SQL Editor.

## UAT required before closing Phase 07
1. Use one creator already present in the archive and still `archived`.
2. Submit the public registration with matching mobile/social identity.
3. Confirm it appears in Archive Match Requests.
4. Admin chooses **Confirm same creator**.
5. Confirm the same influencer ID and old work history remain.
6. Confirm `directory_status = activation_pending`.
7. Confirm a portal access request exists with `status = submitted`.
8. Confirm campaign assignment is blocked before activation.
9. Approve/link/complete portal activation.
10. Confirm the creator becomes `active`.
11. Confirm campaign assignment is then allowed.

Run `docs/PHASE_07_2_2_POSTCHECK.sql` after the UAT and export the result if review is needed.
