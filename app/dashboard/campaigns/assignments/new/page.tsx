import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";
import AssignmentForm from "../../[id]/influencers/add/assignment-form";

type BudgetRow = {
  estimated_budget: number | null;
  committed_amount: number | null;
  remaining_amount: number | null;
  paid_amount: number | null;
  awaiting_payment: number | null;
  over_budget_amount: number | null;
  usage_percentage: number | null;
};

export const dynamic = "force-dynamic";

export default async function NewAssignmentWorkspacePage({ searchParams }: { searchParams: Promise<{ campaign_id?: string }> }) {
  const query = await searchParams;
  const campaignId = query.campaign_id ?? "";
  const { supabase } = await requirePermission("campaigns", "update");

  if (!campaignId) {
    const { data: campaigns, error } = await supabase.from("campaigns")
      .select("id,name,brand,status,progress_percentage")
      .in("status", ["draft", "active", "paused"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (
      <div className="space-y-6" dir="inherit">
        <div>
          <p className="text-sm font-black text-[#A978C3]">مساحة عمل المنسق</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">اختيار الحملة لإضافة مؤثر</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">اختر الحملة أولًا، ثم ابحث عن المؤثر أو أنشئ ملفًا أوليًا جديدًا.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(campaigns ?? []).map((campaign) => (
            <Link key={campaign.id} href={`/dashboard/campaigns/assignments/new?campaign_id=${campaign.id}`} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#A978C3] hover:shadow-lg">
              <span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-xs font-black text-[#9566AF]">{campaign.brand || "بدون براند"}</span>
              <h2 className="mt-4 text-lg font-black text-slate-900">{campaign.name}</h2>
              <p className="mt-3 text-sm font-bold text-slate-500">تقدم الحملة: {Math.round(Number(campaign.progress_percentage ?? 0))}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#A978C3]" style={{ width: `${Math.min(100, Number(campaign.progress_percentage ?? 0))}%` }} /></div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [campaignResult, budgetResult, branchesResult] = await Promise.all([
    supabase.from("campaigns").select("id,name,brand,product,status,budget,content_due_at,publishing_date").eq("id", campaignId).maybeSingle(),
    supabase.rpc("campaign_budget_summary", { p_campaign_id: campaignId }),
    supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
  ]);
  if (campaignResult.error) throw new Error(campaignResult.error.message);
  if (!campaignResult.data) notFound();
  if (budgetResult.error) throw new Error(budgetResult.error.message);
  const campaign = campaignResult.data;
  if (["completed", "archived"].includes(campaign.status)) redirect("/dashboard/campaigns/assignments?error=campaign_closed");
  const budget = (budgetResult.data?.[0] ?? null) as BudgetRow | null;

  return (
    <div className="space-y-6" dir="inherit">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#A978C3]">إضافة مؤثر لحملة</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{campaign.name}</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">ابحث عن مؤثر موجود أو أنشئ مؤثرًا جديدًا ثم أكمل التكليف.</p>
        </div>
        <Link href="/dashboard/campaigns/assignments/new" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">تغيير الحملة</Link>
      </div>
      <AssignmentForm
        locale="ar"
        campaignId={campaign.id}
        campaignName={campaign.name}
        defaultContentDueLocal={toLocalDateTime(campaign.content_due_at)}
        defaultPublishingDate={campaign.publishing_date ?? ""}
        initialBranches={((branchesResult.data ?? []) as Array<{ id: string; name: string }>).map((branch) => ({ id: branch.id, name: branch.name }))}
        returnTo="/dashboard/campaigns/assignments"
        budget={{
          estimatedBudget: Number(budget?.estimated_budget ?? campaign.budget ?? 0),
          committedAmount: Number(budget?.committed_amount ?? 0),
          remainingAmount: Number(budget?.remaining_amount ?? campaign.budget ?? 0),
          paidAmount: Number(budget?.paid_amount ?? 0),
          awaitingPayment: Number(budget?.awaiting_payment ?? 0),
          overBudgetAmount: Number(budget?.over_budget_amount ?? 0),
          usagePercentage: budget?.usage_percentage == null ? null : Number(budget.usage_percentage),
        }}
      />
    </div>
  );
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
