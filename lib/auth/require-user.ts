import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { hasPermission, type AppRole, type PermissionAction, type PermissionResource } from "@/lib/auth/permissions";

export type UserRole = AppRole;

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

  if (profile.role !== "influencer" && user.app_metadata?.must_change_password === true) {
    redirect("/staff/change-password");
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

export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction = "view",
) {
  const session = await requireUser();

  if (!hasPermission(session.profile.role, resource, action)) {
    redirect("/unauthorized");
  }

  return session;
}
