# Direct guest registration V2

This patch replaces the email OTP activation flow with direct account creation from a verified guest assignment.

## New flow

1. The influencer opens the secure assignment link and verifies the last four mobile digits.
2. The influencer submits the content and publication link.
3. The influencer chooses **Create influencer account**.
4. The influencer enters the full mobile number, email, password, and password confirmation.
5. The server normalizes and compares the mobile with the number attached to the assignment.
6. On a match, the Auth user is created, linked to the existing influencer record, and signed in.
7. The influencer is redirected to bank details, then can use the existing influencer dashboard, campaigns, portfolio, performance, and payments pages.

## Accepted mobile formats

All of these normalize to the same Saudi E.164 value:

- `0501234567`
- `501234567`
- `966501234567`
- `+966501234567`
- `00966501234567`
- Arabic-Indic digits such as `٠٥٠١٢٣٤٥٦٧`
- Persian digits such as `۰۵۰۱۲۳۴۵۶۷`
- Spaces, dashes, and parentheses are ignored.

## Install

Copy the patch contents into the project root and allow file replacement.

Run this migration in Supabase SQL Editor after migration `202607300012`:

```text
supabase/migrations/202608010013_direct_guest_registration.sql
```

Expected result:

```text
Success. No rows returned
```

Then run:

```cmd
rmdir /s /q .next
npm run typecheck
npx eslint . --quiet
npm run dev
```

## Test

1. Create one test influencer and campaign assignment.
2. Create the secure guest link.
3. Open it in a private window and verify the last four mobile digits.
4. Submit a publication link.
5. Click **Create influencer account**.
6. Test an incorrect full mobile number; registration must be rejected.
7. Test the correct number in Arabic digits or with `+966`.
8. Enter an unused email and a password of at least eight characters containing a letter and a number.
9. Confirm automatic redirection to `/portal/profile/payment-details`.
10. Save test bank details and confirm that `/portal/dashboard` and the other influencer pages open.

## Important security behavior

- No OTP or SMTP setup is required for this version.
- The guest link and guest mobile verification are still required.
- Full mobile matching is performed again on the server before account creation.
- The email becomes the login identifier but mailbox ownership is not independently verified in this flow.
- Passwords are stored only by Supabase Auth and are never written to application tables or logs.
- Existing influencer accounts are not duplicated; the user is sent to the login flow.
