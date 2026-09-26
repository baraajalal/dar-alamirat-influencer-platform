# Phase 04 - Campaign Opportunities

Release: `0.1.0-beta.3`

## Scope

This phase adds a controlled community opportunity flow without exposing administrative campaign data.

### Campaign visibility

Each campaign now has one of three portal visibility modes:

- `hidden`: never shown as an opportunity.
- `invite_only`: staff may assign creators manually; not shown in community opportunities.
- `community`: shown to active creator accounts while the application window is open.

Campaigns remain private at the table/RLS level. Public opportunity data is returned through `list_campaign_opportunities()` so creator clients cannot query budget, internal notes, external contact details, or other administrative columns.

### Creator flow

`community opportunity -> pending application -> shortlisted / accepted / rejected`

Creators can withdraw pending/shortlisted applications. A withdrawn application may be resubmitted while the campaign is still open. A creator/campaign pair uses a single application record to prevent duplicates.

### Staff flow

Staff opens `/dashboard/campaigns/[id]/applications` to:

1. Configure opportunity visibility/type/window/limits.
2. Review applicant profile and social-account summary.
3. Shortlist, accept or reject.
4. On acceptance, `review_campaign_application()` creates/links the campaign assignment in the same database transaction.

### Availability and limits

Application submission and acceptance both enforce the existing global campaign availability/cooldown rule. Acceptance also enforces the campaign participant limit. The application limit counts pending, shortlisted and accepted applications.

### Audit

Submission and staff review write entries to `activity_logs`.

## Database migration

Copy `20260911081200_campaign_opportunities.sql` into the active baseline migration folder (the folder that already contains `20260911081054` and `20260911081100`). Always run `supabase db push --dry-run` first. The dry run must list only `20260911081200_campaign_opportunities.sql`.

## Verification status

- `npm run typecheck`: PASS
- ESLint for all Phase 04 changed/new TypeScript files: PASS
- Full Linux `next build`: not executable in the review container because Next.js attempts to download the Linux SWC binary and network access is disabled. Run the build on the Windows beta workstation after `npm ci`.
