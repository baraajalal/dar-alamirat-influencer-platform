"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function splitLinks(value: string) {
  return Array.from(new Set(value.split(/[\n,،]+/).map((item) => item.trim()).filter(Boolean)));
}

function validHttpUrls(values: string[]) {
  return values.every((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
}

export async function updateOpportunitySettings(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const parsed = z.object({
    visibility: z.enum(["hidden", "invite_only", "community"]),
    type: z.enum(["pr", "paid", "product", "voucher", "hybrid", "other"]).optional().or(z.literal("")),
    summary: z.string().max(4000).optional().default(""),
    goal: z.string().max(4000).optional().default(""),
    requirements: z.string().max(4000).optional().default(""),
    imageUrls: z.string().max(12000).optional().default(""),
    compensationMode: z.enum(["none", "fixed", "range", "negotiable"]),
    compensationAmount: z.string().optional().default(""),
    compensationMaxAmount: z.string().optional().default(""),
    compensationCurrency: z.string().trim().min(3).max(8).default("SAR"),
    compensationNotes: z.string().max(4000).optional().default(""),
    openAt: z.string().optional().default(""),
    closeAt: z.string().optional().default(""),
    maxApplications: z.string().optional().default(""),
    maxParticipants: z.string().optional().default(""),
  }).safeParse({
    visibility: field(formData, "portal_visibility"),
    type: field(formData, "opportunity_type"),
    summary: field(formData, "opportunity_summary"),
    goal: field(formData, "opportunity_goal"),
    requirements: field(formData, "application_requirements"),
    imageUrls: field(formData, "opportunity_image_urls"),
    compensationMode: field(formData, "public_compensation_mode") || "none",
    compensationAmount: field(formData, "public_compensation_amount"),
    compensationMaxAmount: field(formData, "public_compensation_max_amount"),
    compensationCurrency: (field(formData, "public_compensation_currency") || "SAR").toUpperCase(),
    compensationNotes: field(formData, "public_compensation_notes"),
    openAt: field(formData, "applications_open_at"),
    closeAt: field(formData, "applications_close_at"),
    maxApplications: field(formData, "max_applications"),
    maxParticipants: field(formData, "max_participants"),
  });

  if (!campaignId || !parsed.success) redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_settings`);
  const v = parsed.data;
  const openAt = v.openAt ? new Date(`${v.openAt}:00+03:00`).toISOString() : null;
  const closeAt = v.closeAt ? new Date(`${v.closeAt}:00+03:00`).toISOString() : null;
  if (openAt && closeAt && closeAt < openAt) redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_window`);

  const maxApplications = v.maxApplications ? Number(v.maxApplications) : null;
  const maxParticipants = v.maxParticipants ? Number(v.maxParticipants) : null;
  if ((maxApplications !== null && (!Number.isInteger(maxApplications) || maxApplications <= 0)) || (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants <= 0))) {
    redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_limits`);
  }

  const amount = v.compensationAmount ? Number(v.compensationAmount.replace(/,/g, "")) : null;
  const maxAmount = v.compensationMaxAmount ? Number(v.compensationMaxAmount.replace(/,/g, "")) : null;
  if ((amount !== null && (!Number.isFinite(amount) || amount < 0)) || (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount < 0))) {
    redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_compensation`);
  }
  if (v.compensationMode === "fixed" && amount === null) redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_compensation`);
  if (v.compensationMode === "range" && (amount === null || maxAmount === null || maxAmount < amount)) redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_compensation`);
  if (["paid", "hybrid"].includes(v.type || "") && v.compensationMode === "none") redirect(`/dashboard/campaigns/${campaignId}/applications?error=paid_compensation_required`);

  const imageUrls = splitLinks(v.imageUrls);
  if (imageUrls.length > 12 || !validHttpUrls(imageUrls)) redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_images`);

  const { profile, supabase } = await requirePermission("campaigns", "update");
  const { error } = await supabase.from("campaigns").update({
    portal_visibility: v.visibility,
    opportunity_type: v.type || null,
    opportunity_summary: v.summary || null,
    opportunity_goal: v.goal || null,
    application_requirements: v.requirements || null,
    opportunity_image_urls: imageUrls,
    public_compensation_mode: v.compensationMode,
    public_compensation_amount: v.compensationMode === "fixed" || v.compensationMode === "range" ? amount : null,
    public_compensation_max_amount: v.compensationMode === "range" ? maxAmount : null,
    public_compensation_currency: v.compensationCurrency,
    public_compensation_notes: v.compensationNotes || null,
    require_campaign_terms_acceptance: formData.get("require_campaign_terms_acceptance") === "on",
    applications_open_at: openAt,
    applications_close_at: closeAt,
    max_applications: maxApplications,
    max_participants: maxParticipants,
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);
  if (error) redirect(`/dashboard/campaigns/${campaignId}/applications?error=save_failed`);

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: "campaign_opportunity_updated",
    metadata: {
      portal_visibility: v.visibility,
      opportunity_type: v.type || null,
      compensation_mode: v.compensationMode,
      compensation_amount: amount,
      compensation_max_amount: maxAmount,
      compensation_currency: v.compensationCurrency,
      public_images_count: imageUrls.length,
    },
  });
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/applications`);
  revalidatePath("/portal/campaigns");
  redirect(`/dashboard/campaigns/${campaignId}/applications?saved=1`);
}

export async function reviewApplication(formData: FormData) {
  const campaignId = field(formData, "campaign_id");
  const applicationId = field(formData, "application_id");
  const decision = field(formData, "decision");
  const reason = field(formData, "reason");
  if (!campaignId || !applicationId || !["shortlisted", "accepted", "rejected"].includes(decision)) {
    redirect(`/dashboard/campaigns/${campaignId}/applications?error=invalid_decision`);
  }
  if (decision === "rejected" && !reason) {
    redirect(`/dashboard/campaigns/${campaignId}/applications?error=rejection_reason_required`);
  }

  const { supabase } = await requirePermission("campaigns", "update");
  const { data, error } = await supabase.rpc("review_campaign_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_reason: reason || null,
  });
  if (error) {
    const msg = String(error.message || "");
    const code = msg.includes("PARTICIPANT_LIMIT_REACHED")
      ? "participant_limit"
      : msg.includes("INFLUENCER_UNAVAILABLE")
        ? "influencer_unavailable"
        : msg.includes("REJECTION_REASON_REQUIRED")
          ? "rejection_reason_required"
          : "review_failed";
    redirect(`/dashboard/campaigns/${campaignId}/applications?error=${code}`);
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/applications`);
  revalidatePath("/portal/campaigns");
  const assignment = typeof data === "string" && data ? `&assignment=${encodeURIComponent(data)}` : "";
  redirect(`/dashboard/campaigns/${campaignId}/applications?reviewed=1${assignment}`);
}
