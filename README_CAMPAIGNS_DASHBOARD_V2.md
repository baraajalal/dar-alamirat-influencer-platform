# Dar Al Amirat — Campaign Dashboard V2

This patch redesigns the employee campaign module to use the shared employee dashboard layout.

## Included

- Campaign list with metrics, search, status filters, responsive table/cards, budgets and progress.
- New campaign form with shared dashboard cards and Arabic/English support.
- Campaign details with budget summary, assignments, contracts, platforms, order code and timeline.
- Add-influencer flow organized into three steps:
  1. Influencer and social accounts.
  2. Collaboration options.
  3. Payment, compensation and contract.
- Role permissions now use `requirePermission()` and `hasPermission()`.
- Branch loading failure no longer crashes the page; new branches can still be typed and saved.
- Search effect avoids synchronous state changes inside `useEffect`.
- Existing Supabase tables, RPCs, budget rules and 45-day availability logic are preserved.

## Installation

Copy the patch contents to the project root and replace matching files.

No new packages or SQL migration are included.

Run:

```bash
npm run typecheck
npx eslint . --quiet
npm run dev
```

Test:

- `/dashboard/campaigns`
- `/dashboard/campaigns/new`
- `/dashboard/campaigns/[campaign-id]`
- `/dashboard/campaigns/[campaign-id]/influencers/add`
