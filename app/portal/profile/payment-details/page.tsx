import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import PaymentDetailsClient from "./payment-details-client";

export const dynamic = "force-dynamic";

export default async function PaymentDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string | string[] }>;
}) {
  const params = await searchParams;
  const assignmentId =
    typeof params.assignment === "string" ? params.assignment : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: influencer } = await admin
    .from("influencers")
    .select("id,must_change_password,activation_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!influencer) {
    redirect("/login?error=profile_not_found");
  }

  if (influencer.must_change_password) {
    redirect(
      `/portal/set-password${
        assignmentId
          ? `?assignment=${encodeURIComponent(assignmentId)}`
          : ""
      }`,
    );
  }

  return <PaymentDetailsClient assignmentId={assignmentId} />;
}
