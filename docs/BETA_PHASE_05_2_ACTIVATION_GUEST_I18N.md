# Beta Phase 05.2 - Activation and Guest Collaboration i18n

Release: `0.1.0-beta.5.1`

## Goal

Complete native Arabic/English translation for creator activation, password setup, and the guest assignment/content workflow. Arabic uses RTL and English uses LTR through the shared application locale. User-facing API failures are resolved from stable machine-readable error codes instead of displaying Arabic backend messages in English mode.

## Migrated surfaces

- `/portal/access/activate`
- `/portal/activate-account`
- `/portal/complete-account`
- `/portal/set-password`
- `/set-password`
- `/portal/assignments/[token]`
- Guest assignment verification
- Guest content upload/revision
- Guest publication-link submission
- Payment-account completion prompt after publication

## Translation architecture

- New dictionaries:
  - `messages/flows/ar.json`
  - `messages/flows/en.json`
- Loader:
  - `lib/i18n/flow-dictionary.ts`
- Migrated pages use `data-no-auto-translate`; they do not depend on the legacy DOM text-replacement translator.
- Dates, numbers, version numbers, and SAR amounts are formatted according to the active locale.
- Common stored content-type values created in either Arabic or English are normalized for display through bilingual aliases.

## API error contract

The related APIs now include stable `code` values. UI clients translate those codes locally while legacy Arabic `message` values remain temporarily for backward compatibility.

Covered API groups:

- portal access activation
- influencer password completion
- guest assignment load
- guest mobile verification
- guest content submission
- guest publication submission

## Audit additions

`npm run i18n:audit` now checks:

1. Arabic/English dictionary key parity for `app`, `dashboard`, and `flows`.
2. Placeholder parity such as `{name}` and `{number}` between Arabic and English.
3. No hard-coded Arabic in every migrated Phase 05.1/05.2 UI surface, except explicitly documented canonical input values.

## Database

No database migration is required for Phase 05.2.

## UAT matrix

Run every item once in Arabic and once in English:

1. Open a valid activation link and create a password.
2. Open an invalid/expired activation link and verify the localized error.
3. Complete an existing-account payment flow.
4. Complete a direct creator-account activation flow.
5. Create/set password and continue to the creator portal.
6. Open a guest assignment link before verification.
7. Verify with an incorrect mobile suffix and then a correct suffix.
8. Review campaign brief, execution details, compensation, hashtags, and references.
9. Upload a draft and then a revision.
10. Confirm invalid file/link errors are localized.
11. Submit a publication link after content approval.
12. Confirm the bank/account completion prompt is localized.
13. Toggle the application language on each flow and verify RTL/LTR changes correctly.

## Exit criteria

Phase 05.2 is accepted when:

- `npm run i18n:audit` passes.
- `npm run typecheck` passes in the deployment/workstation environment.
- `npm run build` passes in the deployment/workstation environment.
- The UAT matrix passes in both Arabic and English.

## Next phase

Phase 05.3 will migrate the remaining staff/dashboard and finance surfaces to native dictionaries, then remove the legacy `GlobalTranslator` once no beta-critical page depends on DOM translation.
