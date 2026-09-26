"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

const PAGE = "/portal/campaigns";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function applyToCampaign(formData: FormData) {
  const campaignId = text(formData, "campaign_id");
  const message = text(formData, "message");
  const acceptTerms = formData.get("accept_terms") === "on";
  if (!campaignId) redirect(`${PAGE}?error=campaign_required`);

  const { supabase } = await requireInfluencerAccount();
  const { error } = await supabase.rpc("submit_campaign_application", {
    p_campaign_id: campaignId,
    p_message: message || null,
    p_accept_terms: acceptTerms,
  });

  if (error) {
    const code = String(error.message || "");
    const mapped = code.includes("INFLUENCER_UNAVAILABLE")
      ? "unavailable"
      : code.includes("APPLICATION_LIMIT_REACHED")
        ? "full"
        : code.includes("APPLICATION_ALREADY_REVIEWED")
          ? "reviewed"
          : code.includes("ALREADY_ASSIGNED")
            ? "assigned"
            : code.includes("CAMPAIGN_TERMS_REQUIRED")
              ? "terms_required"
              : "apply_failed";
    redirect(`${PAGE}?error=${mapped}`);
  }

  revalidatePath(PAGE);
  redirect(`${PAGE}?applied=1`);
}

export async function withdrawApplication(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect(`${PAGE}?error=application_required`);

  const { supabase } = await requireInfluencerAccount();
  const { error } = await supabase.rpc("withdraw_campaign_application", {
    p_application_id: applicationId,
  });

  if (error) redirect(`${PAGE}?error=withdraw_failed`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?withdrawn=1`);
}
