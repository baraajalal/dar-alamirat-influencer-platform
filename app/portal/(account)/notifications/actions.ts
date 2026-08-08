"use server";

import { revalidatePath } from "next/cache";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

export async function markAllNotificationsRead() {
  const { influencer, admin } = await requireInfluencerAccount();
  const { error } = await admin
    .from("influencer_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("influencer_id", influencer.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/portal/notifications");
}
