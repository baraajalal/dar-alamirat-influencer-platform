# Phase 08.1 - Qualification & Evaluation Foundation

## Goal
Add transparent staff decision support to each influencer profile without allowing the automated score to make the final decision.

## Inputs
Manual staff ratings (1-5):
- Content quality
- Brand fit
- Previous reliability

Automatic context:
- Profile completion
- City availability
- Social-platform presence
- Total followers
- Average views
- Average engagement
- Previous work count and outcomes
- Previous brand count

## Scoring v1
Maximum 100 points:
- Content quality: 20
- Brand fit: 15
- Reliability: 15
- City: 5
- Platform presence: 5
- Followers: 10
- Average views: 10
- Engagement: 10
- Previous work: 10

The system suggestion is one of:
- qualified
- needs_review
- waitlist
- not_qualified

If the three manual ratings are incomplete, no social account exists, or profile completion is below 50%, the suggestion stays `needs_review`.

## Staff decision
Admin, Coordinator and Reviewer can save the evaluation and set the final staff decision. Finance and Viewer are read-only.

The final decision is stored separately from the system suggestion. Waitlist and Not qualified require a written reason.

## Audit
Every save creates an immutable snapshot in `influencer_evaluation_history` with metrics, score breakdown, decision and the staff user who changed it.

## Deployment
1. Apply `docs/PHASE_08_1_DB_PATCH.sql` in Supabase SQL Editor.
2. Install the application patch.
3. Run `npm ci`, `npm run i18n:audit`, `npm run typecheck`, `npm run build`.
4. Open an influencer profile and test saving the three ratings.
5. Run `docs/PHASE_08_1_POSTCHECK.sql`.
