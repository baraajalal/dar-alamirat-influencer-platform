import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { getCampaignCopy, type CampaignLocale } from "../../../campaign-copy";
import { CampaignPageHeader } from "../../../campaign-ui";
import AssignmentForm from "./assignment-form";

export const dynamic = "force-dynamic";

type BudgetRow = {
  estimated_budget: number | null;
  committed_amount: number | null;
  remaining_amount: number | null;
  paid_amount: number | null;
  awaiting_payment: number | null;
  over_budget_amount: number | null;
  usage_percentage: number | null;
};

export default async function AddCampaignInfluencerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requirePermission("campaigns", "update");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value) as CampaignLocale;
  const copy = getCampaignCopy(locale);

  const [campaignResult, budgetResult, branchesResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,brand,product,status,budget,content_due_at,publishing_date")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("campaign_budget_summary", { p_campaign_id: id }),
    supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
  ]);

  if (campaignResult.error) throw new Error(campaignResult.error.message);
  if (!campaignResult.data) notFound();
  if (budgetResult.error) throw new Error(budgetResult.error.message);

  const campaign = campaignResult.data;
  const budget = (budgetResult.data?.[0] ?? null) as BudgetRow | null;
  const branchesUnavailable = Boolean(branchesResult.error);

  return (
    <div dir={copy.direction} className="space-y-6">
      <CampaignPageHeader
        eyebrow={campaign.name}
        title={copy.add.title}
        description={copy.add.subtitle}
        actionHref={`/dashboard/campaigns/${id}`}
        actionLabel={copy.common.back}
        actionIcon="arrow"
      />

      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#A775C0] via-[#5B6FC7] to-[#8492DA] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.22)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black">{campaign.brand || copy.common.unspecified}</span>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">{campaign.name}</h2>
            <p className="mt-2 text-sm font-semibold text-white/70">{campaign.product || copy.common.unspecified}</p>
          </div>
          <div className="max-w-xl rounded-[22px] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-black text-white/65">45 Days Availability Rule</p>
            <p className="mt-2 text-sm font-bold leading-7 text-white">{copy.add.availabilityRule}</p>
          </div>
        </div>
      </section>

      {branchesUnavailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-800">{copy.add.branchWarning}</div>
      ) : null}

      <AssignmentForm
        locale={locale}
        campaignId={campaign.id}
        campaignName={campaign.name}
        defaultContentDueLocal={toLocalDateTime(campaign.content_due_at)}
        defaultPublishingDate={campaign.publishing_date ?? ""}
        initialBranches={((branchesResult.data ?? []) as Array<{ id: string; name: string }>).map((branch) => ({ id: branch.id, name: branch.name }))}
        budget={{
          estimatedBudget: Number(budget?.estimated_budget ?? campaign.budget ?? 0),
          committedAmount: Number(budget?.committed_amount ?? 0),
          remainingAmount: Number(budget?.remaining_amount ?? campaign.budget ?? 0),
          paidAmount: Number(budget?.paid_amount ?? 0),
          awaitingPayment: Number(budget?.awaiting_payment ?? 0),
          overBudgetAmount: Number(budget?.over_budget_amount ?? 0),
          usagePercentage: budget?.usage_percentage === null || budget?.usage_percentage === undefined ? null : Number(budget.usage_percentage),
        }}
      />
    </div>
  );
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
