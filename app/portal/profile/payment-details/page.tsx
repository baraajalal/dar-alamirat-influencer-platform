import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";
import PaymentDetailsClient from "./payment-details-client";

export const dynamic = "force-dynamic";

export default async function PaymentDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string | string[] }>;
}) {
  const params = await searchParams;
  const assignmentId = typeof params.assignment === "string" ? params.assignment : "";
  const [supabase, store] = await Promise.all([createClient(), cookies()]);
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).paymentDetails;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: influencer } = await admin
    .from("influencers")
    .select("id,must_change_password,activation_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!influencer) redirect("/login?error=profile_not_found");

  if (influencer.must_change_password) {
    redirect(`/portal/set-password${assignmentId ? `?assignment=${encodeURIComponent(assignmentId)}` : ""}`);
  }

  return <PaymentDetailsClient assignmentId={assignmentId} locale={locale} copy={copy} />;
}
