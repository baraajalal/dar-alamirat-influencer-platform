"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";

function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function updateCampaignBrandPolicy(formData: FormData) {
  const campaignId = text(formData, "campaign_id");
  const brandId = text(formData, "brand_id");
  const rawScope = text(formData, "exclusivity_scope");
  const rawDays = text(formData, "exclusivity_days");
  const rawStart = text(formData, "exclusivity_start_basis");
  const locale = text(formData, "locale") === "en" ? "en" : "ar";
  const { supabase } = await requirePermission("campaigns", "update");

  if (!campaignId || !brandId) redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=validation`);
  const scope = rawScope === "inherit" ? null : rawScope;
  if (scope !== null && !["none", "brands", "all"].includes(scope)) redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=validation`);
  const days = scope && scope !== "none" ? Number(rawDays || "45") : null;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=validation`);
  const startBasis = rawStart === "inherit" || !scope || scope === "none" ? null : rawStart;
  if (startBasis !== null && !["publishing_date", "accepted_at"].includes(startBasis)) redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=validation`);

  const blocked = scope === "brands" ? Array.from(new Set(formData.getAll("blocked_brand_ids").map(String).filter((id) => id && id !== brandId))) : [];
  if (scope === "brands" && blocked.length === 0) redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=validation`);
  const { error } = await supabase.rpc("update_campaign_brand_policy", {
    p_campaign_id: campaignId,
    p_brand_id: brandId,
    p_scope: scope,
    p_days: days,
    p_start_basis: startBasis,
    p_blocked_brand_ids: blocked,
  });
  if (error) {
    console.error("UPDATE_CAMPAIGN_BRAND_POLICY", error);
    redirect(`/dashboard/campaigns/${campaignId}?brand_policy_error=save_failed&locale=${locale}`);
  }
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaignId}?brand_policy_saved=1`);
}
