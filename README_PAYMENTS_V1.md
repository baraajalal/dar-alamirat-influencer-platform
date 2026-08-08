# Dar Al Amirat — Payments & Dues V1

## Included

- Payments list: `/dashboard/payments`
- Payment details: `/dashboard/payments/[id]`
- Approval workflow: submit, approve, return, reject
- Partial and full bank transfers
- Transfer reference, finance batch, source bank and proof upload
- Voucher preparation/delivery/redeemed states
- Product preparation/shipping/delivery states
- Automatic assignment settlement and 45-day cooldown after every compensation item is completed
- Finance-only transaction history and masked bank data
- Arabic/English dashboard support

## Installation

1. Copy the patch contents into the project root.
2. Run `supabase/migrations/202607250009_payments_management.sql` in Supabase SQL Editor.
3. Restart the app.
4. Run:

```bash
npm run typecheck
npx eslint . --quiet
npm run dev
```

## Test order

1. Open `/dashboard/payments`.
2. Open a draft due and submit it for approval.
3. Approve it using an admin or finance user.
4. For bank transfer, record a partial amount and then the remaining amount.
5. For voucher/product, update fulfillment until delivered.
6. Confirm the assignment receives `settled_at` and `availability_blocked_until` after all items are completed.
