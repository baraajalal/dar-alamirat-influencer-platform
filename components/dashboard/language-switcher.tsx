"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "./icons";

export function LanguageSwitcher({ locale }: { locale: DashboardLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const nextLocale: DashboardLocale = locale === "ar" ? "en" : "ar";

  async function switchLanguage() {
    if (pending) return;
    setPending(true);

    try {
      const response = await fetch("/api/dashboard/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) throw new Error("LOCALE_UPDATE_FAILED");

      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
      router.refresh();
    } catch (error) {
      console.error("DASHBOARD_LANGUAGE_SWITCH_FAILED", error);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E8F6] bg-white/90 px-3 text-xs font-extrabold text-[#4F609F] shadow-sm transition hover:border-[#BFC9ED] hover:bg-[#F8F9FF] disabled:cursor-wait disabled:opacity-60"
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <DashboardIcon name="globe" className="h-4 w-4" />
      <span>{pending ? "…" : locale === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
