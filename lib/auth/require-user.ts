import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "influencer" | "coordinator" | "finance" | "admin";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_not_found");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=account_disabled");
  }

  return { user, profile, supabase };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireUser();

  if (!allowedRoles.includes(session.profile.role as UserRole)) {
    redirect("/unauthorized");
  }

  return session;
}
