"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { hasPermission, type PermissionResource } from "@/lib/auth/permissions";
import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon, type DashboardIconName } from "./icons";

type NavItem = {
  href: string;
  label: keyof DashboardDictionary["navigation"];
  icon: DashboardIconName;
  resource: PermissionResource;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", icon: "dashboard", resource: "dashboard" },
  { href: "/dashboard/influencers", label: "influencers", icon: "influencers", resource: "influencers" },
  { href: "/dashboard/campaigns", label: "campaigns", icon: "campaigns", resource: "campaigns" },
  { href: "/dashboard/content", label: "content", icon: "content", resource: "content", disabled: true },
  { href: "/dashboard/payments", label: "payments", icon: "payments", resource: "payments", disabled: true },
  { href: "/dashboard/messages", label: "messages", icon: "messages", resource: "messages", disabled: true },
  { href: "/dashboard/reports", label: "reports", icon: "reports", resource: "reports", disabled: true },
  { href: "/dashboard/access-requests", label: "accessRequests", icon: "access", resource: "access_requests" },
  { href: "/dashboard/users", label: "users", icon: "users", resource: "users", disabled: true },
  { href: "/dashboard/settings", label: "settings", icon: "settings", resource: "settings", disabled: true },
];

export function DashboardSidebar({
  role,
  locale,
  dictionary,
  onNavigate,
}: {
  role: string;
  locale: DashboardLocale;
  dictionary: DashboardDictionary;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(role, item.resource, "view"));

  return (
    <aside
      className="flex h-full w-[286px] flex-col overflow-hidden bg-[linear-gradient(180deg,#6578CF_0%,#5368C3_48%,#4056B2_100%)] text-white shadow-[0_22px_65px_rgba(42,60,145,0.28)]"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="relative border-b border-white/12 px-6 pb-5 pt-7">
        <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute left-3 top-6 h-28 w-28 opacity-15 [background:radial-gradient(circle_at_50%_50%,white_0_1px,transparent_2px)] [background-size:14px_14px]" />
        <Link href="/dashboard" onClick={onNavigate} className="relative flex items-center gap-3">
          <div className="flex h-[70px] w-[92px] shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2 ring-1 ring-white/14 backdrop-blur-sm">
            <Image src="/da-logo.png" alt={dictionary.brand.name} width={115} height={72} className="h-14 w-auto object-contain" priority />
          </div>
          <div>
            <p className="text-xs font-bold text-white/65">{dictionary.brand.employeePortal}</p>
            <h2 className="mt-1 text-base font-black leading-6">{dictionary.brand.system}</h2>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
        {visibleItems.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const label = dictionary.navigation[item.label];
          const content = (
            <>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${active ? "bg-[#5368C3] text-white shadow-sm" : "bg-white/8 text-white/78 group-hover:bg-white/12 group-hover:text-white"}`}>
                <DashboardIcon name={item.icon} className="h-[19px] w-[19px]" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{label}</span>
              {item.disabled ? <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/58">{dictionary.common.soon}</span> : null}
            </>
          );
          const className = `group flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 transition ${active ? "bg-white text-[#4056A8] shadow-[0_12px_28px_rgba(24,38,105,0.18)]" : item.disabled ? "cursor-default text-white/55" : "text-white/82 hover:bg-white/10 hover:text-white"}`;

          return item.disabled ? <div key={item.href} className={className}>{content}</div> : <Link key={item.href} href={item.href} onClick={onNavigate} className={className}>{content}</Link>;
        })}
      </nav>

      <div className="border-t border-white/12 p-4">
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold text-white/75 transition hover:bg-white/10 hover:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8"><DashboardIcon name="logout" className="h-[19px] w-[19px]" /></span>
            {dictionary.common.logout}
          </button>
        </form>
        <p className="mt-3 px-3 text-[10px] font-semibold text-white/38">Dar Al Amirat · 2026</p>
      </div>
    </aside>
  );
}
