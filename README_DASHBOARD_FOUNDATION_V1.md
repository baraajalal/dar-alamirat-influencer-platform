# Employee Dashboard Foundation V1

This patch changes only the employee dashboard area under `app/dashboard` and shared dashboard components.
It does not modify the public influencer registration, influencer login, portal access, or influencer dashboard pages.

## Included
- Shared employee dashboard layout
- Responsive RTL/LTR sidebar and header
- Arabic and English language switcher using a dashboard-only cookie
- Central role/permission matrix
- Role-aware navigation
- Redesigned main employee dashboard using live Supabase data
- Loading skeleton

## Apply
Copy the patch contents to the project root and replace matching files.
Then run:

```bash
npm run typecheck
npm run lint
npm run dev
```
