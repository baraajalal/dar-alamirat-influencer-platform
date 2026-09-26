# Beta 8.2 - Campaign qualification

Phase 08.2 adds campaign-specific qualification on top of the general influencer evaluation from Phase 08.1.

## What is added
- Per-campaign target cities and target platforms.
- Optional minimum followers, average views, and engagement thresholds.
- Optional preference for previous work with the same brand.
- A campaign-fit staff rating (1-5) for each application.
- A campaign-specific score out of 100 and system suggestion.
- A separate final staff decision; the automated suggestion never replaces it.
- Snapshot history whenever the campaign evaluation is saved and whenever an application becomes shortlisted, accepted, or rejected.

## Scoring v1
- General influencer evaluation: 30
- Campaign fit: 15
- Same-brand history: 15
- City: 10
- Platform: 10
- Followers: 8
- Average views: 7
- Engagement: 5

Blank campaign criteria are treated as not required and do not penalize the creator. A missing Phase 08.1 evaluation or missing campaign-fit rating forces the system suggestion to `needs_review`.

## Staff control
The campaign application decision (shortlist / accept / reject) remains a separate workflow. Phase 08.2 is decision support and preserves the evaluation snapshot used at decision time.
