"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const USERS_PATH = "/dashboard/users";
const STAFF_ROLES = ["admin", "coordinator", "finance", "reviewer", "viewer"] as const;

const inviteSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(STAFF_ROLES),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(120),
  role: z.enum(STAFF_ROLES),
});

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function go(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`${USERS_PATH}?${query.toString()}`);
}

export async function inviteStaffUser(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    fullName: field(formData, "full_name"),
    email: field(formData, "email"),
    role: field(formData, "role"),
  });

  if (!parsed.success) go({ error: "invalid_fields" });

  const { user: actor } = await requirePermission("users", "create");
  const admin = createAdminClient();
  const input = parsed.data;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();

  if (existingProfile) go({ error: "email_exists" });

  const redirectTo = `${appBaseUrl()}/auth/callback?account_type=staff&next=/staff/set-password`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo,
    data: {
      full_name: input.fullName,
      role: input.role,
      account_type: "staff",
    },
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      go({ error: "email_exists" });
    }
    console.error("STAFF_INVITE_FAILED", error);
    go({ error: "invite_failed" });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      is_active: true,
      invited_at: now,
      invited_by: actor.id,
      last_invitation_at: now,
      invitation_status: "pending",
      updated_at: now,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("STAFF_PROFILE_CREATE_FAILED", profileError);
    await admin.auth.admin.deleteUser(data.user.id);
    go({ error: "profile_failed" });
  }

  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    entity_type: "profile",
    entity_id: data.user.id,
    action: "staff_user_invited",
    metadata: { email: input.email, role: input.role },
  });

  revalidatePath(USERS_PATH);
  go({ success: "invited" });
}

export async function resendStaffInvitation(formData: FormData) {
  const userId = field(formData, "user_id");
  if (!z.string().uuid().safeParse(userId).success) go({ error: "invalid_user" });

  const { user: actor } = await requirePermission("users", "update");
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", userId)
    .single();

  if (!profile?.email) go({ error: "email_missing" });
  if (!profile.is_active) go({ error: "user_disabled" });

  const redirectTo = `${appBaseUrl()}/auth/callback?account_type=staff&next=/staff/set-password`;
  const { error } = await admin.auth.resetPasswordForEmail(profile.email, {
    redirectTo,
  });

  if (error) {
    console.error("STAFF_INVITE_RESEND_FAILED", error);
    go({ error: "resend_failed" });
  }

  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ last_invitation_at: now, invitation_status: "pending", updated_at: now })
    .eq("id", userId);

  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    entity_type: "profile",
    entity_id: userId,
    action: "staff_invitation_resent",
    metadata: { email: profile.email },
  });

  revalidatePath(USERS_PATH);
  go({ success: "resent" });
}

export async function updateStaffUser(formData: FormData) {
  const parsed = updateSchema.safeParse({
    userId: field(formData, "user_id"),
    fullName: field(formData, "full_name"),
    role: field(formData, "role"),
  });
  if (!parsed.success) go({ error: "invalid_fields" });

  const { user: actor } = await requirePermission("users", "update");
  if (parsed.data.userId === actor.id && parsed.data.role !== "admin") {
    go({ error: "cannot_demote_self" });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      updated_at: now,
    })
    .eq("id", parsed.data.userId)
    .neq("role", "influencer");

  if (error) {
    console.error("STAFF_USER_UPDATE_FAILED", error);
    go({ error: "update_failed" });
  }

  await admin.auth.admin.updateUserById(parsed.data.userId, {
    user_metadata: { full_name: parsed.data.fullName, role: parsed.data.role },
  });

  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    entity_type: "profile",
    entity_id: parsed.data.userId,
    action: "staff_user_updated",
    metadata: { role: parsed.data.role },
  });

  revalidatePath(USERS_PATH);
  go({ success: "updated" });
}

export async function toggleStaffUser(formData: FormData) {
  const userId = field(formData, "user_id");
  const enable = field(formData, "enable") === "true";
  if (!z.string().uuid().safeParse(userId).success) go({ error: "invalid_user" });

  const { user: actor } = await requirePermission("users", "update");
  if (userId === actor.id && !enable) go({ error: "cannot_disable_self" });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      is_active: enable,
      invitation_status: enable ? "active" : "disabled",
      updated_at: now,
    })
    .eq("id", userId)
    .neq("role", "influencer");

  if (error) {
    console.error("STAFF_USER_TOGGLE_FAILED", error);
    go({ error: "toggle_failed" });
  }

  await admin.auth.admin.updateUserById(userId, {
    ban_duration: enable ? "none" : "876000h",
  });

  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    entity_type: "profile",
    entity_id: userId,
    action: enable ? "staff_user_enabled" : "staff_user_disabled",
    metadata: {},
  });

  revalidatePath(USERS_PATH);
  go({ success: enable ? "enabled" : "disabled" });
}
