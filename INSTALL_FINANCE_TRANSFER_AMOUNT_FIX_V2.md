# Finance transfer amount fix V2

1. Copy the `app` and `supabase` folders into the project root.
2. Run `supabase/migrations/202608020017_finance_transfer_effective_amount_view.sql` in Supabase SQL Editor.
3. Clear Next cache and restart:

```cmd
rmdir /s /q .next
npm run typecheck
npx eslint . --quiet
npm run dev
```

The transfer page now reads `remaining_amount` from a database view that resolves the value from:

1. `payments.expected_amount`
2. `payments.amount`
3. linked `assignment_compensations.amount`
4. `campaign_assignments.agreed_amount`

This removes the frontend ambiguity that caused a correct approval amount to display as zero in transfer grouping.
