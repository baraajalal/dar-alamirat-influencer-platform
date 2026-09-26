# Beta Phase 05.2 — English typography polish

Version: `0.1.0-beta.5.2`

## Changes

- English UI now uses the system font **Times New Roman** consistently across nested legacy and migrated screens.
- Arabic remains on **Tajawal** and is not resized by this patch.
- Common English Tailwind type sizes were reduced to a more compact scale without changing the Arabic type scale.
- Registration/onboarding-specific English headings, labels, buttons, helper text, and completion metrics received matching compact sizes.
- English headings use a lighter 700 weight and neutral tracking to suit Times New Roman.
- No database migration is required.

## Verification

Run:

```bash
npm run i18n:audit
npm run typecheck
npm run build
```

Then verify both locales: Arabic must retain Tajawal/RTL, while English must use Times New Roman/LTR at the compact scale.
