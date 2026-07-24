import "./dashboard.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-user";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireRole(["admin", "coordinator", "finance", "reviewer", "viewer"]);
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const roleLabel = dictionary.roles[profile.role as keyof typeof dictionary.roles] ?? profile.role;

  return (
    <DashboardShell role={profile.role} profileName={profile.full_name} locale={locale} dictionary={dictionary} roleLabel={roleLabel}>
      {children}
    </DashboardShell>
  );
}
