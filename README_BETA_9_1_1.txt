Dar Al Amirat Creator Community - beta.9.1.1 Unified Operations

Purpose:
One consolidated release to reduce coordinator clicks while preserving existing staff and creator login flows.

Main features:
- Coordinator My Work dashboard: only the coordinator's current creators/campaign assignments.
- Automatic campaign fit ranking.
- Checkbox selection of campaign applicants.
- Participant Draft before Assignment creation.
- Direct add and join requests use the same draft flow.
- One-by-one simplified Assignment finalization.
- Campaign data inherited automatically; exceptions hidden under More.
- Normal / Watchlist / Blacklisted internal creator handling.
- Blacklisted creators are blocked from new campaign work without exposing the label to creators.
- Separate Admin Portal Account controls: correct email, resend access/reset, suspend/reactivate.
- Compact Assignment summary; legacy detailed workflow remains under Advanced for exceptions.
- Assignment problem flag feeds the coordinator My Work queue.
- Arabic / English keys for the new operational surfaces.

INSTALLATION:
Extract the ZIP and run INSTALL.ps1 in PowerShell.
The installer creates a timestamped code backup BEFORE copying any release files.
Existing .env files are preserved.
Then follow docs\INSTALLATION_ORDER.txt.

IMPORTANT:
The database patch is additive and does not modify auth.users, passwords, or existing sessions.
Do not run supabase db push for this manual installation.
