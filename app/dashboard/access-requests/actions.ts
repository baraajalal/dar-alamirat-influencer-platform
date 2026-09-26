"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";
import { generatePortalToken, portalTokenExpiry } from "@/lib/portal-access/tokens";
import { PORTAL_ACCESS_STATUS } from "@/lib/domain/portal-access";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function revokeTokens(admin: ReturnType<typeof createAdminClient>, requestId: string) {
  await admin
    .from("portal_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .is("used_at", null)
    .is("revoked_at", null);
}

export async function startPortalAccessReview(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");

  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("portal_access_requests")
    .update({
      status: PORTAL_ACCESS_STATUS.underReview,
      review_started_at: now,
      reviewed_by: user.id,
      reviewed_at: null,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", PORTAL_ACCESS_STATUS.submitted)
    .select("id,influencer_id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/dashboard/access-requests/${requestId}?error=request_closed`);
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "influencer",
    entity_id: data.influencer_id,
    action: "portal_access_review_started",
    metadata: { request_id: requestId },
  });

  revalidatePath("/dashboard/access-requests");
  revalidatePath(`/dashboard/access-requests/${requestId}`);
  redirect(`/dashboard/access-requests/${requestId}?success=review_started`);
}

export async function approvePortalAccess(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");

  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("portal_access_requests")
    .select("id,influencer_id,status,influencers(id,user_id)")
    .eq("id", requestId)
    .single();

  if (!request) redirect("/dashboard/access-requests?error=request_not_found");
  const influencer = Array.isArray(request.influencers) ? request.influencers[0] : request.influencers;
  if (!influencer) redirect("/dashboard/access-requests?error=influencer_not_found");
  if (influencer.user_id) redirect(`/dashboard/access-requests/${requestId}?error=already_linked`);
  if (
    request.status !== PORTAL_ACCESS_STATUS.underReview &&
    request.status !== PORTAL_ACCESS_STATUS.approved
  ) {
    redirect(`/dashboard/access-requests/${requestId}?error=request_closed`);
  }

  const now = new Date().toISOString();
  const { token, tokenHash } = generatePortalToken();
  await revokeTokens(admin, requestId);

  const { error: tokenError } = await admin.from("portal_access_tokens").insert({
    request_id: requestId,
    purpose: "activation",
    token_hash: tokenHash,
    expires_at: portalTokenExpiry(72),
    created_by: user.id,
  });
  if (tokenError) redirect(`/dashboard/access-requests/${requestId}?error=token_failed`);

  const { error } = await admin
    .from("portal_access_requests")
    .update({
      status: PORTAL_ACCESS_STATUS.approved,
      reviewed_by: user.id,
      reviewed_at: now,
      review_notes: "Approved. Activation link generated without email.",
      updated_at: now,
    })
    .eq("id", requestId);
  if (error) redirect(`/dashboard/access-requests/${requestId}?error=approve_failed`);

  await admin
    .from("influencers")
    .update({
      account_status: "pending_review",
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", request.influencer_id)
    .is("user_id", null);

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "influencer",
    entity_id: request.influencer_id,
    action: "portal_access_approved",
    metadata: { request_id: requestId, delivery: "manual_link" },
  });

  revalidatePath("/dashboard/access-requests");
  revalidatePath(`/dashboard/access-requests/${requestId}`);
  const link = `${appBaseUrl()}/portal/access/activate?token=${encodeURIComponent(token)}`;
  redirect(`/dashboard/access-requests/${requestId}?success=approved&link=${encodeURIComponent(link)}`);
}

export async function requestPortalChanges(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!requestId || !notes) redirect(`/dashboard/access-requests/${requestId}?error=notes_required`);

  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("portal_access_requests")
    .select("id,influencer_id,status")
    .eq("id", requestId)
    .single();
  if (!request || request.status !== PORTAL_ACCESS_STATUS.underReview) {
    redirect(`/dashboard/access-requests/${requestId}?error=request_closed`);
  }

  const { token, tokenHash } = generatePortalToken();
  await revokeTokens(admin, requestId);
  const { error: tokenError } = await admin.from("portal_access_tokens").insert({
    request_id: requestId,
    purpose: "edit",
    token_hash: tokenHash,
    expires_at: portalTokenExpiry(72),
    created_by: user.id,
  });
  if (tokenError) redirect(`/dashboard/access-requests/${requestId}?error=token_failed`);

  const now = new Date().toISOString();
  const { error } = await admin
    .from("portal_access_requests")
    .update({ status: PORTAL_ACCESS_STATUS.needsChanges, reviewed_by: user.id, reviewed_at: now, review_notes: notes, updated_at: now })
    .eq("id", requestId)
    .eq("status", PORTAL_ACCESS_STATUS.underReview);
  if (error) redirect(`/dashboard/access-requests/${requestId}?error=changes_failed`);

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "influencer",
    entity_id: request.influencer_id,
    action: "portal_access_changes_requested",
    metadata: { request_id: requestId, notes },
  });

  revalidatePath("/dashboard/access-requests");
  revalidatePath(`/dashboard/access-requests/${requestId}`);
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
  const now = new Date().toISOString();

  const { data: request, error } = await admin
    .from("portal_access_requests")
    .update({ status: PORTAL_ACCESS_STATUS.rejected, reviewed_by: user.id, reviewed_at: now, review_notes: notes, updated_at: now })
    .eq("id", requestId)
    .eq("status", PORTAL_ACCESS_STATUS.underReview)
    .select("id,influencer_id")
    .maybeSingle();
  if (error || !request) redirect(`/dashboard/access-requests/${requestId}?error=reject_failed`);

  await admin
    .from("influencers")
    .update({ account_status: "rejected", updated_at: now })
    .eq("id", request.influencer_id)
    .is("user_id", null);

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "influencer",
    entity_id: request.influencer_id,
    action: "portal_access_rejected",
    metadata: { request_id: requestId, notes },
  });

  revalidatePath("/dashboard/access-requests");
  revalidatePath(`/dashboard/access-requests/${requestId}`);
  redirect(`/dashboard/access-requests/${requestId}?success=rejected`);
}
