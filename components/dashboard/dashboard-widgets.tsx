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
    blue: "from-[#6679D1] to-[#4F63BC] text-white",
    violet: "from-[#A9B9E6] to-[#7E8DD8] text-white",
    gold: "from-[#FFF2CB] to-[#F6C85D] text-[#6B5521]",
    green: "from-[#E6F8ED] to-[#BFE8CF] text-[#26734A]",
  }[accent];
  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/85 bg-white/92 p-5 shadow-[0_16px_45px_rgba(69,83,151,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_52px_rgba(69,83,151,0.13)]">
      <div className={`absolute -left-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.12] ${styles}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold text-[#8D95AD]">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-[#304176] sm:text-3xl">{value}</p>
          {helper ? <p className="mt-2 text-[11px] font-bold text-[#98A0B6]">{helper}</p> : null}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${styles}`}><DashboardIcon name={icon} className="h-5 w-5" /></span>
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
    <section className={`rounded-[26px] border border-white/90 bg-white/92 p-5 shadow-[0_18px_55px_rgba(69,83,151,0.08)] sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-[#34457E] sm:text-lg">{title}</h2>
        {actionHref && actionLabel ? <Link href={actionHref} className="text-xs font-extrabold text-[#5B6EC6] transition hover:text-[#4154AD]">{actionLabel}</Link> : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardEmpty({ text }: { text: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#DDE2F3] bg-[#FAFBFF] px-4 text-center text-sm font-bold text-[#929AB1]">{text}</div>;
}
