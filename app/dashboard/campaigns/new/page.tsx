import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { getCampaignCopy, type CampaignLocale } from "../campaign-copy";
import { CampaignPageHeader } from "../campaign-ui";
import CampaignForm from "./campaign-form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const { profile, supabase } = await requirePermission("campaigns", "create");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value) as CampaignLocale;
  const copy = getCampaignCopy(locale);

  const [managersResult, brandsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("role", ["admin", "coordinator"])
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("brands")
      .select("id,name_ar,name_en,default_exclusivity_scope,default_exclusivity_days,default_exclusivity_start_basis")
      .eq("is_active", true)
      .order("name_en"),
  ]);

  if (managersResult.error) throw new Error(managersResult.error.message);
  if (brandsResult.error) throw new Error(brandsResult.error.message);

  return (
    <div dir={copy.direction} className="space-y-6">
      <CampaignPageHeader
        eyebrow={copy.common.campaigns}
        title={copy.form.title}
        description={copy.form.subtitle}
        actionHref="/dashboard/campaigns"
        actionLabel={copy.common.back}
        actionIcon="arrow"
      />

      <CampaignForm
        locale={locale}
        managers={managersResult.data ?? []}
        brands={brandsResult.data ?? []}
        currentUserId={profile.id}
        currentUserRole={profile.role}
      />
    </div>
  );
}
