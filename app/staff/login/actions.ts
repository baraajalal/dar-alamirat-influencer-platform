"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function staffLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/staff/login?error=missing_credentials");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/staff/login?error=invalid_credentials");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_active,invitation_status")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role === "influencer") {
    await supabase.auth.signOut();
    redirect("/staff/login?error=not_staff");
  }

  if (!profile.is_active || profile.invitation_status === "disabled") {
    await supabase.auth.signOut();
    redirect("/staff/login?error=account_disabled");
  }

  if (data.user.app_metadata?.must_change_password === true) {
    redirect("/staff/change-password");
  }

  if (profile.invitation_status === "pending") {
    await supabase.auth.signOut();
    redirect("/staff/login?error=temporary_password_required");
  }

  redirect("/dashboard");
}
