Dar Al Amirat Creator Community - Phase 04 patch (beta.3)

Extract/copy this patch over the existing beta.2 application folder only AFTER applying and verifying the separate database migration:
20260911081200_campaign_opportunities.sql

Do not run database migrations from the application project's historical supabase/migrations folder.
Continue using the dedicated active baseline folder:
C:\DA-Supabase-Baseline\supabase\migrations

After copying the patch:
1) npm ci
2) npm run typecheck
3) npm run build
4) npm run dev
