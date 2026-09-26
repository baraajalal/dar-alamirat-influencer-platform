import { cookies } from "next/headers";
import InfluencerOnboardingWizard from "@/components/influencer-onboarding-wizard";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";

export default async function EditAccessPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  return <InfluencerOnboardingWizard editToken={token} locale={locale} copy={getAppDictionary(locale).onboarding} />;
}
