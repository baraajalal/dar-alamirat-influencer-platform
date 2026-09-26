"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createArchiveActivationLink(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  // beta.7.2: archived creators must self-register first. Direct archive activation is intentionally disabled.
  redirect(`/dashboard/influencers/${influencerId || ""}?directory_error=registration_required`);
}

export async function setInfluencerManagementMode(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  const status = value(formData, "directory_status");
  const reason = value(formData, "reason");
  const contactName = value(formData, "managed_contact_name");
  const contactMobile = value(formData, "managed_contact_mobile");
  const contactEmail = value(formData, "managed_contact_email");
  if (!influencerId || !status) redirect("/dashboard/influencers");

  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("set_influencer_management_mode", {
    p_influencer_id: influencerId,
    p_status: status,
    p_reason: reason || null,
    p_contact_name: contactName || null,
    p_contact_mobile: contactMobile || null,
    p_contact_email: contactEmail || null,
  });

  if (error) {
    const code = error.message.includes("REASON_REQUIRED") ? "reason_required" : error.message.includes("ACTIVE_ACCOUNT_CANNOT_BE_ARCHIVED") ? "active_archive_forbidden" : "status_failed";
    redirect(`/dashboard/influencers/${influencerId}?directory_error=${code}`);
  }

  revalidatePath("/dashboard/influencers");
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  redirect(`/dashboard/influencers/${influencerId}?directory_saved=1`);
}

export async function assignInfluencerCoordinator(formData: FormData) {
  const influencerId = value(formData, "influencer_id");
  const coordinatorId = value(formData, "coordinator_id") || null;
  if (!influencerId) redirect("/dashboard/influencers");

  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("assign_influencer_coordinator", {
    p_influencer_id: influencerId,
    p_coordinator_id: coordinatorId,
  });
  if (error) redirect(`/dashboard/influencers/${influencerId}?directory_error=coordinator_failed`);

  revalidatePath("/dashboard/influencers");
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  redirect(`/dashboard/influencers/${influencerId}?directory_saved=1`);
}
