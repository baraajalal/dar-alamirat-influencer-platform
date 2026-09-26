import { cookies } from "next/headers";
import PortalShell from "@/components/influencer-portal/portal-shell";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";

export const dynamic = "force-dynamic";

export default async function InfluencerAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ influencer }, cookieStore] = await Promise.all([requireInfluencerAccount(), cookies()]);
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const dictionary = getAppDictionary(locale);

  return (
    <PortalShell
      influencerName={influencer.full_name}
      profileCompletion={influencer.profile_completion ?? 0}
      locale={locale}
      copy={dictionary.portal}
      brandName={dictionary.common.brandName}
      communityLabel={dictionary.common.creatorCommunity}
    >
      {children}
    </PortalShell>
  );
}
