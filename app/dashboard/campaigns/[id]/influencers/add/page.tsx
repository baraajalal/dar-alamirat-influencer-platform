import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
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
  const { supabase } = await requireRole(["admin", "coordinator"]);

  const [{ data: campaign, error: campaignError }, budgetResult, branchesResult] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select(
          "id,name,brand,product,status,budget,content_due_at,publishing_date",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("campaign_budget_summary", { p_campaign_id: id }),
      supabase
        .from("branches")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();
  if (budgetResult.error) throw new Error(budgetResult.error.message);
  if (branchesResult.error) throw new Error(branchesResult.error.message);

  const budget = (budgetResult.data?.[0] ?? null) as BudgetRow | null;

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]"
    >
      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/dashboard/campaigns/${id}`}
            className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]"
          >
            العودة لتفاصيل الحملة
          </Link>
          <div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#6877C8] p-2 shadow-[0_10px_25px_rgba(104,119,200,0.25)]">
            <Image
              src="/da-logo.png"
              alt="دار الأميرات"
              width={110}
              height={55}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1350px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6877C8_0%,#5A6BC1_52%,#8794DE_100%)] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.25)] sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">
                إضافة مؤثر إلى الحملة
              </span>
              <h1 className="mt-5 text-3xl font-black sm:text-4xl">
                {campaign.name}
              </h1>
              <p className="mt-3 text-sm leading-7 text-white/75">
                {campaign.brand || "دار الأميرات"}
                {campaign.product ? ` — ${campaign.product}` : ""}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-xl">
              <p className="text-xs font-bold text-white/70">قاعدة التوفر</p>
              <p className="mt-2 max-w-sm text-sm font-black leading-7">
                لا يمكن ربط المؤثر بحملة جديدة أثناء تكليف قائم أو قبل مرور 45 يومًا على تسوية آخر مستحقاته.
              </p>
            </div>
          </div>
        </section>

        <AssignmentForm
          campaignId={campaign.id}
          campaignName={campaign.name}
          defaultContentDueLocal={toLocalDateTime(campaign.content_due_at)}
          defaultPublishingDate={campaign.publishing_date ?? ""}
          initialBranches={(branchesResult.data ?? []).map((branch) => ({
            id: branch.id,
            name: branch.name,
          }))}
          budget={{
            estimatedBudget: Number(budget?.estimated_budget ?? campaign.budget ?? 0),
            committedAmount: Number(budget?.committed_amount ?? 0),
            remainingAmount: Number(
              budget?.remaining_amount ?? campaign.budget ?? 0,
            ),
            paidAmount: Number(budget?.paid_amount ?? 0),
            awaitingPayment: Number(budget?.awaiting_payment ?? 0),
            overBudgetAmount: Number(budget?.over_budget_amount ?? 0),
            usagePercentage:
              budget?.usage_percentage === null ||
              budget?.usage_percentage === undefined
                ? null
                : Number(budget.usage_percentage),
          }}
        />
      </div>
    </main>
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
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
