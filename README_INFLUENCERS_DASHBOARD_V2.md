# Dar Al Amirat — Influencers Dashboard V2

This patch updates only the employee influencer module.

## Included files
- `app/dashboard/influencers/page.tsx`
- `app/dashboard/influencers/[id]/page.tsx`
- `app/dashboard/influencers/actions.ts`

## Features
- Unified employee dashboard visual identity.
- Search by influencer name, mobile, email, or social username.
- Filters by city, gender, platform, Mawthooq status, and campaign availability.
- Profile completion and campaign availability indicators.
- 45-day cooldown display.
- Influencer details page with social accounts, campaigns, payments, and protected finance section.
- Permission-aware create, approve, reject, and financial-data visibility.
- Arabic/English support through the dashboard language cookie.
- No database migration is required.
- Registration, influencer login, and portal access pages are not changed.

## Apply
Copy the patch contents into the project root and allow replacement.

Then run:

```cmd
npm run typecheck
npx eslint . --quiet
npm run dev
```

Test:
- `/dashboard/influencers`
- `/dashboard/influencers/<influencer-id>`
