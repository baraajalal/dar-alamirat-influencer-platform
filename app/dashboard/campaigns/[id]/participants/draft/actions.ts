"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function ids(formData: FormData, key: string) {
  return Array.from(new Set(formData.getAll(key).map((value) => String(value).trim()).filter(Boolean)));
}

function errorCode(message?: string) {
  const value = String(message ?? "");
  if (value.includes("INFLUENCER_BLACKLISTED")) return "blacklisted";
  if (value.includes("PORTAL_ACTIVATION_REQUIRED")) return "portal_required";
  if (value.includes("ORDER_NUMBER_REQUIRED")) return "order_required";
  if (value.includes("AMOUNT_REQUIRED")) return "amount_required";
  if (value.includes("BRANCH_REQUIRED")) return "branch_required";
  if (value.includes("SOCIAL_ACCOUNT_REQUIRED")) return "social_required";
  if (value.includes("ALREADY_ASSIGNED")) return "already_assigned";
  return "save_failed";
}

export async function saveApplicationParticipantDrafts(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const applicationIds = ids(formData, "application_ids");
  if (!campaignId || !applicationIds.length) {
    redirect(`/dashboard/campaigns/${campaignId}/applications/review?error=no_selection`);
  }
  const { supabase } = await requirePermission("campaigns", "update");
  const { error } = await supabase.rpc("save_campaign_application_drafts", {
    p_campaign_id: campaignId,
    p_application_ids: applicationIds,
  });
  if (error) redirect(`/dashboard/campaigns/${campaignId}/applications/review?error=${errorCode(error.message)}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/applications/review`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/participants/draft`);
  redirect(`/dashboard/campaigns/${campaignId}/participants/draft?saved=1`);
}

export async function saveDirectParticipantDrafts(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const influencerIds = ids(formData, "influencer_ids");
  if (!campaignId || !influencerIds.length) redirect(`/dashboard/campaigns/${campaignId}/participants/draft?error=no_selection`);
  const { supabase } = await requirePermission("campaigns", "update");
  const { error } = await supabase.rpc("save_campaign_direct_drafts", {
    p_campaign_id: campaignId,
    p_influencer_ids: influencerIds,
  });
  if (error) redirect(`/dashboard/campaigns/${campaignId}/participants/draft?error=${errorCode(error.message)}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/participants/draft`);
  redirect(`/dashboard/campaigns/${campaignId}/participants/draft?saved=1`);
}

export async function removeParticipantDraft(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const draftId = field(formData, "draft_id");
  if (!campaignId || !draftId) redirect(`/dashboard/campaigns/${campaignId}/participants/draft?error=invalid_draft`);
  const { supabase } = await requirePermission("campaigns", "update");
  const { error } = await supabase.rpc("remove_campaign_participant_draft", { p_draft_id: draftId });
  if (error) redirect(`/dashboard/campaigns/${campaignId}/participants/draft?error=save_failed`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/participants/draft`);
  redirect(`/dashboard/campaigns/${campaignId}/participants/draft?removed=1`);
}

export async function createAssignmentFromParticipantDraft(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const draftId = field(formData, "draft_id");
  const mode = field(formData, "mode");
  const amountRaw = field(formData, "amount");
  const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : null;
  if (!campaignId || !draftId || !["pr", "paid", "pr_paid", "attendance", "content"].includes(mode)) {
    redirect(`/dashboard/campaigns/${campaignId}/participants/draft/${draftId}?error=invalid_input`);
  }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    redirect(`/dashboard/campaigns/${campaignId}/participants/draft/${draftId}?error=amount_required`);
  }
  const { supabase } = await requirePermission("campaigns", "update");
  const attendanceRaw = field(formData, "attendance_at");
  const attendanceAt = attendanceRaw ? new Date(`${attendanceRaw}:00+03:00`).toISOString() : null;
  const { data, error } = await supabase.rpc("create_assignment_from_participant_draft", {
    p_draft_id: draftId,
    p_mode: mode,
    p_order_number: field(formData, "order_number") || null,
    p_amount: amount,
    p_branch_name: field(formData, "branch_name") || null,
    p_attendance_at: attendanceAt,
    p_social_account_id: field(formData, "social_account_id") || null,
    p_content_type: field(formData, "content_type") || null,
    p_requires_content: formData.get("requires_content") === "on",
    p_notes: field(formData, "notes") || null,
  });
  if (error) redirect(`/dashboard/campaigns/${campaignId}/participants/draft/${draftId}?error=${errorCode(error.message)}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/participants/draft`);
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(`/dashboard/campaigns/${campaignId}/influencers/${String(data)}?created=1`);
}
