"use client";

import { useState, type ReactNode } from "react";
import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardHeader } from "./header";
import { DashboardSidebar } from "./sidebar";

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
    <div dir={direction} className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,rgba(216,221,247,.58),transparent_30%),radial-gradient(circle_at_88%_85%,rgba(169,185,230,.28),transparent_25%),#F5F7FC] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <div className="flex min-h-screen">
        <div className="hidden shrink-0 lg:block"><div className="sticky top-0 h-screen"><DashboardSidebar role={role} locale={locale} dictionary={dictionary} /></div></div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-[#1D2854]/45 backdrop-blur-sm" />
            <div className={`absolute inset-y-0 ${locale === "ar" ? "right-0" : "left-0"}`}><DashboardSidebar role={role} locale={locale} dictionary={dictionary} onNavigate={() => setMobileOpen(false)} /></div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <DashboardHeader profileName={profileName} roleLabel={roleLabel} locale={locale} dictionary={dictionary} onOpenMenu={() => setMobileOpen(true)} />
          <div className="relative min-h-[calc(100vh-78px)] overflow-hidden">
            <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-[#D8DDF7]/22 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-[#A9B9E6]/18 blur-3xl" />
            <div className="employee-dashboard-content relative px-4 py-5 sm:px-6 sm:py-7 xl:px-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
