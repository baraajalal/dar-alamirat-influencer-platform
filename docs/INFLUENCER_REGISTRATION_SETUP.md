# Influencer Self-Registration Update

This update moves influencer lookup and registration away from SmartSuite and into Supabase while preserving the original registration form design.

## What is included

- Public influencer form keeps the original six-section design.
- Mobile lookup searches active influencers, then archive influencers and archive social accounts.
- Sensitive archive fields such as national ID, IBAN and bank information are never returned by the public lookup.
- New influencers create an Auth account using email and password.
- Existing unclaimed influencer records are linked to the new user account.
- Archive matches create a pending claim request for staff review.
- Influencer profile, financial details and social accounts are saved in one database transaction.
- Influencer dashboard and staff approval list are included.
- Public lookup and registration endpoints have basic hourly rate limits.

## 1. Back up the current project

Copy the current project folder before replacing files. Do not copy `.next` or `node_modules` into the backup if disk space is limited.

## 2. Copy the patch files

Extract the patch into the project root and allow Windows to replace files with the same names.

## 3. Install dependencies

```cmd
npm install
```

## 4. Add environment variables

Create or update `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY
REGISTRATION_RATE_LIMIT_SECRET=REPLACE_WITH_A_LONG_RANDOM_STRING
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never add `NEXT_PUBLIC_` to its name, never put it inside client components and never share it in chat or screenshots.

## 5. Run the database migration

Open Supabase SQL Editor and run:

`supabase/migrations/202607210002_influencer_self_registration.sql`

Run it once. It adds normalized mobile fields, account states, claim requests, rate limiting and the server-only registration transaction.

## 6. Restart the project

```cmd
npm run typecheck
npm run dev
```

Open `http://localhost:3000`.

## 7. Test these cases

1. A mobile number not found in the archive: blank form remains available and a new account is created.
2. A mobile number found once in the archive: non-sensitive fields and social accounts are prefilled.
3. A mobile number on an active unclaimed record: the existing record is linked after registration.
4. A mobile number already linked to a user: registration is blocked and the login link is shown.

After registering, sign in at `/login`. The influencer dashboard is `/influencer/dashboard`. Staff review registrations at `/dashboard/influencers`.

## Archive social-account columns

The lookup expects `archive_social_accounts` to use these column names:

- `archive_influencer_id`
- `platform`
- `username`
- `profile_url`
- `followers_count`
- `average_likes`
- `average_views`
- `average_comments`
- `engagement_rate`
- `female_audience`
- `male_audience`
- `audience_main_city`
- `audience_main_country`

If this table has different column names, influencer registration still works, but archive social accounts will not prefill until the mapping is adjusted.
