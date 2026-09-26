Dar Al Amirat Creator Community - beta.4 patch

Prerequisite:
- Phase 04 code is already installed.
- Remote DB already has 20260911081200_campaign_opportunities.sql applied.

Database:
- Apply the separate migration 20260911081300_campaign_opportunity_details.sql using the Baseline migration folder and Supabase CLI.

Code patch:
- Copy the contents of this ZIP over C:\DA-Creator-Beta\influencer_beta_work
- Keep your existing .env.local.
- Then run npm ci, npm run typecheck, npm run build.

This patch adds rich campaign details, creator compensation consent, direct social-account review links, and mandatory rejection reasons.
