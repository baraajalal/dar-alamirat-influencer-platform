import { cookies } from "next/headers";
import PortalAccessActivateClient from "./activate-client";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getFlowDictionary } from "@/lib/i18n/flow-dictionary";

type ActivatePageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function PortalAccessActivatePage({ searchParams }: ActivatePageProps) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] ?? "" : rawToken ?? "";
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(
    cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value,
  );
  const copy = getFlowDictionary(locale).activationLink;

  return <PortalAccessActivateClient token={token} locale={locale} copy={copy} />;
}
