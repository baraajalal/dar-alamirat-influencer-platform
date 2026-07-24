import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardIcon } from "@/components/dashboard/icons";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { getCampaignCopy, type CampaignLocale } from "../campaign-copy";
import {
  CampaignPageHeader,
  CampaignPanel,
  EmptyCampaignState,
  MetricCard,
  StatusBadge,
} from "../campaign-ui";

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

type AssignmentRow = {
  id: string;
  status: string;
  influencer_id: string;
  execution_type: string | null;
  other_execution_details: string | null;
  requires_content: boolean;
  content_due_at: string | null;
  publishing_date: string | null;
  branch: string | null;
  attendance_at: string | null;
  order_number: string | null;
  order_code: string | null;
  order_invoice_amount: number | null;
  has_contract: boolean;
  contract_reference: string | null;
  agreement_date: string | null;
  payment_timing: string | null;
  agreed_amount: number | null;
  currency: string | null;
  availability_blocked_until: string | null;
  created_at: string;
  influencers: { full_name: string; mobile_e164: string } | null;
  assignment_platforms: Array<{
    id: string;
    social_accounts: { platform: string; username: string } | null;
    content_items: Array<{ id: string; content_type?: string | null }>;
  }>;
  assignment_compensations: Array<{
    id: string;
    type: string;
    amount: number | null;
    voucher_source: string | null;
    voucher_branch: string | null;
    product_description: string | null;
    product_reference_value: number | null;
  }>;
};

