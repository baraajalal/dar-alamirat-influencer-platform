"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=missing_credentials");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) redirect("/login?error=invalid_credentials");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_not_found");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=account_disabled");
  }

  if (profile.role === "influencer") {
    const admin = createAdminClient();
    const { data: influencer } = await admin
      .from("influencers")
      .select("id,must_change_password")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!influencer) {
      await supabase.auth.signOut();
      redirect("/login?error=profile_not_found");
    }

    await admin
      .from("influencers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", influencer.id);

    if (influencer.must_change_password) {
      redirect("/portal/set-password");
    }

    redirect("/portal/dashboard");
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
