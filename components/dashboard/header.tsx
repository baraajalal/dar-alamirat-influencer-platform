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
    <header className="sticky top-0 z-30 border-b border-[#E9ECF7]/90 bg-white/82 backdrop-blur-xl">
      <div className="flex min-h-[78px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onOpenMenu} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E4E8F6] bg-white text-[#5264B7] shadow-sm lg:hidden" aria-label={dictionary.header.menu}>
            <DashboardIcon name="menu" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold text-[#8B94B0]">{dictionary.brand.employeePortal}</p>
            <h1 className="mt-0.5 truncate text-lg font-black text-[#304176] sm:text-xl">{dictionary.navigation[pageKey]}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher locale={locale} />
          <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E8F6] bg-white/90 text-[#5365B8] shadow-sm transition hover:bg-[#F8F9FF]" aria-label={dictionary.header.notifications}>
            <DashboardIcon name="bell" className="h-[19px] w-[19px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F5BF48] ring-2 ring-white" />
          </button>
          <div className="hidden h-9 w-px bg-[#E7EAF4] sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="hidden min-w-0 text-end sm:block">
              <p className="max-w-40 truncate text-sm font-black text-[#33447F]">{profileName}</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#939BB2]">{roleLabel}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#6578CF,#485CB3)] text-xs font-black text-white shadow-[0_8px_20px_rgba(72,91,178,0.25)]">{initials}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
