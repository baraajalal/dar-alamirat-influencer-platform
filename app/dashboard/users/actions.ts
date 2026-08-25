"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const USERS_PATH = "/dashboard/users";
const STAFF_ROLES = ["admin", "coordinator", "finance", "reviewer", "viewer"] as const;

const createStaffSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(STAFF_ROLES),
});


const temporaryPasswordSchema = z.object({
  userId: z.string().uuid(),
  temporaryPassword: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => /[a-z]/.test(value), "lower")
    .refine((value) => /[A-Z]/.test(value), "upper")
    .refine((value) => /[0-9]/.test(value), "digit")
    .refine((value) => /[^A-Za-z0-9]/.test(value), "symbol"),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(120),
  role: z.enum(STAFF_ROLES),
});

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function go(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`${USERS_PATH}?${query.toString()}`);
}

export async function createStaffUser(formData: FormData) {
  const parsed = createStaffSchema.safeParse({
    fullName: field(formData, "full_name"),
    email: field(formData, "email"),
    role: field(formData, "role"),
  });

  if (!parsed.success) go({ error: "invalid_fields" });

  const { user: actor, profile: actorProfile } = await requirePermission("users", "create");
  if (actorProfile.role !== "admin") go({ error: "admin_only" });

  const admin = createAdminClient();
  const input = parsed.data;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();

  if (existingProfile) go({ error: "email_exists" });

  // Create the Auth user directly. This does NOT send an invitation or
  // confirmation email. The account intentionally has no password yet;
  // the admin sets a temporary password from the users table afterwards.
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      account_type: "staff",
    },
    app_metadata: {
      account_type: "staff",
    },
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      go({ error: "email_exists" });
    }
    console.error("STAFF_CREATE_FAILED", error);
    go({ error: "create_failed" });
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
      last_invitation_at: null,
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
    action: "staff_user_created",
    metadata: { email: input.email, role: input.role },
  });

  revalidatePath(USERS_PATH);
  go({ success: "created" });
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
  const { data: currentProfile, error: currentProfileError } = await admin
    .from("profiles")
    .select("id,is_active,invitation_status")
    .eq("id", userId)
    .neq("role", "influencer")
    .maybeSingle();

  if (currentProfileError || !currentProfile) go({ error: "invalid_user" });

  const now = new Date().toISOString();
  const nextInvitationStatus = enable && currentProfile.invitation_status === "disabled"
    ? "active"
    : currentProfile.invitation_status;

  const { error } = await admin
    .from("profiles")
    .update({
      is_active: enable,
      // is_active is the source of truth for suspension. Keeping the
      // onboarding status preserves "pending" when an account is disabled
      // before a temporary password has been assigned.
      invitation_status: nextInvitationStatus,
      updated_at: now,
    })
    .eq("id", userId)
    .neq("role", "influencer");

  if (error) {
    console.error("STAFF_USER_TOGGLE_FAILED", error);
    go({ error: "toggle_failed" });
  }

  const { error: authToggleError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enable ? "none" : "876000h",
  });

  if (authToggleError) {
    console.error("STAFF_USER_AUTH_TOGGLE_FAILED", authToggleError);
    await admin
      .from("profiles")
      .update({
        is_active: currentProfile.is_active,
        invitation_status: currentProfile.invitation_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    go({ error: "toggle_failed" });
  }

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


export async function setTemporaryStaffPassword(formData: FormData) {
  const parsed = temporaryPasswordSchema.safeParse({
    userId: field(formData, "user_id"),
    temporaryPassword: String(formData.get("temporary_password") ?? ""),
  });
  if (!parsed.success) go({ error: "temporary_password_invalid" });

  const { user: actor, profile: actorProfile } = await requirePermission("users", "manage");
  if (actorProfile.role !== "admin") go({ error: "admin_only" });

  const admin = createAdminClient();
  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", parsed.data.userId)
    .neq("role", "influencer")
    .maybeSingle();

  if (profileLookupError || !profile) go({ error: "invalid_user" });
  if (!profile.is_active) go({ error: "user_disabled" });

  const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(parsed.data.userId);
  if (authLookupError || !authResult.user) {
    console.error("STAFF_TEMP_PASSWORD_USER_LOOKUP_FAILED", authLookupError);
    go({ error: "temporary_password_failed" });
  }

  const existingAppMetadata = authResult.user.app_metadata ?? {};
  const { error: passwordError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.temporaryPassword,
    email_confirm: true,
    app_metadata: {
      ...existingAppMetadata,
      must_change_password: true,
      temporary_password_set_at: new Date().toISOString(),
      temporary_password_set_by: actor.id,
    },
  });

  if (passwordError) {
    console.error("STAFF_TEMP_PASSWORD_UPDATE_FAILED", passwordError);
    go({ error: "temporary_password_failed" });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ invitation_status: "active", updated_at: now })
    .eq("id", parsed.data.userId);

  if (profileError) {
    console.error("STAFF_TEMP_PASSWORD_PROFILE_UPDATE_FAILED", profileError);
    go({ error: "temporary_password_profile_failed" });
  }

  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    entity_type: "profile",
    entity_id: parsed.data.userId,
    action: "staff_temporary_password_set",
    metadata: { email: profile.email, role: profile.role },
  });

  revalidatePath(USERS_PATH);
  go({ success: "temporary_password_set" });
}
