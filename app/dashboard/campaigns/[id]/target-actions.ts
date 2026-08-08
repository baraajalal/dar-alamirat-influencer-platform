"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";

const targetSchema = z.object({
  campaignId: z.string().uuid(),
  label: z.string().trim().min(2).max(120),
  type: z.enum(["influencers_count", "accepted_influencers_count", "published_content_count", "approved_content_count", "views", "likes", "comments", "shares", "saves", "engagement", "promo_code_uses", "sales_amount", "reach", "attendance", "custom"]),
  targetValue: z.coerce.number().positive(),
  currentValue: z.coerce.number().min(0).default(0),
  source: z.enum(["automatic", "manual", "external_import"]),
  required: z.boolean(),
  primary: z.boolean(),
});

export async function addCampaignTarget(formData: FormData) {
  const parsed = targetSchema.safeParse({
    campaignId: formData.get("campaign_id"),
    label: formData.get("target_label"),
    type: formData.get("target_type"),
    targetValue: formData.get("target_value"),
    currentValue: formData.get("current_value") || 0,
    source: formData.get("measurement_source"),
    required: formData.get("is_required") === "on",
    primary: formData.get("is_primary") === "on",
  });
  if (!parsed.success) redirect(`/dashboard/campaigns/${String(formData.get("campaign_id"))}?target_error=invalid`);
  const { profile, supabase } = await requirePermission("campaigns", "update");
  const value = parsed.data;
  const { error } = await supabase.from("campaign_targets").insert({
    campaign_id: value.campaignId,
    target_label: value.label,
    target_type: value.type,
    target_value: value.targetValue,
    current_value: value.currentValue,
    measurement_source: value.source,
    is_required: value.required,
    is_primary: value.primary,
    created_by: profile.id,
  });
  if (error) redirect(`/dashboard/campaigns/${value.campaignId}?target_error=${encodeURIComponent(error.code || "save")}`);
  await supabase.rpc("refresh_campaign_progress", { p_campaign_id: value.campaignId });
  revalidatePath(`/dashboard/campaigns/${value.campaignId}`);
  redirect(`/dashboard/campaigns/${value.campaignId}?target_saved=1`);
}

export async function updateCampaignTargetValue(formData: FormData) {
  const campaignId = String(formData.get("campaign_id") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const currentValue = Number(formData.get("current_value") ?? 0);
  if (!campaignId || !targetId || !Number.isFinite(currentValue) || currentValue < 0) redirect(`/dashboard/campaigns/${campaignId}?target_error=invalid_value`);
  const { supabase } = await requirePermission("campaigns", "update");
  const { error } = await supabase.from("campaign_targets").update({ current_value: currentValue, measurement_source: "manual", updated_at: new Date().toISOString() }).eq("id", targetId).eq("campaign_id", campaignId);
  if (error) redirect(`/dashboard/campaigns/${campaignId}?target_error=update`);
  await supabase.rpc("refresh_campaign_progress", { p_campaign_id: campaignId });
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(`/dashboard/campaigns/${campaignId}?target_saved=1`);
}

export async function deleteCampaignTarget(formData: FormData) {
  const campaignId = String(formData.get("campaign_id") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const { supabase } = await requirePermission("campaigns", "update");
  await supabase.from("campaign_targets").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", targetId).eq("campaign_id", campaignId);
  await supabase.rpc("refresh_campaign_progress", { p_campaign_id: campaignId });
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(`/dashboard/campaigns/${campaignId}?target_deleted=1`);
}
