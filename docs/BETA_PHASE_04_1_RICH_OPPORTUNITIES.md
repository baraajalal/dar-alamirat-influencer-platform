# Beta Phase 04.1 - Rich campaign opportunities

This patch extends Phase 04 so an influencer reviews the real campaign terms before applying.

## Influencer portal
- Shows public campaign brief, goal, hashtags, reference links and product/visual URLs.
- Shows collaboration type and a public compensation offer (none/fixed/range/negotiable).
- Requires explicit acceptance of campaign details and compensation before application submission.
- Stores a snapshot of the accepted campaign terms and compensation on the application.
- Shows application status and the staff rejection reason when rejected.

## Staff review
- Opportunity settings now include public goal, product/visual URLs and public compensation terms.
- Total internal campaign budget remains private; only the public offer is exposed to creators.
- Application cards show direct social profile links and basic audience/performance metrics.
- Staff can open the full influencer profile from the application card.
- Rejection requires a reason.
- Accepting a fixed public compensation copies that amount and currency into the generated assignment.

## Database
Apply `20260911081300_campaign_opportunity_details.sql` after Phase 04 migration `20260911081200_campaign_opportunities.sql`.
