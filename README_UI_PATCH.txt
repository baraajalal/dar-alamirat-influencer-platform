Dar Al Amirat Creator Community
UI Patch: beta.7.2.1

Scope
- Redesigns only /dashboard/influencers.
- No database migration required.
- No archive, matching, registration, activation, or assignment logic is changed.

UI changes
- Compact page header with clearer action hierarchy.
- Primary Emergency Add action and secondary Match Requests / Archive Import / Registration actions.
- Match request count badge is always visible.
- More compact stats cards.
- Rebuilt search/filter area using a 12-column responsive grid.
- Visible result count and clear-filters action.
- Smaller Apply button and denser controls.
- Cleaner table header, tighter rows, reduced minimum table width.
- Social accounts show up to 3 chips plus a +N counter.
- Preserves Arabic RTL / English LTR and existing dynamic data.

Install
1. Back up the current project folder.
2. Copy this patch folder over C:\DA-Creator-Beta\influencer_beta_work with overwrite enabled.
3. Run from the project folder:
   npm ci
   npm run i18n:audit
   npm run typecheck
   npm run build
   npm run dev

Expected version: 0.1.0-beta.7.2.1
