import { cookies } from "next/headers";
import ActivationClient from "./activation-client";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getFlowDictionary } from "@/lib/i18n/flow-dictionary";

export const dynamic = "force-dynamic";

export default async function ActivateInfluencerAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(
    cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value,
  );
  const copy = getFlowDictionary(locale).directActivation;

  return <ActivationClient token={token} locale={locale} copy={copy} />;
}
