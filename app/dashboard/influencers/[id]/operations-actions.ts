"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function appBaseUrl() { return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""); }
function validEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

export async function setInfluencerRestriction(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  const status = value(formData, "restriction_status");
  const reason = value(formData, "reason");
  const expiresAtRaw = value(formData, "expires_at");
  if (!influencerId || !["normal","watchlist","blacklisted"].includes(status)) redirect(`/dashboard/influencers/${influencerId}?restriction_error=invalid`);
  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("set_influencer_restriction", {
    p_influencer_id: influencerId,
    p_status: status,
    p_reason: reason || null,
    p_expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
  });
  if (error) {
    const code = String(error.message).includes("REASON_REQUIRED") ? "reason_required" : "failed";
    redirect(`/dashboard/influencers/${influencerId}?restriction_error=${code}`);
  }
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  revalidatePath("/dashboard/influencers");
  redirect(`/dashboard/influencers/${influencerId}?restriction_saved=1`);
}

async function linkedPortalAccount(influencerId: string) {
  const admin = createAdminClient();
  const { data: influencer } = await admin.from("influencers").select("id,user_id,email,full_name").eq("id", influencerId).maybeSingle();
  if (!influencer?.user_id) return { admin, influencer: null, user: null };
  const { data } = await admin.auth.admin.getUserById(influencer.user_id);
  return { admin, influencer, user: data.user ?? null };
}

export async function updateInfluencerPortalEmail(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  const email = value(formData, "email").toLowerCase();
  if (!influencerId || !validEmail(email)) redirect(`/dashboard/influencers/${influencerId}?portal_error=invalid_email`);
  const { user: actor } = await requireRole(["admin"]);
  const { admin, influencer, user } = await linkedPortalAccount(influencerId);
  if (!influencer || !user) redirect(`/dashboard/influencers/${influencerId}?portal_error=no_account`);
  const { error } = await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true });
  if (error) redirect(`/dashboard/influencers/${influencerId}?portal_error=failed`);
  const now = new Date().toISOString();
  // Portal login email is an authentication concern. Do not overwrite the creator's
  // profile/contact email just because the login address was corrected.
  await Promise.all([
    admin.from("profiles").update({ email, updated_at: now }).eq("id", user.id),
    admin.from("activity_logs").insert({ actor_id: actor.id, entity_type: "influencer", entity_id: influencerId, action: "portal_login_email_corrected", metadata: { email } }),
  ]);
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  redirect(`/dashboard/influencers/${influencerId}?portal_saved=email`);
}

async function sendRecoveryEmail(influencerId: string, action: string) {
  const { user: actor } = await requireRole(["admin"]);
  const { admin, influencer, user } = await linkedPortalAccount(influencerId);
  if (!influencer || !user) redirect(`/dashboard/influencers/${influencerId}?portal_error=no_account`);
  const email = String(user.email || influencer.email || "").trim();
  if (!validEmail(email)) redirect(`/dashboard/influencers/${influencerId}?portal_error=invalid_email`);
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${appBaseUrl()}/portal/set-password` });
  if (error) redirect(`/dashboard/influencers/${influencerId}?portal_error=failed`);
  await admin.from("activity_logs").insert({ actor_id: actor.id, entity_type: "influencer", entity_id: influencerId, action, metadata: { delivery: "email", email } });
  revalidatePath(`/dashboard/influencers/${influencerId}`);
}

export async function sendInfluencerPasswordRecovery(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  if (!influencerId) redirect("/dashboard/influencers");
  await sendRecoveryEmail(influencerId, "portal_password_recovery_sent");
  redirect(`/dashboard/influencers/${influencerId}?portal_saved=recovery`);
}

export async function resendInfluencerPortalAccess(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  if (!influencerId) redirect("/dashboard/influencers");
  await sendRecoveryEmail(influencerId, "portal_access_email_resent");
  redirect(`/dashboard/influencers/${influencerId}?portal_saved=access`);
}

export async function setInfluencerPortalAccountState(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  const state = value(formData, "portal_state");
  const reason = value(formData, "reason");
  if (!influencerId || !["active","suspended"].includes(state)) redirect(`/dashboard/influencers/${influencerId}?portal_error=failed`);
  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("set_influencer_portal_account_state", { p_influencer_id: influencerId, p_state: state, p_reason: reason || null });
  if (error) redirect(`/dashboard/influencers/${influencerId}?portal_error=failed`);
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  redirect(`/dashboard/influencers/${influencerId}?portal_saved=${state}`);
}
