"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function reviewInfluencerRegistration(formData: FormData) {
  const influencerId = String(formData.get("influencer_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!influencerId || !["approve", "reject"].includes(decision)) return;

  const { user, supabase } = await requireRole(["admin", "coordinator"]);
  const approved = decision === "approve";
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("influencers")
    .update({
      account_status: approved ? "active" : "rejected",
      approved_by: user.id,
      approved_at: now,
      archive_match_status: approved ? "approved" : "rejected",
    })
    .eq("id", influencerId);

  if (error) throw new Error(error.message);

  await supabase
    .from("influencer_claim_requests")
    .update({
      status: approved ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("influencer_id", influencerId)
    .eq("status", "pending");

  await createAdminClient()
    .from("activity_logs")
    .insert({
      actor_id: user.id,
      entity_type: "influencer",
      entity_id: influencerId,
      action: approved ? "registration_approved" : "registration_rejected",
    });

  revalidatePath("/dashboard/influencers");
}
