"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  roles?: string[];
  financeChild?: boolean;
  campaignChild?: boolean;
  section?: "main" | "system" | "soon";
};

const NAV_ITEMS: NavItem[] = [
  // المسارات العاملة حاليًا
  { href: "/dashboard", label: "dashboard", icon: "dashboard", resource: "dashboard", section: "main" },
  { href: "/dashboard/influencers", label: "influencers", icon: "influencers", resource: "influencers", section: "main" },
  { href: "/dashboard/campaigns", label: "campaigns", icon: "campaigns", resource: "campaigns", section: "main" },
  { href: "/dashboard/campaigns/assignments", label: "campaignAssignments", icon: "influencers", resource: "campaigns", campaignChild: true, section: "main" },
  { href: "/dashboard/finance", label: "financeOperations", icon: "payments", resource: "payments", roles: ["admin", "finance"], section: "main" },
  { href: "/dashboard/finance/approvals", label: "financeApprovals", icon: "access", resource: "payments", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/finance/transfers", label: "financialTransfers", icon: "wallet", resource: "payments", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/finance/vouchers", label: "electronicVouchers", icon: "payments", resource: "payments", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/finance/settlements", label: "financeSettlements", icon: "wallet", resource: "payments", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/finance/exceptions", label: "financeExceptions", icon: "reports", resource: "reports", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/finance/reports", label: "financeReports", icon: "reports", resource: "reports", roles: ["admin", "finance"], financeChild: true, section: "main" },
  { href: "/dashboard/payments", label: "payments", icon: "payments", resource: "payments", roles: ["coordinator", "viewer"], section: "main" },

  // إدارة النظام
  { href: "/dashboard/access-requests", label: "accessRequests", icon: "access", resource: "access_requests", section: "system" },
  { href: "/dashboard/users", label: "users", icon: "users", resource: "users", section: "system" },

  // خصائص مخطط لها ولم تُفتح بعد
  { href: "/dashboard/settings", label: "settings", icon: "settings", resource: "settings", disabled: true, section: "soon" },
  { href: "/dashboard/marketing-projects", label: "marketingProjects", icon: "campaigns", resource: "campaigns", disabled: true, section: "soon" },
  { href: "/dashboard/content", label: "content", icon: "content", resource: "content", disabled: true, section: "soon" },
  { href: "/dashboard/messages", label: "messages", icon: "messages", resource: "messages", disabled: true, section: "soon" },
  { href: "/dashboard/reports", label: "reports", icon: "reports", resource: "reports", disabled: true, section: "soon" },
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
  const [financeOpen, setFinanceOpen] = useState(() => pathname.startsWith("/dashboard/finance"));
  const [campaignOpen, setCampaignOpen] = useState(() => pathname.startsWith("/dashboard/campaigns"));

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      hasPermission(role, item.resource, "view") &&
      (!item.roles || item.roles.includes(role)),
  );

  const financeChildren = visibleItems.filter((item) => item.financeChild);
  const campaignChildren = visibleItems.filter((item) => item.campaignChild);
  const mainItems = visibleItems.filter((item) => item.section === "main");
  const systemItems = visibleItems.filter((item) => item.section === "system");
  const soonItems = visibleItems.filter((item) => item.section === "soon");

  function renderStandardItem(item: NavItem) {
    const active = item.href === "/dashboard"
      ? pathname === item.href
      : pathname.startsWith(item.href);
    const label = dictionary.navigation[item.label];
    const content = (
      <>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${active ? "bg-[#8F61A0] text-white shadow-sm" : "bg-[#F7F0F9] text-[#8F61A0] group-hover:bg-[#F1E5F5] group-hover:text-[#5F3B6C]"}`}>
          <DashboardIcon name={item.icon} className="h-[19px] w-[19px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{label}</span>
        {item.disabled ? <span className="rounded-full bg-[#F4ECF7] px-2 py-1 text-[10px] font-bold text-[#8F61A0]">{dictionary.common.soon}</span> : null}
      </>
    );
    const className = `group flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 transition ${active ? "bg-[#F4ECF7] text-[#5F3B6C] ring-1 ring-[#E5D3EB]" : item.disabled ? "cursor-default text-[#B0A6B4]" : "text-[#5D5263] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`;

    return item.disabled
      ? <div key={item.href} className={className}>{content}</div>
      : <Link key={item.href} href={item.href} onClick={onNavigate} className={className}>{content}</Link>;
  }


  function renderCampaignGroup(parent: NavItem) {
    const groupActive = pathname.startsWith("/dashboard/campaigns");
    return (
      <div key={parent.href} className="space-y-1.5">
        <div className={`group flex min-h-12 items-center rounded-2xl transition ${groupActive ? "bg-[#F4ECF7] text-[#5F3B6C] ring-1 ring-[#E5D3EB]" : "text-[#5D5263] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`}>
          <Link href={parent.href} onClick={() => { setCampaignOpen(true); onNavigate?.(); }} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${groupActive ? "bg-[#9566AF] text-white" : "bg-[#F7F0F9] text-[#8F61A0]"}`}><DashboardIcon name={parent.icon} className="h-[19px] w-[19px]" /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{dictionary.navigation[parent.label]}</span>
          </Link>
          <button type="button" onClick={() => setCampaignOpen((v) => !v)} className="mx-2 flex h-9 w-9 items-center justify-center rounded-xl" aria-expanded={campaignOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 transition-transform ${campaignOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
        {campaignOpen ? <div className={`space-y-1 border-[#E7DDEF] ${locale === "ar" ? "mr-6 border-r pr-3" : "ml-6 border-l pl-3"}`}>
          {campaignChildren.map((child) => { const active = pathname.startsWith(child.href); return <Link key={child.href} href={child.href} onClick={onNavigate} className={`group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-extrabold transition ${active ? "bg-[#F1E5F5] text-[#5F3B6C]" : "text-[#7E7284] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F7F0F9]"><DashboardIcon name={child.icon} className="h-4 w-4" /></span><span>{dictionary.navigation[child.label]}</span></Link>; })}
        </div> : null}
      </div>
    );
  }
  function renderFinanceGroup(parent: NavItem) {
    const financeActive = pathname.startsWith("/dashboard/finance");
    const parentLabel = dictionary.navigation[parent.label];

    return (
      <div key={parent.href} className="space-y-1.5">
        <div className={`group flex min-h-12 items-center rounded-2xl transition ${financeActive ? "bg-[#F4ECF7] text-[#5F3B6C] ring-1 ring-[#E5D3EB]" : "text-[#5D5263] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`}>
          <Link
            href={parent.href}
            onClick={() => {
              setFinanceOpen(true);
              onNavigate?.();
            }}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${financeActive ? "bg-[#8F61A0] text-white shadow-sm" : "bg-[#F7F0F9] text-[#8F61A0] group-hover:bg-[#F1E5F5] group-hover:text-[#5F3B6C]"}`}>
              <DashboardIcon name={parent.icon} className="h-[19px] w-[19px]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{parentLabel}</span>
          </Link>

          <button
            type="button"
            aria-label={financeOpen ? "Collapse finance menu" : "Expand finance menu"}
            aria-expanded={financeOpen}
            onClick={() => setFinanceOpen((current) => !current)}
            className={`mx-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${financeActive ? "text-[#74478F] hover:bg-[#F7F0F9]" : "text-[#7E7284] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition-transform duration-200 ${financeOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {financeOpen ? (
          <div className={`space-y-1 border-[#E7DDEF] ${locale === "ar" ? "mr-6 border-r pr-3" : "ml-6 border-l pl-3"}`}>
            {financeChildren.map((child) => {
              const childActive = pathname.startsWith(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={`group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-extrabold transition ${childActive ? "bg-[#F1E5F5] text-[#5F3B6C] shadow-sm ring-1 ring-white/12" : "text-[#7E7284] hover:bg-[#FCF9FD] hover:text-[#5F3B6C]"}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${childActive ? "bg-[#E9D9EE] text-[#5F3B6C]" : "bg-[#F7F0F9] text-white/65 group-hover:text-white"}`}>
                    <DashboardIcon name={child.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{dictionary.navigation[child.label]}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside
      className="flex h-full w-[286px] flex-col overflow-hidden border-e border-[#EEE4F2] bg-white text-[#4C4052] shadow-[12px_0_40px_rgba(64,36,77,.035)]"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="relative border-b border-[#EEE4F2] px-5 pb-5 pt-6">
        <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full border border-[#F4ECF7]" />
        <div className="pointer-events-none absolute left-3 top-6 h-28 w-28 opacity-30 [background:radial-gradient(circle_at_50%_50%,#D8B9E1_0_1px,transparent_2px)] [background-size:14px_14px]" />
        <Link href="/dashboard" onClick={onNavigate} className="relative flex items-center gap-3">
          <div className="flex h-[64px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-[#FCF9FD] p-2 ring-1 ring-[#EEE4F2]">
            <Image src="/da-logo.png" alt={dictionary.brand.name} width={115} height={72} className="h-14 w-auto object-contain" priority />
          </div>
          <div>
            <p className="text-xs font-bold text-[#9A8FA0]">{dictionary.brand.employeePortal}</p>
            <h2 className="mt-1 text-base font-black leading-6 text-[#302437]">{dictionary.brand.system}</h2>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(159,112,177,.35)_transparent]">
        <div className="space-y-1.5">
          <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A398A8]">
            {dictionary.navigation.mainSection}
          </p>
          {mainItems.map((item) => {
            if (item.financeChild || item.campaignChild) return null;
            if (item.href === "/dashboard/campaigns") return renderCampaignGroup(item);
            if (item.href === "/dashboard/finance") return renderFinanceGroup(item);
            return renderStandardItem(item);
          })}
        </div>

        {systemItems.length > 0 ? (
          <div className="mt-6 space-y-1.5 border-t border-[#EEE4F2] pt-5">
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A398A8]">
              {dictionary.navigation.systemSection}
            </p>
            {systemItems.map(renderStandardItem)}
          </div>
        ) : null}

        {soonItems.length > 0 ? (
          <div className="mt-6 space-y-1.5 border-t border-[#EEE4F2] pt-5">
            <div className="flex items-center justify-between px-3 pb-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A398A8]">
                {dictionary.navigation.soonSection}
              </p>
              <span className="rounded-full bg-[#F4ECF7] px-2 py-1 text-[9px] font-black text-[#9A8FA0]">
                {soonItems.length}
              </span>
            </div>
            {soonItems.map(renderStandardItem)}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-[#EEE4F2] p-4">
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold text-[#756A7A] transition hover:bg-[#FCF9FD] hover:text-[#5F3B6C]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F0F9]"><DashboardIcon name="logout" className="h-[19px] w-[19px]" /></span>
            {dictionary.common.logout}
          </button>
        </form>
        <p className="mt-3 px-3 text-[10px] font-semibold text-[#AAA0AE]">Dar Al Amirat · 2026</p>
      </div>
    </aside>
  );
}
