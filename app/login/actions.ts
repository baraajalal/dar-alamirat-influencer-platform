"use server";

import { redirect } from "next/navigation";
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

  if (profile.role === "influencer") redirect("/influencer/dashboard");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
