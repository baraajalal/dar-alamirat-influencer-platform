import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardIcon, type DashboardIconName } from "@/components/dashboard/icons";

export function CampaignPageHeader({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  actionIcon = "plus",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: DashboardIconName;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <span className="inline-flex rounded-full border border-[#DCE2F8] bg-white/80 px-3 py-1.5 text-[11px] font-black text-[#6575C6] shadow-sm">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-3 text-2xl font-black tracking-tight text-[#3D274F] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-[#7F88A3]">
            {description}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#A775C0] to-[#8C5BA5] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(79,98,185,0.22)] transition hover:-translate-y-0.5"
        >
          <DashboardIcon name={actionIcon} className="h-5 w-5" />
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function CampaignPanel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,0.08)] sm:p-6 ${className}`}
    >
      {title || description ? (
        <div className="mb-5">
          {title ? <h2 className="text-base font-black text-[#4A315C] sm:text-lg">{title}</h2> : null}
          {description ? <p className="mt-1 text-xs font-semibold leading-6 text-[#96859E]">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function CampaignSectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A775C0] to-[#5668BE] text-sm font-black text-white shadow-[0_10px_24px_rgba(83,101,188,0.22)]">
        {number}
      </span>
      <div>
        <h2 className="text-base font-black text-[#4A315C] sm:text-lg">{title}</h2>
        {description ? <p className="mt-1 text-xs font-semibold leading-6 text-[#95849D]">{description}</p> : null}
      </div>
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    active: "bg-emerald-50 text-emerald-700",
    paused: "bg-amber-50 text-amber-700",
    completed: "bg-[#F6EFF9] text-[#9362AD]",
    archived: "bg-[#F2F3F6] text-[#73798B]",
    invited: "bg-[#F6EFF9] text-[#9362AD]",
    accepted: "bg-cyan-50 text-cyan-700",
    product_pending: "bg-amber-50 text-amber-700",
    brief_pending: "bg-amber-50 text-amber-700",
    content_pending: "bg-orange-50 text-orange-700",
    under_review: "bg-violet-50 text-violet-700",
    needs_changes: "bg-rose-50 text-rose-700",
    approved: "bg-emerald-50 text-emerald-700",
    payment_pending: "bg-amber-50 text-amber-700",
    paid: "bg-emerald-50 text-emerald-700",
    closed: "bg-slate-100 text-slate-700",
    rejected: "bg-rose-50 text-rose-700",
    cancelled: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-black ${styles[status] ?? "bg-[#F2F4FA] text-[#69738F]"}`}>
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  helper,
  accent = "blue",
}: {
  label: string;
  value: ReactNode;
  icon: DashboardIconName;
  helper?: string;
  accent?: "blue" | "violet" | "gold" | "green";
}) {
  const gradients = {
    blue: "from-[#A775C0] to-[#5366BC]",
    violet: "from-[#D8BDE3] to-[#7E8ED8]",
    gold: "from-[#F8D779] to-[#E8B846]",
    green: "from-[#BFE8CF] to-[#7FC39A]",
  }[accent];
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-white/90 bg-white/94 p-5 shadow-[0_16px_45px_rgba(69,83,151,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold text-[#9098AF]">{label}</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-[#3D274F]">{value}</div>
          {helper ? <p className="mt-2 text-[11px] font-bold text-[#A0A7BA]">{helper}</p> : null}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradients} text-white shadow-sm`}>
          <DashboardIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

export function EmptyCampaignState({ text }: { text: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-[#ECE1F1] bg-[#FDFBFE] px-4 text-center text-sm font-bold text-[#95849D]">
      {text}
    </div>
  );
}
