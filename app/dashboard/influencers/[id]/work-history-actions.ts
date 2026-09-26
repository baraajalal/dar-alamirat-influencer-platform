"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";

const nullableNumber = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}, z.number().nonnegative().nullable());

const schema = z.object({
  historyId: z.string().uuid().optional().or(z.literal("")),
  influencerId: z.string().uuid(),
  brandId: z.string().uuid().optional().or(z.literal("")),
  brandName: z.string().trim().max(180).optional().default(""),
  campaignName: z.string().trim().min(2).max(240),
  collaborationType: z.enum(["paid", "pr", "product", "voucher", "commission", "hybrid", "other"]),
  collaborationStatus: z.enum(["completed", "published", "cancelled", "other"]),
  collaborationDate: z.string().optional().default(""),
  platform: z.string().trim().max(40).optional().default(""),
  contentType: z.string().trim().max(100).optional().default(""),
  contentUrl: z.string().trim().url().optional().or(z.literal("")),
  compensationAmount: nullableNumber,
  compensationCurrency: z.string().trim().min(3).max(3).default("SAR"),
  views: nullableNumber,
  likes: nullableNumber,
  comments: nullableNumber,
  shares: nullableNumber,
  engagementRate: nullableNumber,
  outcome: z.enum(["positive", "neutral", "needs_attention", "unknown"]),
  performanceNote: z.string().trim().max(2000).optional().default(""),
  internalNotes: z.string().trim().max(4000).optional().default(""),
});

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveWorkHistory(formData: FormData) {
  const influencerId = field(formData, "influencer_id");
  await requirePermission("influencers", "update");

  const parsed = schema.safeParse({
    historyId: field(formData, "history_id"),
    influencerId,
    brandId: field(formData, "brand_id"),
    brandName: field(formData, "brand_name"),
    campaignName: field(formData, "campaign_name"),
    collaborationType: field(formData, "collaboration_type") || "other",
    collaborationStatus: field(formData, "collaboration_status") || "completed",
    collaborationDate: field(formData, "collaboration_date"),
    platform: field(formData, "platform"),
    contentType: field(formData, "content_type"),
    contentUrl: field(formData, "content_url"),
    compensationAmount: formData.get("compensation_amount"),
    compensationCurrency: field(formData, "compensation_currency") || "SAR",
    views: formData.get("views"),
    likes: formData.get("likes"),
    comments: formData.get("comments"),
    shares: formData.get("shares"),
    engagementRate: formData.get("engagement_rate"),
    outcome: field(formData, "outcome") || "unknown",
    performanceNote: field(formData, "performance_note"),
    internalNotes: field(formData, "internal_notes"),
  });

  if (!parsed.success) redirect(`/dashboard/influencers/${influencerId}?history_error=validation#work-history`);
  const { supabase } = await requirePermission("influencers", "update");
  const v = parsed.data;
  const { error } = await supabase.rpc("save_influencer_work_history", {
    p_history_id: v.historyId || null,
    p_influencer_id: v.influencerId,
    p_brand_id: v.brandId || null,
    p_brand_name: v.brandName || null,
    p_campaign_name: v.campaignName,
    p_collaboration_type: v.collaborationType,
    p_collaboration_status: v.collaborationStatus,
    p_collaboration_date: v.collaborationDate || null,
    p_platform: v.platform || null,
    p_content_type: v.contentType || null,
    p_content_url: v.contentUrl || null,
    p_compensation_amount: v.compensationAmount,
    p_compensation_currency: v.compensationCurrency.toUpperCase(),
    p_views: v.views,
    p_likes: v.likes,
    p_comments: v.comments,
    p_shares: v.shares,
    p_engagement_rate: v.engagementRate,
    p_outcome: v.outcome,
    p_performance_note: v.performanceNote || null,
    p_internal_notes: v.internalNotes || null,
  });

  if (error) {
    const code = error.message.includes("WORK_HISTORY_DUPLICATE") ? "duplicate" : "save";
    redirect(`/dashboard/influencers/${influencerId}?history_error=${code}#work-history`);
  }
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  revalidatePath("/dashboard/influencers/archive");
  redirect(`/dashboard/influencers/${influencerId}?history_saved=1#work-history`);
}

export async function deleteWorkHistory(formData: FormData) {
  const influencerId = field(formData, "influencer_id");
  const historyId = field(formData, "history_id");
  await requirePermission("influencers", "delete");
  if (!influencerId || !historyId) redirect(`/dashboard/influencers/${influencerId}#work-history`);
  const { supabase } = await requirePermission("influencers", "delete");
  const { error } = await supabase.rpc("delete_influencer_work_history", { p_history_id: historyId });
  if (error) redirect(`/dashboard/influencers/${influencerId}?history_error=delete#work-history`);
  revalidatePath(`/dashboard/influencers/${influencerId}`);
  redirect(`/dashboard/influencers/${influencerId}?history_deleted=1#work-history`);
}
