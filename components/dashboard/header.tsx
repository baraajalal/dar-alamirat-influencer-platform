"use client";

import { usePathname } from "next/navigation";
import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";

const PAGE_KEYS: Array<{ match: string; key: keyof DashboardDictionary["navigation"] }> = [
  { match: "/dashboard/access-requests", key: "accessRequests" },
  { match: "/dashboard/influencers", key: "influencers" },
  { match: "/dashboard/campaigns", key: "campaigns" },
  { match: "/dashboard/content", key: "content" },
  { match: "/dashboard/payments", key: "payments" },
  { match: "/dashboard/messages", key: "messages" },
  { match: "/dashboard/reports", key: "reports" },
  { match: "/dashboard/users", key: "users" },
  { match: "/dashboard/settings", key: "settings" },
];

export function DashboardHeader({
  profileName,
  roleLabel,
  locale,
  dictionary,
  onOpenMenu,
}: {
  profileName: string;
  roleLabel: string;
  locale: DashboardLocale;
  dictionary: DashboardDictionary;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const pageKey = PAGE_KEYS.find((item) => pathname.startsWith(item.match))?.key ?? "dashboard";
  const initials = profileName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DA";

  return (
    <header className="sticky top-0 z-30 border-b border-[#EEE4F2]/95 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8 2xl:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E9DFED] bg-white text-[#7F568E] shadow-[0_6px_18px_rgba(64,36,77,.06)] transition hover:bg-[#FCF9FD] lg:hidden"
            aria-label={dictionary.header.menu}
          >
            <DashboardIcon name="menu" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-[#9A8FA0]">{dictionary.brand.employeePortal}</p>
            <h1 className="mt-0.5 truncate text-lg font-black text-[#302437] sm:text-xl">{dictionary.navigation[pageKey]}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher locale={locale} />
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9DFED] bg-white text-[#8F61A0] shadow-[0_6px_18px_rgba(64,36,77,.05)] transition hover:border-[#DBC8E2] hover:bg-[#FCF9FD]"
            aria-label={dictionary.header.notifications}
          >
            <DashboardIcon name="bell" className="h-[19px] w-[19px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D99B45] ring-2 ring-white" />
          </button>
          <div className="hidden h-9 w-px bg-[#E9DFED] sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="hidden min-w-0 text-end sm:block">
              <p className="max-w-44 truncate text-sm font-black text-[#302437]">{profileName}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#9A8FA0]">{roleLabel}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B682C5,#7F568E)] text-xs font-black text-white shadow-[0_8px_20px_rgba(127,86,142,.22)] ring-4 ring-[#F7F0F9]">{initials}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
