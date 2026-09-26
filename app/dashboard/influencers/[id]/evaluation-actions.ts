"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";

function optionalRating(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : value;
}

const schema = z.object({
  influencerId: z.string().uuid(),
  contentQualityRating: z.preprocess(optionalRating, z.number().int().min(1).max(5).nullable()),
  brandFitRating: z.preprocess(optionalRating, z.number().int().min(1).max(5).nullable()),
  reliabilityRating: z.preprocess(optionalRating, z.number().int().min(1).max(5).nullable()),
  contentQualityNotes: z.string().trim().max(2000).optional().default(""),
  brandFitNotes: z.string().trim().max(2000).optional().default(""),
  reliabilityNotes: z.string().trim().max(2000).optional().default(""),
  finalStatus: z.enum(["qualified", "needs_review", "waitlist", "not_qualified"]).nullable(),
  finalReason: z.string().trim().max(3000).optional().default(""),
});

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveInfluencerEvaluation(formData: FormData) {
  const influencerId = field(formData, "influencer_id");
  const finalStatusRaw = field(formData, "final_status");

  const parsed = schema.safeParse({
    influencerId,
    contentQualityRating: formData.get("content_quality_rating"),
    brandFitRating: formData.get("brand_fit_rating"),
    reliabilityRating: formData.get("reliability_rating"),
    contentQualityNotes: field(formData, "content_quality_notes"),
    brandFitNotes: field(formData, "brand_fit_notes"),
    reliabilityNotes: field(formData, "reliability_notes"),
    finalStatus: finalStatusRaw || null,
    finalReason: field(formData, "final_reason"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/influencers/${influencerId}?evaluation_error=validation#evaluation`);
  }

  const v = parsed.data;
  if (["waitlist", "not_qualified"].includes(v.finalStatus ?? "") && !v.finalReason) {
    redirect(`/dashboard/influencers/${influencerId}?evaluation_error=reason_required#evaluation`);
  }

  const { supabase } = await requireRole(["admin", "coordinator", "reviewer"]);
  const { error } = await supabase.rpc("save_influencer_evaluation", {
    p_influencer_id: v.influencerId,
    p_content_quality_rating: v.contentQualityRating,
    p_brand_fit_rating: v.brandFitRating,
    p_reliability_rating: v.reliabilityRating,
    p_content_quality_notes: v.contentQualityNotes || null,
    p_brand_fit_notes: v.brandFitNotes || null,
    p_reliability_notes: v.reliabilityNotes || null,
    p_final_status: v.finalStatus,
    p_final_reason: v.finalReason || null,
  });

  if (error) {
    const message = error.message || "";
    const code = message.includes("DECISION_REASON_REQUIRED")
      ? "reason_required"
      : message.includes("NOT_AUTHORIZED")
        ? "unauthorized"
        : "save_failed";
    redirect(`/dashboard/influencers/${influencerId}?evaluation_error=${code}#evaluation`);
  }

  revalidatePath(`/dashboard/influencers/${influencerId}`);
  revalidatePath("/dashboard/influencers");
  redirect(`/dashboard/influencers/${influencerId}?evaluation_saved=1#evaluation`);
}
