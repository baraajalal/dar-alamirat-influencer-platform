"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";
import { generatePortalToken, portalTokenExpiry } from "@/lib/portal-access/tokens";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function revokeTokens(admin: ReturnType<typeof createAdminClient>, requestId: string) {
  await admin.from("portal_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("request_id", requestId).is("used_at", null).is("revoked_at", null);
}

export async function approvePortalAccess(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");
  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const { data: request } = await admin.from("portal_access_requests").select("id,influencer_id,status,influencers(id,user_id)").eq("id", requestId).single();
  if (!request) redirect("/dashboard/access-requests?error=request_not_found");
  const influencer = Array.isArray(request.influencers) ? request.influencers[0] : request.influencers;
  if (!influencer) redirect("/dashboard/access-requests?error=influencer_not_found");
  if (influencer.user_id) redirect(`/dashboard/access-requests/${requestId}?error=already_linked`);
  if (!["pending", "approved"].includes(request.status)) redirect(`/dashboard/access-requests/${requestId}?error=request_closed`);

  const now = new Date().toISOString();
  const { token, tokenHash } = generatePortalToken();
  await revokeTokens(admin, requestId);
  const { error: tokenError } = await admin.from("portal_access_tokens").insert({ request_id: requestId, purpose: "activation", token_hash: tokenHash, expires_at: portalTokenExpiry(72), created_by: user.id });
  if (tokenError) redirect(`/dashboard/access-requests/${requestId}?error=token_failed`);
  const { error } = await admin.from("portal_access_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now, review_notes: "Approved. Activation link generated without email.", updated_at: now }).eq("id", requestId);
  if (error) redirect(`/dashboard/access-requests/${requestId}?error=approve_failed`);
  await admin.from("activity_logs").insert({ actor_id: user.id, entity_type: "influencer", entity_id: request.influencer_id, action: "portal_access_approved", metadata: { request_id: requestId, delivery: "manual_link" } });
  revalidatePath("/dashboard/access-requests"); revalidatePath(`/dashboard/access-requests/${requestId}`);
  const link = `${appBaseUrl()}/portal/access/activate?token=${encodeURIComponent(token)}`;
  redirect(`/dashboard/access-requests/${requestId}?success=approved&link=${encodeURIComponent(link)}`);
}

export async function requestPortalChanges(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!requestId || !notes) redirect(`/dashboard/access-requests/${requestId}?error=notes_required`);
  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const { data: request } = await admin.from("portal_access_requests").select("id,influencer_id,status").eq("id", requestId).single();
  if (!request || !["pending", "needs_changes"].includes(request.status)) redirect(`/dashboard/access-requests/${requestId}?error=request_closed`);
  const { token, tokenHash } = generatePortalToken();
  await revokeTokens(admin, requestId);
  const { error: tokenError } = await admin.from("portal_access_tokens").insert({ request_id: requestId, purpose: "edit", token_hash: tokenHash, expires_at: portalTokenExpiry(72), created_by: user.id });
  if (tokenError) redirect(`/dashboard/access-requests/${requestId}?error=token_failed`);
  const now = new Date().toISOString();
  const { error } = await admin.from("portal_access_requests").update({ status: "needs_changes", reviewed_by: user.id, reviewed_at: now, review_notes: notes, updated_at: now }).eq("id", requestId);
  if (error) redirect(`/dashboard/access-requests/${requestId}?error=changes_failed`);
  await admin.from("activity_logs").insert({ actor_id: user.id, entity_type: "influencer", entity_id: request.influencer_id, action: "portal_access_changes_requested", metadata: { request_id: requestId, notes } });
  revalidatePath("/dashboard/access-requests"); revalidatePath(`/dashboard/access-requests/${requestId}`);
  const link = `${appBaseUrl()}/portal/access/edit?token=${encodeURIComponent(token)}`;
  redirect(`/dashboard/access-requests/${requestId}?success=changes&link=${encodeURIComponent(link)}`);
}

export async function rejectPortalAccess(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || "Rejected by admin.";
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");
  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  await revokeTokens(admin, requestId);
  const { error } = await admin.from("portal_access_requests").update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_notes: notes }).eq("id", requestId).in("status", ["pending", "needs_changes"]);
  if (error) redirect(`/dashboard/access-requests/${requestId}?error=reject_failed`);
  revalidatePath("/dashboard/access-requests"); revalidatePath(`/dashboard/access-requests/${requestId}`);
  redirect(`/dashboard/access-requests/${requestId}?success=rejected`);
}
