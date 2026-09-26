"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { PORTAL_ACCESS_OPEN_STATUSES } from "@/lib/domain/portal-access";

/**
 * Legacy entry point retained only to prevent old clients/bookmarks from
 * bypassing the canonical portal-access review workflow.
 */
export async function reviewInfluencerRegistration(formData: FormData) {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) redirect("/dashboard/influencers");

  const { supabase } = await requireRole(["admin", "coordinator"]);
  const { data: request } = await supabase
    .from("portal_access_requests")
    .select("id")
    .eq("influencer_id", influencerId)
    .in("status", PORTAL_ACCESS_OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (request?.id) {
    redirect(`/dashboard/access-requests/${request.id}`);
  }

  redirect(`/dashboard/influencers/${influencerId}?error=no_access_request`);
}
