"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function passwordIsStrong(value: string) {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export async function changeForcedStaffPassword(formData: FormData) {
  const currentPassword = String(
    formData.get("current_password") ?? ""
  ).trim();

  const newPassword = String(
    formData.get("new_password") ?? ""
  ).trim();

  const confirmation = String(
    formData.get("confirm_password") ?? ""
  ).trim();


  if (!currentPassword) {
    redirect("/staff/change-password?error=current_required");
  }

  if (!passwordIsStrong(newPassword)) {
    redirect("/staff/change-password?error=password_weak");
  }

  if (newPassword !== confirmation) {
    redirect("/staff/change-password?error=password_mismatch");
  }

  if (currentPassword === newPassword) {
    redirect("/staff/change-password?error=password_same");
  }


  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();


  if (!user || !user.email) {
    redirect("/staff/login?error=invalid_credentials");
  }


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


  const { error: verifyError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });


  if (verifyError) {
    redirect("/staff/change-password?error=current_invalid");
  }


  const { error: passwordError } =
    await supabase.auth.updateUser({
      password: newPassword,
    });


  if (passwordError) {
    console.error(
      "STAFF_FORCED_PASSWORD_UPDATE_FAILED",
      passwordError
    );

    redirect("/staff/change-password?error=update_failed");
  }


  const { data: authResult } =
    await admin.auth.admin.getUserById(user.id);


  if (!authResult.user) {
    redirect("/staff/change-password?error=metadata_failed");
  }


  const appMetadata = {
    ...(authResult.user.app_metadata ?? {}),
  };

  delete appMetadata.must_change_password;
  delete appMetadata.temporary_password_set_at;
  delete appMetadata.temporary_password_set_by;


  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
  });


  const now = new Date().toISOString();

  await admin
    .from("profiles")
    .update({
      invitation_status: "active",
      updated_at: now,
    })
    .eq("id", user.id);


  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "profile",
    entity_id: user.id,
    action: "staff_temporary_password_replaced",
    metadata: {},
  });


  redirect("/dashboard?password_changed=1");
}