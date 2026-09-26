# Beta 7.2 — Archive → Registration → Admin Match → Activation Review

## Canonical rule
Archive data is historical reference data, not a portal account. Every creator must self-register.

## Flow
1. Import 2026 historical monthly files. The importer creates/updates one archived creator profile and attaches work history.
2. Re-import is safe: existing creator/social/work-history values are preserved; only missing values are filled.
3. A creator submits the public registration form. The submission is staged before it touches an archive profile.
4. Matching checks canonical Saudi mobile, platform + username, and normalized profile URL. Full name is only a supporting signal.
5. If there is any identity candidate, the request goes to **Archive Match Requests**. Only `admin` can decide.
6. **Confirm same creator** keeps the existing influencer ID and historical work. Only missing fields/social details are added.
7. **Not the same creator** creates a new influencer only if the normalized mobile is not already used. Exact-mobile conflicts require corrected registration data; duplicate mobile identities are never allowed.
8. Whether matched or newly created, the creator then enters the existing portal activation review: submitted → under review → needs changes / approved / rejected → activation.
9. Archived and activation-pending creators cannot be assigned to campaigns. Active and Managed/VIP creators can be assigned under the existing rules.

## Admin ownership
Archive identity matching is admin-only. Coordinators/finance can continue to work with the normal activation review according to existing permissions, but they cannot merge a registration into an archive profile.

## Direct archive activation
Disabled. Archived creators must register first so matching is auditable and human-approved.

## Mobile identity
Arabic, Persian, and English digits and common Saudi forms normalize to the same canonical `9665XXXXXXXX` identity.
