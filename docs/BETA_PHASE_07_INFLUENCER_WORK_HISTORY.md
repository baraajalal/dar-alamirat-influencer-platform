# Phase 07 — Influencer Work History & Legacy Archive

## Goal
Keep one canonical influencer profile and attach every previous collaboration to that profile. Historical work is staff-only and is used to evaluate suitability for future campaigns.

## What this phase adds
- `influencer_work_history`: canonical previous-work records linked by `influencer_id`.
- No legacy import is allowed to create a new influencer. Rows are matched by normalized mobile only.
- Natural deduplication prevents the same collaboration from being imported twice.
- Existing paid/closed/completed assignments are backfilled automatically.
- Future completed assignments sync into history automatically.
- Manual add/update for Admin and Coordinator; delete is Admin-only.
- Staff-only archive view in the influencer profile with campaign, brand, platform, content link, compensation, performance metrics and internal notes.
- Excel archive import page with audit batches and unmatched-row reporting.
- Arabic/English UI. User-entered creator, brand and campaign data is never machine-translated.

## Import columns
The importer accepts the collaboration sheet `Campaign_Influencers_04` / `04_Campaign_Influencers`, or the first worksheet if those names are absent.

Recognized aliases include:
- Influencer Mobile / Mobile / Phone (required)
- Campaign Name (required)
- Brand / Brand Name
- Collaboration Type / Payment Type
- Collaboration Status / Status
- Publishing Date / Post Date / Collaboration Date
- Platform
- Content Type
- Published Link / Post Link / Content URL
- Agreed Amount / Amount
- Currency
- Views / Likes / Comments / Shares / Engagement Rate
- Performance Note / Notes
- Source Record ID

Unmatched phone numbers are logged for review and do not create placeholder influencers.

## Permissions
- Admin: view/add/edit/delete/import.
- Coordinator: view/add/edit/import.
- Finance/Reviewer/Viewer: read only.
- Influencer: no access to this staff archive.

## Deployment
1. Run `docs/PHASE_07_PREFLIGHT.sql`.
2. Add migration `20260912100000_influencer_work_history.sql` to the active Supabase baseline migrations directory.
3. `npx supabase db push --dry-run` — only Phase 07 should appear.
4. `npx supabase db push`.
5. Install the beta.7 application patch.
6. Run `npm ci`, `npm run i18n:audit`, `npm run typecheck`, `npm run build`.
