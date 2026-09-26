# Beta 7.2.3 - Archive profile completion synchronization

## Problem
Archive-created influencers were inserted with the default `profile_completion = 0` and the archive import / matching path did not recalculate it from existing profile and social data.

## Fix
- Adds one canonical refresh function that reuses the existing `calculate_influencer_profile_completion` scoring formula.
- Recalculates completion when relevant influencer fields change.
- Recalculates completion when social accounts change.
- Recalculates completion when the Mawthooq number changes.
- Backfills all current influencers so existing archive profiles receive a real completion percentage.
- Preserves historical `updated_at` timestamps during the one-time backfill.

## Scoring behavior
The patch intentionally uses the same profile-completion formula already used by the application. Archive profiles receive credit only for data that exists in the unified profile/social records. Missing fields remain incomplete.

## Expected result
Archived profiles should no longer all show `0%`. The percentage will differ per creator according to the information actually available.
