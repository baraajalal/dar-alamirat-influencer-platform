import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordClient from "./set-password-client";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getFlowDictionary } from "@/lib/i18n/flow-dictionary";

export const dynamic = "force-dynamic";

export default async function PortalSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string | string[] }>;
}) {
  const params = await searchParams;
  const assignmentId =
    typeof params.assignment === "string" ? params.assignment : "";

  const [supabase, cookieStore] = await Promise.all([createClient(), cookies()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid_activation_session");
  }

  const locale = normalizeAppLocale(
    cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value,
  );
  const copy = getFlowDictionary(locale).portalSetPassword;

  return <SetPasswordClient assignmentId={assignmentId} locale={locale} copy={copy} />;
}
