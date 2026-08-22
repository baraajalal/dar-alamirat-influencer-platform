"use client";

import { useState, type ReactNode } from "react";
import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardHeader } from "./header";
import { DashboardSidebar } from "./sidebar";
import { UntranslatedPageTranslator } from "./untranslated-page-translator";

export function DashboardShell({
  children,
  role,
  profileName,
  locale,
  dictionary,
  roleLabel,
}: {
  children: ReactNode;
  role: string;
  profileName: string;
  locale: DashboardLocale;
  dictionary: DashboardDictionary;
  roleLabel: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={direction} className="da-page-shell min-h-screen bg-[#FAF7FB] text-[#4C4052]">
      <div className="flex min-h-screen">
        <div className="hidden shrink-0 lg:block">
          <div className="sticky top-0 h-screen">
            <DashboardSidebar role={role} locale={locale} dictionary={dictionary} />
          </div>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-[#2F1938]/35 backdrop-blur-sm"
            />
            <div className={`absolute inset-y-0 ${locale === "ar" ? "right-0" : "left-0"}`}>
              <DashboardSidebar role={role} locale={locale} dictionary={dictionary} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <DashboardHeader
            profileName={profileName}
            roleLabel={roleLabel}
            locale={locale}
            dictionary={dictionary}
            onOpenMenu={() => setMobileOpen(true)}
          />

          <div className="relative min-h-[calc(100vh-76px)] overflow-hidden">
            <div className="pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-[#E7D6EC]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#F0E4F4]/60 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,0))]" />
            <div className="employee-dashboard-content relative mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8 2xl:px-10">
              <UntranslatedPageTranslator locale={locale} />
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
