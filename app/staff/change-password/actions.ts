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
  const newPassword = String(
    formData.get("new_password") ?? ""
  ).trim();

  const confirmation = String(
    formData.get("confirm_password") ?? ""
  ).trim();


  if (!passwordIsStrong(newPassword)) {
    redirect("/staff/change-password?error=password_weak");
  }


  if (newPassword !== confirmation) {
    redirect("/staff/change-password?error=password_mismatch");
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


  if (user.app_metadata?.must_change_password !== true) {
    redirect("/dashboard");
  }


  // تغيير كلمة المرور
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


  // حذف حالة كلمة المرور المؤقتة
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


  const { error: metadataError } =
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: appMetadata,
    });


  if (metadataError) {
    console.error(
      "STAFF_FORCED_PASSWORD_METADATA_UPDATE_FAILED",
      metadataError
    );

    redirect("/staff/change-password?error=metadata_failed");
  }


  // تحديث حالة الموظف في الجدول
  const now = new Date().toISOString();

  const { error: profileUpdateError } =
    await admin
      .from("profiles")
      .update({
        invitation_status: "active",
        updated_at: now,
      })
      .eq("id", user.id);


  if (profileUpdateError) {
    console.error(
      "STAFF_FORCED_PASSWORD_PROFILE_UPDATE_FAILED",
      profileUpdateError
    );

    redirect("/staff/change-password?error=metadata_failed");
  }


  // تسجيل العملية
  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "profile",
    entity_id: user.id,
    action: "staff_temporary_password_replaced",
    metadata: {},
  });


  // تحديث الجلسة بعد تعديل Auth metadata
  await supabase.auth.refreshSession();


  await new Promise((resolve) =>
    setTimeout(resolve, 500)
  );


  // الدخول للداشبورد
  redirect("/dashboard?password_changed=1");
}