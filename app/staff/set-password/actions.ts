"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function setStaffPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) redirect("/staff/set-password?error=password_short");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    redirect("/staff/set-password?error=password_weak");
  }
  if (password !== confirmation) redirect("/staff/set-password?error=password_mismatch");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/staff/login?error=invalid_invite");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,is_active,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role === "influencer") {
    await supabase.auth.signOut();
    redirect("/staff/login?error=not_staff");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/staff/login?error=account_disabled");
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) redirect("/staff/set-password?error=update_failed");

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ invitation_status: "active", updated_at: now })
    .eq("id", user.id);

  if (profileError) {
    console.error("STAFF_ACTIVATION_PROFILE_FAILED", profileError);
    redirect("/staff/set-password?error=profile_update_failed");
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "profile",
    entity_id: user.id,
    action: "staff_invitation_accepted",
    metadata: { role: profile.role },
  });

  // End the temporary invitation session. The employee must now sign in
  // through the dedicated staff login page using the new password.
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("STAFF_ACTIVATION_SIGN_OUT_FAILED", signOutError);
  }

  redirect("/staff/login?activated=1");
}
