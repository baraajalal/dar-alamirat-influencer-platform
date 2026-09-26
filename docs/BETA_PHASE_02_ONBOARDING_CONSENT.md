# Phase 02/03 - Legal consent and canonical onboarding workflow

## Release

- Version: `0.1.0-beta.2`
- Date: 2026-09-11
- Source of truth: Supabase/PostgreSQL
- Required migration: `supabase/migrations/202609110029_beta_registration_consent_and_portal_workflow.sql`

## What changed

### 1. Versioned legal documents

Added bilingual public pages:

- `/terms`
- `/privacy`

The current versions are defined only in `lib/legal/versions.ts`:

- Terms: `2026-09-11-v1`
- Privacy: `2026-09-11-v1`

The text is an operational beta draft. It should receive final legal review before unrestricted public launch.

### 2. Mandatory consent at registration

The final registration step requires two independent confirmations:

- Terms and Conditions accepted.
- Privacy Policy accepted.

The browser validation is not trusted on its own. `/api/submit-influencer` validates both confirmations again server-side and rejects a direct bypass with `CONSENT_REQUIRED`.

The server stores two immutable versioned audit rows in `influencer_legal_consents` with:

- influencer ID
- document type
- document version
- locale
- accepted timestamp
- source

The join-request API also verifies that the influencer has accepted the *current* versions before creating a request.

### 3. Canonical onboarding workflow

Portal access now uses one state vocabulary:

`submitted -> under_review -> needs_changes / approved / rejected -> activated`

Rules:

- `submitted`: creator finished registration and sent the join application.
- `under_review`: an admin explicitly started review.
- `needs_changes`: staff issued a single-use edit link.
- Resubmitting from that edit link returns the request to `submitted`.
- `approved`: staff approved and generated a 72-hour activation link. The influencer is **not active yet**.
- `activated`: the influencer used the activation link and the account was actually created/linked.
- `rejected`: the join application was rejected.

### 4. Review-lock protection

The public registration endpoint can no longer be used to silently change a profile after staff review begins. Public editing is blocked while the request is:

- `under_review`
- `needs_changes`
- `approved`

For `needs_changes`, the creator must use the secure edit link issued by staff.

Repeated calls to the join-request API also preserve the current workflow. They cannot downgrade an `under_review`, `needs_changes`, or `approved` request back to `submitted`.

### 5. Removed approval bypass

The influencer list/detail pages no longer contain a separate action capable of marking an influencer active. They route reviewers to the matching portal-access request. The old server action remains only as a compatibility redirect so old bookmarks/clients cannot bypass the canonical workflow.

### 6. Staff consent audit

The access-request detail screen shows whether the current Terms and Privacy versions exist for the influencer, including accepted time and locale.

## Database migration behavior

Migration `202609110029_beta_registration_consent_and_portal_workflow.sql`:

1. Creates `influencer_legal_consents` with RLS.
2. Converts old portal status `pending` to `submitted`.
3. Converts old portal status `completed` to `activated`.
4. Enforces the canonical status constraint.
5. Ensures only one open join/access request per influencer.
6. Changes invitation linking so the request must already be `approved`.
7. Changes activation completion so only real account activation sets `account_status = active`.

## Deployment order

1. Back up the beta/staging Supabase database.
2. Apply migration `202609110029_beta_registration_consent_and_portal_workflow.sql`.
3. Keep `ENABLE_LEGACY_SMARTSUITE_ROUTES=false`.
4. Deploy application version `0.1.0-beta.2`.
5. Run `npm ci`.
6. Run `npm run typecheck`.
7. Run `npm run build`.
8. Run the smoke tests below before inviting creators.

## Required smoke tests

| Test | Expected result |
| --- | --- |
| Submit registration without Terms | Rejected; field points to Terms consent |
| Submit registration without Privacy | Rejected; field points to Privacy consent |
| Call registration API directly without consent | HTTP 400 `CONSENT_REQUIRED` |
| Valid registration | Profile + two current consent records + `submitted` request |
| Start staff review | Request becomes `under_review` |
| Re-submit public registration while under review | HTTP 409 `PROFILE_LOCKED_FOR_REVIEW` |
| Request changes | Request becomes `needs_changes`; single-use edit link created |
| Submit edit link | Request returns to `submitted`; token becomes used |
| Approve before starting review | Blocked |
| Approve under-review request | Request becomes `approved`; influencer remains non-active |
| Call public request again after approval | Existing status preserved; no downgrade |
| Use activation link | Account linked; request becomes `activated`; influencer becomes active |
| Reuse activation link | Rejected as used/invalid |
| Reject under-review request | Request becomes `rejected`; influencer account status becomes rejected |
| Staff opens request details | Current legal consent versions and timestamps are visible |

## Verification in the review workspace

- Full TypeScript check: **PASS** (`tsc --noEmit`, zero errors).
- Full ESLint: **NOT CLEAN** because the inherited baseline still contains legacy `no-explicit-any` and older React-hook lint debt, especially in routes disabled in Phase 01. This debt predates the legal/workflow change and should be cleaned separately; it does not change the TypeScript PASS result.
- A clean deployment environment should still run `npm ci && npm run typecheck && npm run build` after applying the migration.

## Next phase

Phase 04 is the full Arabic/English translation and RTL/LTR audit for all beta-critical screens.
