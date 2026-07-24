# Dar Al Amirat - Campaign Assignment V3

This patch updates only the campaign assignment workflow. It does not modify the frozen influencer registration pages.

## Included workflow

1. Select influencer and one or more social accounts.
2. Select collaboration type: home, in-branch, or other.
3. Select one or more compensation types: bank transfer, shopping voucher, and products.
4. Show a separate value field for each selected compensation.
5. For home collaborations, require order number and order value independently of compensation.
6. For in-branch collaborations, search existing branches or type a new branch that is saved for future use.
7. For vouchers, select website or branch redemption.
8. Support contract/agreement metadata and payment timing.
9. Hide content delivery and publishing dates for "other" collaborations that do not require content.
10. Calculate campaign budget from bank transfers and vouchers only. Product and order values remain reporting values.
11. Show budget overrun warnings without blocking save.
12. Save assignment, platforms, deliverables, compensations, payments, branch, and agreement data in one database transaction.
13. Preserve the global influencer availability and 45-day cooldown validation.

## Apply

1. Back up the project.
2. Copy this patch over the project root and replace matching files.
3. Run `supabase/migrations/202607240007_assignment_collaboration_compensation.sql` once in Supabase SQL Editor.
4. Run:

```bash
npm run typecheck
npm run lint
npm run dev
```

## Required test cases

- Home + bank transfer + voucher + products.
- In-branch with an existing branch.
- In-branch with a newly typed branch, then verify it appears in the next assignment form.
- Voucher redeemed from the website.
- Voucher redeemed from a branch.
- Other collaboration without content: dates should be hidden and no content items should be created.
- Contract/agreement with payment before publishing.
- Amount exceeding campaign budget: warning appears but saving remains allowed.
- Influencer unavailable due to active assignment or 45-day cooldown: saving is blocked.