export default async function CampaignDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string; assignment?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("campaigns", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value) as CampaignLocale;
  const copy = getCampaignCopy(locale);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id,name,brand,product,campaign_type,brief,start_date,end_date,content_due_at,publishing_date,budget,status,manager_id,hashtags,reference_links,internal_notes,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) notFound();

  const [managerResult, assignmentsResult, budgetResult] = await Promise.all([
    campaign.manager_id
      ? supabase.from("profiles").select("full_name").eq("id", campaign.manager_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string } | null, error: null }),
    supabase
      .from("campaign_assignments")
      .select("id,status,influencer_id,execution_type,other_execution_details,requires_content,content_due_at,publishing_date,branch,attendance_at,order_number,order_code,order_invoice_amount,has_contract,contract_reference,agreement_date,payment_timing,agreed_amount,currency,availability_blocked_until,created_at,influencers(full_name,mobile_e164),assignment_platforms(id,social_accounts(platform,username),content_items(id,content_type)),assignment_compensations(id,type,amount,voucher_source,voucher_branch,product_description,product_reference_value)")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("campaign_budget_summary", { p_campaign_id: id }),
  ]);

  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (budgetResult.error) throw new Error(budgetResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentRow[];
  const budget = (budgetResult.data?.[0] ?? null) as BudgetRow | null;
  const canManage = hasPermission(profile.role, "campaigns", "update");
  const statusLabel = copy.statuses[campaign.status as keyof typeof copy.statuses] ?? campaign.status;
  const assignmentLabels = getAssignmentLabels(locale);

  return (
    <div dir={copy.direction} className="space-y-6">
      <CampaignPageHeader
        eyebrow={`${copy.common.campaigns} / ${campaign.brand || copy.common.unspecified}`}
        title={campaign.name}
        description={[campaign.product, campaign.campaign_type].filter(Boolean).join(" · ") || copy.details.campaignBrief}
        actionHref={canManage ? `/dashboard/campaigns/${id}/influencers/add` : "/dashboard/campaigns"}
        actionLabel={canManage ? copy.details.addInfluencer : copy.details.back}
        actionIcon={canManage ? "plus" : "arrow"}
      />

      {query.created === "1" ? <SuccessMessage>{copy.details.createdSuccess}</SuccessMessage> : null}
      {query.assignment ? <SuccessMessage>{copy.details.assignmentSuccess}</SuccessMessage> : null}

      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#687AD1] via-[#5B6FC7] to-[#8492DA] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.22)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={campaign.status} label={statusLabel} />
              {campaign.brand ? <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white">{campaign.brand}</span> : null}
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">{campaign.name}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">{campaign.brief || copy.common.noData}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:min-w-[430px]">
            <HeroMetric label={copy.details.influencerCount} value={`${assignments.length}`} />
            <HeroMetric label={copy.details.usage} value={budget?.usage_percentage === null || budget?.usage_percentage === undefined ? "—" : `${Math.round(Number(budget.usage_percentage))}%`} />
            <HeroMetric label={copy.details.publishDate} value={formatDate(campaign.publishing_date, locale)} />
            <HeroMetric label={copy.list.status} value={statusLabel} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label={copy.details.estimatedBudget} value={formatMoney(budget?.estimated_budget ?? campaign.budget, locale)} icon="wallet" />
        <MetricCard label={copy.details.committed} value={formatMoney(budget?.committed_amount, locale)} icon="campaigns" accent="violet" />
        <MetricCard label={copy.details.remaining} value={formatMoney(budget?.remaining_amount, locale)} icon="reports" accent={Number(budget?.remaining_amount ?? 0) < 0 ? "gold" : "green"} />
        <MetricCard label={copy.details.paid} value={formatMoney(budget?.paid_amount, locale)} icon="payments" accent="green" />
        <MetricCard label={copy.details.awaiting} value={formatMoney(budget?.awaiting_payment, locale)} icon="content" accent="violet" />
        <MetricCard label={copy.details.overBudget} value={formatMoney(budget?.over_budget_amount, locale)} icon="bell" accent="gold" />
      </section>

      {Number(budget?.over_budget_amount ?? 0) > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-800">{copy.details.budgetWarning}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <CampaignPanel title={copy.details.assignments}>
          {assignments.length === 0 ? (
            <EmptyCampaignState text={copy.details.noAssignments} />
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  locale={locale}
                  copy={copy}
                  labels={assignmentLabels}
                />
              ))}
            </div>
          )}
        </CampaignPanel>

        <div className="space-y-6">
          <CampaignPanel title={copy.details.timeline}>
            <div className="space-y-1">
              <TimelineItem label={copy.details.startDate} value={formatDate(campaign.start_date, locale)} />
              <TimelineItem label={copy.details.contentDue} value={formatDateTime(campaign.content_due_at, locale)} />
              <TimelineItem label={copy.details.publishDate} value={formatDate(campaign.publishing_date, locale)} />
              <TimelineItem label={copy.details.endDate} value={formatDate(campaign.end_date, locale)} last />
            </div>
          </CampaignPanel>

          <CampaignPanel title={copy.details.manager}>
            <div className="flex items-center gap-3 rounded-2xl bg-[#F8F9FF] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6877C8] text-white"><DashboardIcon name="users" className="h-5 w-5" /></span>
              <div><p className="font-black text-[#405080]">{managerResult.data?.full_name ?? copy.common.unspecified}</p><p className="mt-1 text-xs font-semibold text-[#929AAF]">{copy.details.manager}</p></div>
            </div>
          </CampaignPanel>

          <CampaignPanel title={copy.details.hashtags}>
            <div className="flex flex-wrap gap-2">
              {campaign.hashtags?.length ? campaign.hashtags.map((tag: string) => <span key={tag} className="rounded-full bg-[#EEF0FF] px-3 py-2 text-xs font-black text-[#596BC4]">{tag}</span>) : <span className="text-sm font-semibold text-[#929AAF]">{copy.common.noData}</span>}
            </div>
          </CampaignPanel>

          <CampaignPanel title={copy.details.references}>
            {campaign.reference_links?.length ? (
              <div className="space-y-2">{campaign.reference_links.map((url: string) => <a key={url} href={url} target="_blank" rel="noreferrer" dir="ltr" className="block truncate rounded-xl bg-[#F8F9FF] px-3 py-2 text-left text-xs font-bold text-[#596BC4] hover:underline">{url}</a>)}</div>
            ) : <span className="text-sm font-semibold text-[#929AAF]">{copy.common.noData}</span>}
          </CampaignPanel>

          <CampaignPanel title={copy.details.internalNotes}>
            <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-[#707995]">{campaign.internal_notes || copy.common.noData}</p>
          </CampaignPanel>
        </div>
      </div>

      <div>
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-2 rounded-2xl border border-[#DDE2F3] bg-white px-4 py-3 text-sm font-black text-[#5D6EC3] shadow-sm transition hover:bg-[#F4F6FF]">
          <DashboardIcon name="arrow" className="h-4 w-4" />
          {copy.details.back}
        </Link>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, locale, copy, labels }: { assignment: AssignmentRow; locale: CampaignLocale; copy: ReturnType<typeof getCampaignCopy>; labels: ReturnType<typeof getAssignmentLabels> }) {
  const collaboration = assignment.execution_type === "home" ? copy.details.home : assignment.execution_type === "in_branch" ? copy.details.inBranch : copy.details.other;
  return (
    <article className="rounded-[22px] border border-[#E3E7F3] bg-[#FAFBFF] p-5 transition hover:border-[#CDD4EE] hover:bg-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-black text-[#35467E]">{assignment.influencers?.full_name ?? copy.common.unspecified}</p>
          <p dir="ltr" className="mt-1 text-start text-xs font-semibold text-[#929AAF]">{assignment.influencers?.mobile_e164 ?? "—"}</p>
        </div>
        <StatusBadge status={assignment.status} label={labels.status[assignment.status] ?? assignment.status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mini label={copy.details.collaboration} value={collaboration} />
        <Mini label={copy.details.compensation} value={assignment.assignment_compensations.length ? assignment.assignment_compensations.map((item) => labels.compensation[item.type] ?? item.type).join(" + ") : locale === "ar" ? "بدون مقابل" : "No compensation"} />
        <Mini label={copy.details.contentDue} value={formatDateTime(assignment.content_due_at, locale)} />
        <Mini label={copy.details.publishDate} value={formatDate(assignment.publishing_date, locale)} />
      </div>

      {assignment.execution_type === "home" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Mini label={copy.details.orderNumber} value={assignment.order_number || "—"} />
          <Mini label={copy.details.orderCode} value={assignment.order_code || "—"} />
          <Mini label={copy.details.orderAmount} value={formatMoney(assignment.order_invoice_amount, locale)} />
        </div>
      ) : null}
      {assignment.execution_type === "in_branch" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Mini label={copy.details.branch} value={assignment.branch || "—"} /><Mini label={copy.details.attendance} value={formatDateTime(assignment.attendance_at, locale)} /></div>
      ) : null}

      <div className="mt-4 border-t border-[#E4E7F2] pt-4">
        <div className="flex flex-wrap gap-2">
          {assignment.assignment_platforms.map((platform) => (
            <span key={platform.id} className="rounded-xl border border-[#DDE2F3] bg-white px-3 py-2 text-xs font-black text-[#59688F]">
              {labels.platform[platform.social_accounts?.platform ?? ""] ?? platform.social_accounts?.platform ?? "—"} · @{platform.social_accounts?.username ?? "—"} · {platform.content_items.length}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {assignment.has_contract ? <span className="rounded-full bg-[#FFF4D6] px-3 py-1.5 text-[11px] font-black text-[#886A1F]">{copy.details.contractPayment} · {labels.paymentTiming[assignment.payment_timing ?? ""] ?? assignment.payment_timing ?? "—"}</span> : null}
          {assignment.availability_blocked_until ? <span className="rounded-full bg-[#F0F2FF] px-3 py-1.5 text-[11px] font-black text-[#596BC4]">45d · {formatDateTime(assignment.availability_blocked_until, locale)}</span> : null}
        </div>
        <p className="text-sm font-black text-[#405080]">{formatMoney(assignment.agreed_amount, locale)}</p>
      </div>
    </article>
  );
}

function getAssignmentLabels(locale: CampaignLocale) {
  return locale === "ar"
    ? {
        status: { invited: "تمت الدعوة", accepted: "تم القبول", product_pending: "بانتظار المنتج", brief_pending: "بانتظار البريف", content_pending: "بانتظار المحتوى", under_review: "قيد المراجعة", needs_changes: "يحتاج تعديلات", approved: "معتمد", payment_pending: "بانتظار الدفع", paid: "مدفوع", closed: "مغلق", rejected: "مرفوض", cancelled: "ملغي" } as Record<string, string>,
        compensation: { bank_transfer: "تحويل بنكي", voucher: "قسيمة مشتريات", product: "مقابل منتجات" } as Record<string, string>,
        paymentTiming: { before_publish: "قبل النشر", after_publish: "بعد النشر", by_agreement: "حسب الاتفاق" } as Record<string, string>,
        platform: { instagram: "إنستغرام", tiktok: "تيك توك", snapchat: "سناب شات", youtube: "يوتيوب", x: "X", facebook: "فيسبوك", other: "أخرى" } as Record<string, string>,
      }
    : {
        status: { invited: "Invited", accepted: "Accepted", product_pending: "Product pending", brief_pending: "Brief pending", content_pending: "Content pending", under_review: "Under review", needs_changes: "Needs changes", approved: "Approved", payment_pending: "Payment pending", paid: "Paid", closed: "Closed", rejected: "Rejected", cancelled: "Cancelled" } as Record<string, string>,
        compensation: { bank_transfer: "Bank transfer", voucher: "Shopping voucher", product: "Products" } as Record<string, string>,
        paymentTiming: { before_publish: "Before publishing", after_publish: "After publishing", by_agreement: "By agreement" } as Record<string, string>,
        platform: { instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", youtube: "YouTube", x: "X", facebook: "Facebook", other: "Other" } as Record<string, string>,
      };
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{children}</div>;
}
function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 backdrop-blur"><p className="text-[10px] font-bold text-white/65">{label}</p><p className="mt-2 truncate text-sm font-black text-white">{value}</p></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold text-[#9AA1B5]">{label}</p><p className="mt-1 truncate text-xs font-black text-[#4D5A86]">{value}</p></div>;
}
function TimelineItem({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1 h-3 w-3 rounded-full bg-[#6877C8]" />{!last ? <span className="h-11 w-px bg-[#D8DDF7]" /> : null}</div><div><p className="text-xs font-bold text-[#929AAF]">{label}</p><p className="mt-1 text-sm font-black text-[#52608B]">{value}</p></div></div>;
}
function formatDate(value: string | null, locale: CampaignLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}
function formatDateTime(value: string | null, locale: CampaignLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
}
function formatMoney(value: number | null | undefined, locale: CampaignLocale) {
  if (value === null || value === undefined) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(Number(value));
}
