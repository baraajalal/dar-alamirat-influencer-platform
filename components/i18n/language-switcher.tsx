"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AppLocale } from "@/lib/i18n/app";

export function AppLanguageSwitcher({ locale, hideOnDashboard = true }: { locale: AppLocale; hideOnDashboard?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (hideOnDashboard && pathname.startsWith("/dashboard")) return null;

  const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";

  async function switchLanguage() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) throw new Error("locale_update_failed");
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
      document.documentElement.dataset.locale = nextLocale;
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={pending}
      className="fixed bottom-4 left-4 z-[100] inline-flex h-10 items-center gap-2 rounded-full border border-[#DBC8E2] bg-white/95 px-4 text-xs font-black text-[#6F547A] shadow-[0_10px_30px_rgba(64,36,77,.10)] backdrop-blur-md transition hover:bg-[#FCF9FD] hover:text-[#5F3B6C] disabled:opacity-60 sm:bottom-6 sm:left-6"
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      data-no-auto-translate
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F4ECF7] text-[11px] text-[#8F61A0]" aria-hidden>文</span>
      <span>{locale === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
