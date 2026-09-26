"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function approveArchiveMatch(formData: FormData) {
  const submissionId = value(formData, "submission_id");
  const influencerId = value(formData, "influencer_id");
  if (!submissionId || !influencerId) redirect("/dashboard/match-requests?error=missing_data");

  const { supabase } = await requireRole(["admin"]);
  const { data: canonicalId, error } = await supabase.rpc("apply_registration_submission", {
    p_submission_id: submissionId,
    p_existing_influencer_id: influencerId,
  });

  if (error || !canonicalId) {
    redirect(`/dashboard/match-requests/${submissionId}?error=match_failed`);
  }

  const { data: request } = await supabase
    .from("portal_access_requests")
    .select("id")
    .eq("registration_submission_id", submissionId)
    .maybeSingle();

  revalidatePath("/dashboard/match-requests");
  revalidatePath("/dashboard/access-requests");
  revalidatePath("/dashboard/influencers");
  revalidatePath(`/dashboard/influencers/${canonicalId}`);

  if (request?.id) redirect(`/dashboard/access-requests/${request.id}?match_resolved=1`);
  redirect(`/dashboard/match-requests?resolved=1`);
}

export async function createAsNewInfluencer(formData: FormData) {
  const submissionId = value(formData, "submission_id");
  if (!submissionId) redirect("/dashboard/match-requests?error=missing_data");

  const { supabase } = await requireRole(["admin"]);
  const { data: canonicalId, error } = await supabase.rpc("apply_registration_submission", {
    p_submission_id: submissionId,
    p_existing_influencer_id: null,
  });

  if (error || !canonicalId) {
    const code = error?.message?.includes("MOBILE_CONFLICT_REQUIRES_MATCH")
      ? "mobile_conflict"
      : "create_failed";
    redirect(`/dashboard/match-requests/${submissionId}?error=${code}`);
  }

  const { data: request } = await supabase
    .from("portal_access_requests")
    .select("id")
    .eq("registration_submission_id", submissionId)
    .maybeSingle();

  revalidatePath("/dashboard/match-requests");
  revalidatePath("/dashboard/access-requests");
  revalidatePath("/dashboard/influencers");

  if (request?.id) redirect(`/dashboard/access-requests/${request.id}?new_identity=1`);
  redirect(`/dashboard/match-requests?resolved=1`);
}
