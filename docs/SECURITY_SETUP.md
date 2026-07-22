# Security setup checklist

## Must be done by the account owner

1. Revoke the SmartSuite API key that was used by the archived project.
2. Create a new temporary SmartSuite key only if a one-time export is still required.
3. Do not put any real key in Git, screenshots, chat messages, or Excel files.
4. Create the Supabase project and place its values only in `.env.local` and deployment secrets.
5. Enable multi-factor authentication for GitHub, Supabase, and deployment accounts.

## Environment key rules

- Variables beginning with `NEXT_PUBLIC_` are visible to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` and social platform secrets are server-only.
- `.env.local` is ignored by Git.
- `.env.example` contains names only and no real values.

## Personal data rules

- Influencer identity, bank, phone, and payment exports must not be committed to Git.
- Local export files belong in `data/`, which is ignored except for documentation.
- Financial information must be separated from the public influencer profile in the new database.
