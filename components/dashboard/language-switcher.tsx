"use client";

import { useRouter } from "next/navigation";
import type { DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "./icons";

export function LanguageSwitcher({ locale }: { locale: DashboardLocale }) {
  const router = useRouter();
  const nextLocale: DashboardLocale = locale === "ar" ? "en" : "ar";

  function switchLanguage() {
    document.cookie = `dashboard_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E8F6] bg-white/90 px-3 text-xs font-extrabold text-[#4F609F] shadow-sm transition hover:border-[#BFC9ED] hover:bg-[#F8F9FF]"
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <DashboardIcon name="globe" className="h-4 w-4" />
      <span>{locale === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
