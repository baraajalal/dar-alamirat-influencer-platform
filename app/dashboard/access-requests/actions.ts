"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function approvePortalAccess(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");

  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();

  const { data: request, error: requestError } = await admin
    .from("portal_access_requests")
    .select(
      "id,influencer_id,requested_email,status,influencers(id,user_id,full_name,mobile_e164,email)",
    )
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    redirect("/dashboard/access-requests?error=request_not_found");
  }

  if (!["pending", "approved"].includes(request.status)) {
    redirect("/dashboard/access-requests?error=request_closed");
  }

  const influencer = Array.isArray(request.influencers)
    ? request.influencers[0]
    : request.influencers;

  if (!influencer) {
    redirect("/dashboard/access-requests?error=influencer_not_found");
  }

  if (influencer.user_id) {
    await admin
      .from("portal_access_requests")
      .update({
        status: "completed",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: "Account already linked.",
      })
      .eq("id", requestId);

    revalidatePath("/dashboard/access-requests");
    redirect("/dashboard/access-requests?success=already_linked");
  }

  const redirectTo = `${appBaseUrl()}/auth/callback?next=/set-password`;

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(request.requested_email, {
      redirectTo,
      data: {
        full_name: influencer.full_name,
        mobile_e164: influencer.mobile_e164,
        role: "influencer",
      },
    });

  if (inviteError || !inviteData.user) {
    const message = inviteError?.message?.toLowerCase() ?? "";
    const code =
      message.includes("already") || message.includes("registered")
        ? "email_exists"
        : "invite_failed";
    redirect(`/dashboard/access-requests?error=${code}`);
  }

  const invitedUserId = inviteData.user.id;

  const { error: linkError } = await admin.rpc(
    "link_influencer_portal_invitation",
    {
      p_request_id: requestId,
      p_influencer_id: influencer.id,
      p_user_id: invitedUserId,
      p_approved_by: user.id,
      p_email: request.requested_email,
    },
  );

  if (linkError) {
    console.error("Portal invitation database linking failed:", linkError);
    await admin.auth.admin.deleteUser(invitedUserId);
    redirect("/dashboard/access-requests?error=link_failed");
  }

  revalidatePath("/dashboard/access-requests");
  redirect("/dashboard/access-requests?success=invited");
}

export async function rejectPortalAccess(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) redirect("/dashboard/access-requests?error=missing_request");

  const { user } = await requireRole(["admin"]);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("portal_access_requests")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: now,
      review_notes: "Rejected by admin.",
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) redirect("/dashboard/access-requests?error=reject_failed");

  revalidatePath("/dashboard/access-requests");
  redirect("/dashboard/access-requests?success=rejected");
}
