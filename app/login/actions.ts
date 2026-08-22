"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) redirect("/login?error=missing_credentials");

  const supabase = await createClient();
  const admin = createAdminClient();

  let email = identifier.toLowerCase();
  if (!identifier.includes("@")) {
    const digits = identifier.replace(/\D/g, "");
    const mobileCandidates = new Set<string>();

    if (digits.startsWith("966") && digits.length >= 12) mobileCandidates.add(`+${digits}`);
    if (digits.startsWith("05") && digits.length === 10) mobileCandidates.add(`+966${digits.slice(1)}`);
    if (digits.startsWith("5") && digits.length === 9) mobileCandidates.add(`+966${digits}`);
    if (identifier.startsWith("+")) mobileCandidates.add(`+${digits}`);
    mobileCandidates.add(identifier.replace(/\s+/g, ""));

    const { data: influencer } = await admin
      .from("influencers")
      .select("email,mobile_e164,account_status,activation_status")
      .in("mobile_e164", [...mobileCandidates])
      .maybeSingle();

    if (!influencer?.email) redirect("/login?error=invalid_credentials");
    email = influencer.email.trim().toLowerCase();
  }

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

  // Creator portal is intentionally isolated from staff accounts.
  // Any employee/admin/coordinator/finance account must use /staff/login.
  if (profile.role !== "influencer") {
    await supabase.auth.signOut();
    redirect("/login?error=staff_account_use_staff_login");
  }

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

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
