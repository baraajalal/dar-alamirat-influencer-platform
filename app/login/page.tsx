import { cookies } from "next/headers";
import LoginForm from "./login-form";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    registered?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const copy = getAppDictionary(locale).login;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const registered = params.registered === "1";
  const error = errorCode
    ? copy.errors[errorCode as keyof typeof copy.errors] ?? copy.errors.default
    : undefined;

  return <LoginForm error={error} registered={registered} locale={locale} copy={copy} />;
}
