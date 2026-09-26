# beta.9.1.1 — Unified Coordinator Operations

This release consolidates the operational simplification requested for Dar Al Amirat while preserving the existing staff and creator login flows.

## What changes

- Coordinator home becomes **My Work**, showing only assignments owned by that coordinator.
- Daily work is grouped into: needs action, content review, waiting creator, waiting publish, problems/overdue, completed.
- Campaign join requests are automatically ranked from highest fit to lowest using campaign criteria and creator metrics.
- Join-request selection is checkbox-based and saves creators into a **Participant Draft**. It does not create assignments yet.
- Direct creator selection and campaign applications converge into the same Participant Draft.
- Each creator is finalized into an Assignment individually with a short, collaboration-specific form.
- Campaign defaults are inherited. PR normally asks for order number; Paid normally asks only for amount when needed; Attendance asks location/time; extra fields are hidden under More options.
- Influencer handling is separate from qualification: Normal / Watchlist / Blacklisted.
- Blacklisted creators are excluded from new campaign suggestions, applications and assignments without exposing the blacklist label to the creator.
- Portal account administration is separated from the creator profile: admin may correct login email, resend access/password recovery, suspend or reactivate portal access. Admins never see or set creator passwords.
- Assignment execution shows a compact summary first. Legacy/manual milestone controls remain available under Advanced execution details for exceptions.
- Staff can flag an Assignment as needing attention; it then surfaces on the coordinator dashboard.
- New UI strings are provided in Arabic and English and follow RTL/LTR through the existing dashboard locale system.

## What does NOT change

- Existing staff login routes.
- Existing creator login / activation / password setup routes.
- Existing auth users, passwords, sessions or Supabase Auth schema.
- Existing historical assignments, content, work history, payments or campaign applications.
- The existing detailed execution workflow is retained as an advanced fallback rather than deleted.

## Database safety

`UNIFIED_OPERATIONS_DB_PATCH.sql` is additive and wrapped in a transaction. It does not alter `auth.users`.
Run `UNIFIED_OPERATIONS_PREFLIGHT.sql` first and only continue when the summary is `READY`.

## Normal campaign operating flow

1. Campaign defines shared brief, dates, platform and qualification criteria once.
2. Join requests are ranked automatically.
3. Coordinator checks creators and saves a group to Participant Draft.
4. Direct-added creators may be saved to the same draft.
5. Coordinator creates each Assignment individually, entering only required/different details.
6. Coordinator returns to My Work and acts only on exception queues or content needing review.

## Restriction model

- Normal: no restriction.
- Watchlist: internal warning only.
- Blacklisted: blocks new campaign participation. Historical records and payments remain.

Creators never see the internal Watchlist/Blacklist label.
