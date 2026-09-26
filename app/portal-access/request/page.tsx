import { cookies } from "next/headers";
import InfluencerOnboardingWizard from "@/components/influencer-onboarding-wizard";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";

export default async function PortalAccessRequestPage() {
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  return <InfluencerOnboardingWizard locale={locale} copy={getAppDictionary(locale).onboarding} />;
}
