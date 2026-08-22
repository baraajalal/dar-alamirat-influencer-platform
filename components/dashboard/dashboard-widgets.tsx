import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardIcon, type DashboardIconName } from "./icons";

export function DashboardStatCard({
  label,
  value,
  helper,
  icon,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: DashboardIconName;
  accent?: "blue" | "violet" | "gold" | "green";
}) {
  const styles = {
    blue: "bg-[#F4ECF7] text-[#7F568E]",
    violet: "bg-[#EFE2F3] text-[#9566AF]",
    gold: "bg-[#FFF5DF] text-[#A8750D]",
    green: "bg-[#EAF7EF] text-[#2E7B50]",
  }[accent];

  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-[#EEE4F2] bg-white p-5 shadow-[0_10px_30px_rgba(64,36,77,.055)] transition duration-200 hover:-translate-y-0.5 hover:border-[#E2D1E8] hover:shadow-[0_18px_40px_rgba(64,36,77,.085)]">
      <div className="pointer-events-none absolute -left-12 -top-14 h-28 w-28 rounded-full bg-[#F7F0F9]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold text-[#8F8495]">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-[#302437] sm:text-3xl">{value}</p>
          {helper ? <p className="mt-2 text-[11px] font-semibold text-[#9A8FA0]">{helper}</p> : null}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles}`}>
          <DashboardIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

export function DashboardPanel({
  title,
  actionHref,
  actionLabel,
  children,
  className = "",
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[24px] border border-[#EEE4F2] bg-white p-5 shadow-[0_12px_34px_rgba(64,36,77,.055)] sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-[#302437] sm:text-lg">{title}</h2>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="text-xs font-extrabold text-[#8F61A0] transition hover:text-[#5F3B6C]">{actionLabel}</Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardEmpty({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#E2D1E8] bg-[#FCF9FD] px-4 text-center text-sm font-bold text-[#8F8495]">
      {text}
    </div>
  );
}
