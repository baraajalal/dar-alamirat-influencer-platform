# Beta Phase 06 — Brands, Brand Teams, and Exclusivity

Version: `0.1.0-beta.6`

## Purpose
Phase 06 turns brands into first-class operational records and connects each campaign to one brand. It also replaces the fixed 45-day settlement cooldown with an explicit exclusivity policy controlled by the brand/campaign agreement.

## Brand management
- Central brand registry with Arabic and English names.
- Logo and brand colors.
- Brand WhatsApp, email, primary contact, and internal team members.
- Active/inactive status.
- Existing common Dar Al Amirat brands are seeded without activating exclusivity by default.
- Legacy campaign brand text is preserved while known values are linked to canonical brand records.

## Campaign brand ownership
- New campaigns require a canonical brand.
- Existing campaigns can be linked or relinked to a brand from the campaign page.
- The compatibility `campaigns.brand` text remains synchronized with the canonical brand record.
- Influencers see the correct brand identity and campaign contact details after joining the campaign.

## Exclusivity policy
There are only three final scopes:
1. `none` — no exclusivity.
2. `brands` — blocks only selected brands.
3. `all` — blocks all campaigns.

The brand stores a default policy. A campaign may inherit it or override it. The final policy is snapshotted onto the influencer assignment when the assignment is created so later brand changes do not silently rewrite an existing agreement.

The restriction can start from:
- Publishing date.
- Assignment acceptance date.

Duration is 0–365 days. A selected-brand restriction requires at least one blocked brand.

## Admin early lift
Only an Admin may lift an active restriction before its expiry. A reason is mandatory. The system stores:
- who lifted it;
- when it was lifted;
- the reason;
- the original restriction end date;
- an Activity Log event.

## Enforcement
The database, not only the UI, blocks conflicting assignment inserts/updates.
- Global exclusivity blocks every campaign.
- Brand exclusivity blocks only campaigns whose brand is in the assignment snapshot.
- Community opportunity application and approval are checked against the target campaign.
- Direct staff creator search is target-aware and shows the restriction before the coordinator tries to add the influencer.

## Legacy cooldown behavior
Any currently active legacy cooldown is preserved as a global restriction during migration so active protection is not lost. The old settlement trigger that automatically created a fixed 45-day cooldown is removed. Financial settlement still moves eligible assignments to paid, but no longer creates/extends exclusivity.

## Publishing date propagation
Direct assignments now save Content Due and Publishing Date from the assignment form. Community-application assignments inherit the campaign publishing date. This is required when exclusivity starts from publishing date.

## Language rules
All Phase 06 UI additions are Arabic/English. Arabic remains RTL/Tajawal. English remains LTR/Times New Roman. Dynamic database values such as creator names, campaign names and brand data are never DOM-translated.

## Recommended deployment
1. Take a fresh database backup.
2. Copy `20260912090000_brand_management_exclusivity.sql` into the active Supabase baseline migration directory.
3. Run the supplied Phase 06 preflight SQL in Supabase SQL Editor.
4. Run `npx supabase db push --dry-run` and verify that only Phase 06 is pending.
5. Run `npx supabase db push` after the checks pass.
6. Install the Phase 06 application patch.
7. Run `npm ci`, `npm run i18n:audit`, `npm run typecheck`, and `npm run build`.
8. Run the functional test matrix below.

## Functional test matrix
- Create a brand in Arabic/English with a team and contact details.
- Create a campaign using the brand.
- Verify campaign shows the canonical brand.
- Set brand default to no restriction; verify creator can join another campaign.
- Set a test campaign to selected-brand restriction for 45 days; accept an influencer and set publishing date.
- Verify the creator is rejected only from a blocked brand after restriction start.
- Verify an unrelated brand campaign remains allowed.
- Test `all campaigns` restriction and verify every target campaign is blocked.
- Test community application: blocked creator cannot apply/accept into a conflicting target.
- Test direct staff creator search: restricted creator is displayed as unavailable with bilingual explanation.
- Login as non-admin and verify early lift is unavailable/rejected.
- Login as Admin, lift with a reason, and verify assignment becomes available immediately while audit history remains.
- Verify influencer portal shows the correct accepted campaign brand contact.
