// scripts/delete-all-users-except-main.mjs
//
// SAFETY:
// 1) Dry-run by default: does NOT delete anything.
// 2) Set CONFIRM_DELETE_USERS=YES only after reviewing the printed list.
// 3) Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Run dry-run:
//   SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
//   node scripts/delete-all-users-except-main.mjs
//
// Run actual deletion:
//   SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
//   CONFIRM_DELETE_USERS=YES \
//   node scripts/delete-all-users-except-main.mjs

import { createClient } from "@supabase/supabase-js";

const KEEP_EMAIL = "baraaja.moh.2030@gmail.com".toLowerCase();
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmed = process.env.CONFIRM_DELETE_USERS === "YES";

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    all.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function main() {
  const users = await listAllUsers();

  const keepUser = users.find(
    (user) => (user.email ?? "").toLowerCase() === KEEP_EMAIL
  );

  if (!keepUser) {
    console.error(
      `ABORTED: Main account "${KEEP_EMAIL}" was NOT found in Supabase Authentication.`
    );
    console.error("Nothing was deleted.");
    process.exit(1);
  }

  const usersToDelete = users.filter((user) => user.id !== keepUser.id);

  console.log("==============================================");
  console.log("Main account that WILL BE KEPT:");
  console.log(`Email: ${keepUser.email}`);
  console.log(`User ID: ${keepUser.id}`);
  console.log("==============================================");
  console.log(`Total auth users: ${users.length}`);
  console.log(`Users to delete: ${usersToDelete.length}`);
  console.log("");

  for (const user of usersToDelete) {
    console.log(`DELETE -> ${user.email ?? "(no email)"} | ${user.id}`);
  }

  if (!confirmed) {
    console.log("");
    console.log("DRY RUN ONLY — NO USERS WERE DELETED.");
    console.log(
      'Review the list, then run again with CONFIRM_DELETE_USERS=YES to perform deletion.'
    );
    return;
  }

  console.log("");
  console.log("Deletion started...");

  let deleted = 0;
  const failures = [];

  for (const user of usersToDelete) {
    try {
      // false = hard delete (not soft delete)
      const { error } = await supabase.auth.admin.deleteUser(user.id, false);

      if (error) {
        failures.push({
          id: user.id,
          email: user.email ?? null,
          error: error.message,
        });
        console.error(
          `FAILED -> ${user.email ?? "(no email)"} | ${user.id}: ${error.message}`
        );
        continue;
      }

      deleted += 1;
      console.log(`DELETED -> ${user.email ?? "(no email)"} | ${user.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      failures.push({
        id: user.id,
        email: user.email ?? null,
        error: message,
      });

      console.error(
        `FAILED -> ${user.email ?? "(no email)"} | ${user.id}: ${message}`
      );
    }
  }

  console.log("");
  console.log("==============================================");
  console.log(`Deleted successfully: ${deleted}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Kept: ${keepUser.email} | ${keepUser.id}`);
  console.log("==============================================");

  if (failures.length > 0) {
    console.log("Failures:");
    console.table(failures);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
