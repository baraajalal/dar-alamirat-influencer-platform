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
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${active ? "bg-[#5368C3] text-white shadow-sm" : "bg-white/8 text-white/78 group-hover:bg-white/12 group-hover:text-white"}`}>
          <DashboardIcon name={item.icon} className="h-[19px] w-[19px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{label}</span>
        {item.disabled ? <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/58">{dictionary.common.soon}</span> : null}
      </>
    );
    const className = `group flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 transition ${active ? "bg-white text-[#4056A8] shadow-[0_12px_28px_rgba(24,38,105,0.18)]" : item.disabled ? "cursor-default text-white/55" : "text-white/82 hover:bg-white/10 hover:text-white"}`;

    return item.disabled
      ? <div key={item.href} className={className}>{content}</div>
      : <Link key={item.href} href={item.href} onClick={onNavigate} className={className}>{content}</Link>;
  }


  function renderCampaignGroup(parent: NavItem) {
    const groupActive = pathname.startsWith("/dashboard/campaigns");
    return (
      <div key={parent.href} className="space-y-1.5">
        <div className={`group flex min-h-12 items-center rounded-2xl transition ${groupActive ? "bg-white text-[#4056A8] shadow-[0_12px_28px_rgba(24,38,105,0.18)]" : "text-white/82 hover:bg-white/10 hover:text-white"}`}>
          <Link href={parent.href} onClick={() => { setCampaignOpen(true); onNavigate?.(); }} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${groupActive ? "bg-[#5368C3] text-white" : "bg-white/8 text-white/78"}`}><DashboardIcon name={parent.icon} className="h-[19px] w-[19px]" /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{dictionary.navigation[parent.label]}</span>
          </Link>
          <button type="button" onClick={() => setCampaignOpen((v) => !v)} className="mx-2 flex h-9 w-9 items-center justify-center rounded-xl" aria-expanded={campaignOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 transition-transform ${campaignOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
        {campaignOpen ? <div className={`space-y-1 border-white/15 ${locale === "ar" ? "mr-6 border-r pr-3" : "ml-6 border-l pl-3"}`}>
          {campaignChildren.map((child) => { const active = pathname.startsWith(child.href); return <Link key={child.href} href={child.href} onClick={onNavigate} className={`group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-extrabold transition ${active ? "bg-white/18 text-white" : "text-white/68 hover:bg-white/10 hover:text-white"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/7"><DashboardIcon name={child.icon} className="h-4 w-4" /></span><span>{dictionary.navigation[child.label]}</span></Link>; })}
        </div> : null}
      </div>
    );
  }
  function renderFinanceGroup(parent: NavItem) {
    const financeActive = pathname.startsWith("/dashboard/finance");
    const parentLabel = dictionary.navigation[parent.label];

    return (
      <div key={parent.href} className="space-y-1.5">
        <div className={`group flex min-h-12 items-center rounded-2xl transition ${financeActive ? "bg-white text-[#4056A8] shadow-[0_12px_28px_rgba(24,38,105,0.18)]" : "text-white/82 hover:bg-white/10 hover:text-white"}`}>
          <Link
            href={parent.href}
            onClick={() => {
              setFinanceOpen(true);
              onNavigate?.();
            }}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${financeActive ? "bg-[#5368C3] text-white shadow-sm" : "bg-white/8 text-white/78 group-hover:bg-white/12 group-hover:text-white"}`}>
              <DashboardIcon name={parent.icon} className="h-[19px] w-[19px]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{parentLabel}</span>
          </Link>

          <button
            type="button"
            aria-label={financeOpen ? "Collapse finance menu" : "Expand finance menu"}
            aria-expanded={financeOpen}
            onClick={() => setFinanceOpen((current) => !current)}
            className={`mx-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${financeActive ? "text-[#4056A8] hover:bg-[#EEF1FF]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
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
          <div className={`space-y-1 border-white/15 ${locale === "ar" ? "mr-6 border-r pr-3" : "ml-6 border-l pl-3"}`}>
            {financeChildren.map((child) => {
              const childActive = pathname.startsWith(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={`group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-extrabold transition ${childActive ? "bg-white/18 text-white shadow-sm ring-1 ring-white/12" : "text-white/68 hover:bg-white/10 hover:text-white"}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${childActive ? "bg-white/15 text-white" : "bg-white/7 text-white/65 group-hover:text-white"}`}>
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

      <nav className="flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
        <div className="space-y-1.5">
          <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
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
          <div className="mt-6 space-y-1.5 border-t border-white/10 pt-5">
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
              {dictionary.navigation.systemSection}
            </p>
            {systemItems.map(renderStandardItem)}
          </div>
        ) : null}

        {soonItems.length > 0 ? (
          <div className="mt-6 space-y-1.5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between px-3 pb-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                {dictionary.navigation.soonSection}
              </p>
              <span className="rounded-full bg-white/8 px-2 py-1 text-[9px] font-black text-white/45">
                {soonItems.length}
              </span>
            </div>
            {soonItems.map(renderStandardItem)}
          </div>
        ) : null}
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
