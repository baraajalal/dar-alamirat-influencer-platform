# Dar Al Amirat Creator Community - Beta Launch Plan

## Current release

- Version: `0.1.0-beta.5.1`
- Source of truth: Supabase/PostgreSQL
- Legacy SmartSuite application routes: disabled by default
- Legacy route override: `ENABLE_LEGACY_SMARTSUITE_ROUTES=true` (emergency/controlled use only)

## Release gates

A beta release is blocked by any of the following:

1. Authentication or authorization bypass.
2. Influencer duplicate creation for an already-known creator.
3. Exposure of identity/banking data to an unauthorized role.
4. A financial status change without an audit trail.
5. Public registration without explicit acceptance of the current terms/privacy version.
6. A creator being able to join a paid/private campaign without staff approval.
7. An active production path still writing to SmartSuite.

## Phase tracker

### Phase 01 - Secure and reproducible baseline

Status: **COMPLETE (source level)**

- [x] Restore missing Next.js root project metadata.
- [x] Restore TypeScript path aliases and strict type checking.
- [x] Restore Next.js `proxy.ts` for Supabase session refresh.
- [x] Add `.env.example` with beta-safe defaults.
- [x] Disable legacy SmartSuite APIs by default.
- [x] Disable legacy coordinator/content-submit UI by default.
- [x] TypeScript `typecheck` passes.
- [ ] Full Linux `next build` verification (blocked in the review environment because the uploaded `node_modules` contains Windows SWC only and external package download is unavailable).
- [ ] Lint debt cleanup. Legacy files contain inherited `any` usage; current Supabase files still have a smaller set of lint issues to remove in later phases.

### Phase 02 - Terms, privacy and registration consent

Status: **COMPLETE (source level)**

- [x] Add versioned bilingual legal documents.
- [x] Require explicit Terms acceptance.
- [x] Require explicit Privacy acknowledgement.
- [x] Store accepted version and timestamp.
- [x] Enforce consent again on the API, not only in the browser.
- [x] Require the current legal versions before a join request can be created.
- [x] Show the consent audit record to staff during review.

### Phase 03 - One onboarding/approval workflow

Status: **COMPLETE (source level)**

Canonical flow:
`submitted -> under_review -> needs_changes / approved / rejected -> activated`

- [x] A submitted request must explicitly enter review before a decision.
- [x] Approval creates an activation link but does not make the influencer active.
- [x] Only completed activation sets the influencer account to active.
- [x] Needs-changes resubmission returns to submitted.
- [x] General registration edits are locked once staff review starts.
- [x] Repeated public requests cannot downgrade under-review or approved requests.
- [x] Old influencer-list approval entry points now redirect to the canonical review workflow.

### Phase 04 - Campaign opportunities and applications

Status: **COMPLETE (beta workflow)**

- [x] Community / invite-only / hidden campaign visibility.
- [x] Creator application instead of direct assignment.
- [x] Full opportunity details and creator compensation snapshot.
- [x] Staff review with direct social-account links.
- [x] Rejection reason shown to the creator.
- [x] Accepted application creates an assignment.
- [x] Participants and application-review navigation separated from opportunity editing.

### Phase 05 - Full Arabic/English translation and RTL/LTR audit

Status: **IN PROGRESS**

#### Phase 05.1 - Public, creator portal, campaigns and applications

Status: **COMPLETE (source level)**

- [x] Native Arabic/English dictionaries for beta-critical public and portal screens.
- [x] Native campaign opportunity/application translations.
- [x] Locale-aware RTL/LTR, dates, numbers and SAR formatting on migrated screens.
- [x] Add `i18n:audit` dictionary and hard-coded Arabic checks.

#### Phase 05.2 - Activation, passwords and guest collaboration

Status: **COMPLETE (source level; workstation UAT pending)**

- [x] Activation-link flow.
- [x] Direct creator account activation.
- [x] Payment-account completion/sign-in.
- [x] Password creation flows.
- [x] Guest assignment verification and details.
- [x] Guest draft/revision upload.
- [x] Guest publication submission.
- [x] Stable API error codes translated client-side.
- [x] Placeholder parity checks in `i18n:audit`.
- [ ] Arabic and English workstation UAT.

#### Phase 05.3 - Remaining staff and finance translation

Status: **NEXT**

- Migrate remaining staff dashboard screens.
- Migrate remaining finance screens and financial statuses.
- Verify role-specific errors and empty states in both languages.
- Remove the legacy DOM translator only after no beta-critical screen depends on it.

### Phase 06 - Brands, responsible teams and exclusivity

Status: **READY FOR DATABASE/WORKSTATION UAT**

- [x] Canonical brand identity/configuration in Arabic and English.
- [x] Brand-specific internal team and primary contact.
- [x] Dedicated WhatsApp/email contact surfaced to accepted creators.
- [x] Campaign-to-brand ownership and brand policy overrides.
- [x] Simplified exclusivity: none / selected brands / all campaigns.
- [x] Brand default -> campaign override -> assignment snapshot.
- [x] Target-aware blocking for community applications and direct assignment.
- [x] Admin-only early lift with mandatory reason and audit trail.
- [x] Preserve currently-active legacy cooldowns during migration.
- [ ] Supabase migration preflight and dry-run on beta database.
- [ ] Arabic/English workstation UAT.

### Phase 07 - Archive and duplicate-safe history

Status: **READY FOR DATABASE/WORKSTATION UAT**

One influencer record may have many historical collaborations. Legacy history must never create duplicate influencer identities.

- [x] Canonical staff-only work-history table linked to `influencer_id`.
- [x] Natural deduplication across manual, system and legacy-import sources.
- [x] Existing paid/closed/completed assignments backfilled automatically.
- [x] Future completed assignments synchronized automatically.
- [x] Manual add/edit for Admin and Coordinator; Admin-only delete.
- [x] Excel/CSV legacy-work import matched by normalized mobile only.
- [x] Unmatched/invalid import rows retained in an audit batch instead of creating placeholder influencers.
- [x] Arabic/English staff UI and archive summaries on the influencer profile.
- [ ] Supabase migration preflight/dry-run on beta database.
- [ ] Workstation UAT with a small real archive sample.

### Phase 08 - Qualification and evaluation

Status: pending

- Creator qualification checklist and staff decision support.
- Historical performance and brand-fit context.
- Staff remains the final decision maker.

### Phase 09 - Campaign execution and content lifecycle

Status: pending

- Assignment -> brief -> draft -> review -> revision -> approval -> publication -> close.
- Creator and staff status synchronization.

### Phase 10 - Finance and audit UAT

Status: pending

- Bank profile approval.
- Payment drafts/batches/transfers.
- Partial/returned payments.
- Voucher/product compensation.
- Financial audit trail and role isolation.

### Phase 11 - Roles, security, notifications and closed beta

Status: pending

- Role matrix and API authorization tests.
- Portal notifications and important follow-up events.
- Mobile/RTL/LTR tests.
- Closed beta with real PR and Paid workflows.

