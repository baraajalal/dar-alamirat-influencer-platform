import "server-only";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export type InfluencerAccount = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  mobile_e164: string;
  city: string | null;
  country: string;
  gender: string | null;
  account_status: string;
  activation_status: string;
  must_change_password: boolean;
  profile_completion: number;
  created_at: string;
};

export async function requireInfluencerAccount() {
  const session = await requireRole(["influencer"]);
  const admin = createAdminClient();

  const { data: influencer, error } = await admin
    .from("influencers")
    .select(
      "id,user_id,full_name,email,mobile_e164,city,country,gender,account_status,activation_status,must_change_password,profile_completion,created_at",
    )
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !influencer) {
    redirect("/login?error=profile_not_found");
  }

  if (influencer.must_change_password) {
    redirect("/portal/set-password");
  }

  if (
    influencer.activation_status === "suspended" ||
    influencer.account_status === "suspended"
  ) {
    redirect("/unauthorized");
  }

  return {
    ...session,
    admin,
    influencer: influencer as InfluencerAccount,
  };
}
