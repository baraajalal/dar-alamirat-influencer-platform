# Campaign Assignment V2

This patch adds the first complete workflow for linking an influencer to a campaign.

## Included

- Global influencer availability check.
- Active assignments block all other campaigns.
- Full settlement starts a 45-day cooldown.
- Search by name, mobile digits, or social username.
- Campaign budget preview and live over-budget warning.
- Over-budget assignments remain saveable.
- Multiple social accounts and deliverables.
- Transactional creation of assignment, platforms, content items, and compensation.
- Campaign detail budget summary.

## Apply

1. Copy the patch files into the project root.
2. Run `supabase/migrations/202607240006_campaign_assignment_budget_cooldown.sql` in Supabase SQL Editor.
3. Run:

```bash
npm run typecheck
npm run lint
npm run dev
```

## Test

1. Add an available influencer to Campaign A.
2. Search for the same influencer in Campaign B: the result must be blocked.
3. Mark all compensation payments as paid: the assignment receives a settlement date and 45-day cooldown.
4. Search during cooldown: blocked with an availability date.
5. Add an influencer whose price exceeds the campaign budget: warning appears, save remains enabled.
