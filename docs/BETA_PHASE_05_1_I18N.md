# Beta Phase 05.1 — Native Arabic / English i18n

Version: `0.1.0-beta.5`

## Goal

Replace DOM text replacement on the highest-priority public and influencer surfaces with keyed Arabic/English dictionaries. The root locale cookie remains the source for `lang` and `dir`, while migrated pages render the correct language directly on the server/client rather than waiting for `GlobalTranslator` to mutate the DOM.

## Included in this patch

- Public home page.
- Staff/influencer login.
- Community join request registration and secure edit flow.
- Terms and Privacy entry pages.
- Influencer portal shell/navigation.
- Influencer dashboard.
- Campaigns and community opportunities.
- Portfolio.
- Performance.
- Payments.
- Notifications.
- Profile.
- Secure bank/payment details page.
- Staff campaign opportunity configuration.
- Staff join-request review page.

## Dictionary structure

- `messages/app/ar.json`
- `messages/app/en.json`
- `lib/i18n/app-dictionary.ts`
- Existing dashboard dictionaries are extended under `campaignOpportunity`.

All application and dashboard dictionaries are checked for Arabic/English key parity by `npm run i18n:audit`.

## Direction and formatting

- Arabic: `lang="ar"`, `dir="rtl"`.
- English: `lang="en"`, `dir="ltr"`.
- Migrated pages use logical layout/alignment and locale-aware number/date/currency formatting.
- User-entered campaign briefs, creator biographies, rejection reasons, links, handles and other stored content are intentionally not machine-translated.

## Compatibility

`GlobalTranslator` remains temporarily available for pages not yet migrated. Migrated surfaces opt out of DOM auto-translation with `data-no-auto-translate` so native dictionary rendering is not overwritten.

## Remaining Phase 05 work

Phase 05.2 should migrate the account activation/password and guest-assignment flows:

- `/portal/access/activate`
- `/portal/activate-account`
- `/portal/complete-account`
- `/portal/set-password`
- `/set-password`
- guest assignment/content collaboration flow

Phase 05.3 should migrate the remaining staff dashboard and finance/operations screens, then remove the legacy DOM translation layer after the final audit.

## Verification

Run:

```bash
npm ci
npm run i18n:audit
npm run typecheck
npm run build
```

Then manually test Arabic and English for all included surfaces, including RTL/LTR switching, validation errors, statuses, dates, numbers and SAR formatting.
