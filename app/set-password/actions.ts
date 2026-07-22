"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setInvitedUserPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect("/set-password?error=password_short");
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    redirect("/set-password?error=password_weak");
  }

  if (password !== confirmPassword) {
    redirect("/set-password?error=password_mismatch");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=invalid_invite");

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) redirect("/set-password?error=update_failed");

  const admin = createAdminClient();
  const { error: activationError } = await admin.rpc(
    "complete_influencer_portal_activation",
    { p_user_id: user.id },
  );

  if (activationError) {
    console.error("Portal activation failed:", activationError);
    redirect("/set-password?error=profile_update_failed");
  }

  redirect("/influencer/dashboard");
}
