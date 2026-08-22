"use client";

import { useRouter } from "next/navigation";
import type { DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "./icons";

export function LanguageSwitcher({ locale }: { locale: DashboardLocale }) {
  const router = useRouter();
  const nextLocale: DashboardLocale = locale === "ar" ? "en" : "ar";

  function switchLanguage() {
    document.cookie = `dashboard_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `app_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E9DFED] bg-white px-3 text-xs font-extrabold text-[#6F547A] shadow-[0_5px_16px_rgba(64,36,77,.045)] transition hover:border-[#DBC8E2] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      data-no-auto-translate
    >
      <DashboardIcon name="globe" className="h-4 w-4 text-[#9F70B1]" />
      <span>{locale === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
