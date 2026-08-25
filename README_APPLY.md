# Staff temporary password + forced change patch

## Apply
Copy the included files over the same paths in the project.

## Behavior
1. Admin opens `/dashboard/users`.
2. For an active staff account, admin can type or generate a temporary password, copy it, then click `تعيين مؤقتة`.
3. The server updates the Supabase Auth password and sets secure `app_metadata.must_change_password = true`.
4. Admin sends the copied temporary password to the employee manually.
5. Employee signs in from `/staff/login` with the temporary password.
6. The employee is forced to `/staff/change-password`; all `/dashboard` access is blocked until the password is replaced.
7. Employee enters the temporary password, then a new password and confirmation.
8. After success, the force-change flag is removed and the employee is redirected to `/dashboard`.

## Database
No SQL migration is required. The force-change flag is kept in Supabase Auth `app_metadata`, which cannot be changed by the normal browser client.

## Security notes
- The admin action requires the `users:manage` permission and additionally verifies the current profile role is `admin`.
- Temporary passwords are never stored in `profiles` or logs.
- The user's existing Supabase `app_metadata` is preserved.
- The current logged-in admin cannot set a temporary password for their own account from the user list.

## Important
This patch is based on the latest project archive available in the conversation (`New folder(1).zip`).
