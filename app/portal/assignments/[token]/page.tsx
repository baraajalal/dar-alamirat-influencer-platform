import { cookies } from "next/headers";
import GuestAssignmentClient from "./guest-assignment-client";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getFlowDictionary } from "@/lib/i18n/flow-dictionary";

export const dynamic = "force-dynamic";

export default async function GuestAssignmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(
    cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value,
  );
  const copy = getFlowDictionary(locale).guestAssignment;

  return <GuestAssignmentClient token={token} locale={locale} copy={copy} />;
}
