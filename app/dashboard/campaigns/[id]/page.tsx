import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "نشطة",
  paused: "موقوفة مؤقتًا",
  completed: "مكتملة",
  archived: "مؤرشفة",
};

const executionLabels: Record<string, string> = {
  home: "منزلي",
  in_branch: "حضوري",
  remote: "أخرى",
};

const compensationLabels: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  voucher: "قسيمة مشتريات",
  product: "مقابل منتجات",
};

const paymentTimingLabels: Record<string, string> = {
  before_publish: "الدفع قبل النشر",
  after_publish: "الدفع بعد النشر",
  by_agreement: "الدفع حسب الاتفاق",
};

const assignmentStatusLabels: Record<string, string> = {
  invited: "تمت الدعوة",
  accepted: "تم القبول",
  product_pending: "بانتظار المنتج",
  brief_pending: "بانتظار البريف",
  content_pending: "بانتظار المحتوى",
  under_review: "قيد المراجعة",
  needs_changes: "يحتاج تعديلات",
  approved: "معتمد",
  payment_pending: "بانتظار الدفع",
  paid: "مدفوع",
  closed: "مغلق",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

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
  order_invoice_amount: number | null;
  has_contract: boolean;
  contract_reference: string | null;
  agreement_date: string | null;
  payment_timing: string | null;
  agreed_amount: number | null;
  currency: string | null;
  availability_blocked_until: string | null;
  created_at: string;
  influencers: {
    full_name: string;
    mobile_e164: string;
  } | null;
  assignment_platforms: Array<{
    id: string;
    social_accounts: {
      platform: string;
      username: string;
    } | null;
    content_items: Array<{ id: string }>;
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
  const { profile, supabase } = await requireRole([
    "admin",
    "coordinator",
    "finance",
  ]);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select(
      "id,name,brand,product,campaign_type,brief,start_date,end_date,content_due_at,publishing_date,budget,status,manager_id,hashtags,reference_links,internal_notes,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) notFound();

  const [managerResult, assignmentsResult, budgetResult] = await Promise.all([
    campaign.manager_id
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", campaign.manager_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { full_name: string } | null, error: null }),
    supabase
      .from("campaign_assignments")
      .select(
        "id,status,influencer_id,execution_type,other_execution_details,requires_content,content_due_at,publishing_date,branch,attendance_at,order_number,order_invoice_amount,has_contract,contract_reference,agreement_date,payment_timing,agreed_amount,currency,availability_blocked_until,created_at,influencers(full_name,mobile_e164),assignment_platforms(id,social_accounts(platform,username),content_items(id)),assignment_compensations(id,type,amount,voucher_source,voucher_branch,product_description,product_reference_value)",
      )
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("campaign_budget_summary", { p_campaign_id: id }),
  ]);

  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (budgetResult.error) throw new Error(budgetResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentRow[];
  const budget = (budgetResult.data?.[0] ?? null) as BudgetRow | null;
  const canManage = profile.role === "admin" || profile.role === "coordinator";

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]"
    >
      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/campaigns"
            className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]"
          >
            العودة للحملات
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
        {query.created === "1" && (
          <SuccessMessage>تم إنشاء الحملة وحفظ جميع بياناتها بنجاح.</SuccessMessage>
        )}
        {query.assignment && (
          <SuccessMessage>تم ربط المؤثر بالحملة وإنشاء تفاصيل المحتوى والمقابل بنجاح.</SuccessMessage>
        )}

        <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6877C8_0%,#5A6BC1_52%,#8794DE_100%)] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.25)] sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">
                  {statusLabels[campaign.status] ?? campaign.status}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">
                  {campaign.brand || "بدون براند"}
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-black sm:text-4xl">{campaign.name}</h1>
              <p className="mt-3 text-sm text-white/75">
                {campaign.product || campaign.campaign_type || "حملة إعلانية"}
              </p>
            </div>
            {canManage && (
              <Link
                href={`/dashboard/campaigns/${id}/influencers/add`}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 font-black text-[#596BC4] shadow-[0_14px_30px_rgba(40,50,110,0.18)] transition hover:-translate-y-0.5"
              >
                + إضافة مؤثر للحملة
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="مدير الحملة" value={managerResult.data?.full_name ?? "غير محدد"} />
          <InfoCard label="عدد المؤثرين" value={`${assignments.length}`} />
          <InfoCard label="موعد النشر" value={formatDate(campaign.publishing_date)} />
          <InfoCard label="الميزانية التقديرية" value={formatMoney(budget?.estimated_budget ?? campaign.budget)} />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <BudgetCard label="المتفق عليه" value={budget?.committed_amount} />
          <BudgetCard label="المتبقي" value={budget?.remaining_amount} danger={Number(budget?.remaining_amount ?? 0) < 0} />
          <BudgetCard label="المدفوع" value={budget?.paid_amount} />
          <BudgetCard label="بانتظار الدفع" value={budget?.awaiting_payment} />
          <BudgetCard label="تجاوز الميزانية" value={budget?.over_budget_amount} danger={Number(budget?.over_budget_amount ?? 0) > 0} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="space-y-6">
            <Card title="البريف والتعليمات">
              <p className="whitespace-pre-wrap text-sm leading-8 text-[#68718F]">
                {campaign.brief || "لم تتم إضافة بريف حتى الآن."}
              </p>
            </Card>

            <Card title="المؤثرون المرتبطون بالحملة">
              {assignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D8DDF7] bg-[#FAFBFF] px-5 py-10 text-center">
                  <p className="font-black text-[#596BC4]">لم تتم إضافة مؤثرين بعد</p>
                  <p className="mt-2 text-sm text-[#8991AA]">
                    ابحثي عن المؤثر، افحصي توفره وحددي المنصات والمحتوى وقيمة الإعلان.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => {
                    const contentCount = assignment.assignment_platforms.reduce(
                      (total, platform) => total + platform.content_items.length,
                      0,
                    );
                    return (
                      <article
                        key={assignment.id}
                        className="rounded-[22px] border border-[#E3E7F5] bg-[#FBFCFF] p-5"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div>
                            <p className="font-black text-[#35467E]">
                              {assignment.influencers?.full_name ?? "مؤثر"}
                            </p>
                            <p dir="ltr" className="mt-1 text-right text-xs text-[#8991A9]">
                              {assignment.influencers?.mobile_e164 ?? ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#5D6EC3]">
                              {assignmentStatusLabels[assignment.status] ?? assignment.status}
                            </span>
                            <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#56658E] shadow-sm">
                              {formatMoney(assignment.agreed_amount)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          {assignment.assignment_platforms.map((platform) => (
                            <span
                              key={platform.id}
                              className="rounded-full bg-white px-3 py-2 font-bold text-[#6E789A] shadow-sm"
                            >
                              {platform.social_accounts?.platform ?? "منصة"} — @{platform.social_accounts?.username ?? ""}
                            </span>
                          ))}
                          <span className="rounded-full bg-white px-3 py-2 font-bold text-[#6E789A] shadow-sm">
                            {assignment.requires_content
                              ? `${contentCount} قطعة محتوى`
                              : "لا يتطلب محتوى"}
                          </span>
                          <span className="rounded-full bg-[#EEF1FF] px-3 py-2 font-black text-[#5E6FC2]">
                            {executionLabels[assignment.execution_type ?? ""] ?? "طريقة تنفيذ غير محددة"}
                          </span>
                          {assignment.branch && (
                            <span className="rounded-full bg-white px-3 py-2 font-bold text-[#6E789A] shadow-sm">
                              الفرع: {assignment.branch}
                            </span>
                          )}
                          {assignment.order_number && (
                            <span className="rounded-full bg-white px-3 py-2 font-bold text-[#6E789A] shadow-sm">
                              الطلب: {assignment.order_number} — {formatMoney(assignment.order_invoice_amount)}
                            </span>
                          )}
                          {assignment.has_contract && (
                            <span className="rounded-full bg-amber-50 px-3 py-2 font-black text-amber-700">
                              عقد أو اتفاق{assignment.payment_timing ? ` — ${paymentTimingLabels[assignment.payment_timing] ?? assignment.payment_timing}` : ""}
                            </span>
                          )}
                        </div>

                        {assignment.assignment_compensations.length > 0 && (
                          <div className="mt-4 border-t border-[#E4E7F3] pt-4">
                            <p className="mb-3 text-xs font-black text-[#69759A]">تفاصيل المقابل</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {assignment.assignment_compensations.map((compensation) => (
                                <span
                                  key={compensation.id}
                                  className="rounded-full border border-[#E1E5F2] bg-white px-3 py-2 font-bold text-[#5F6C91]"
                                >
                                  {compensationLabels[compensation.type] ?? compensation.type}
                                  {compensation.type === "product"
                                    ? ` — قيمة المنتجات ${formatMoney(compensation.product_reference_value)}`
                                    : ` — ${formatMoney(compensation.amount)}`}
                                  {compensation.type === "voucher" && compensation.voucher_source === "branch" && compensation.voucher_branch
                                    ? ` — ${compensation.voucher_branch}`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="الجدول الزمني">
              <TimelineItem label="بداية الحملة" value={formatDate(campaign.start_date)} />
              <TimelineItem label="تسليم المحتوى" value={formatDateTime(campaign.content_due_at)} />
              <TimelineItem label="موعد النشر" value={formatDate(campaign.publishing_date)} />
              <TimelineItem label="نهاية الحملة" value={formatDate(campaign.end_date)} last />
            </Card>
            <Card title="استخدام الميزانية">
              <div className="rounded-2xl bg-[#F6F7FF] p-4">
                <div className="flex items-center justify-between text-xs font-bold text-[#6E7898]">
                  <span>النسبة المستخدمة</span>
                  <span>{formatPercent(budget?.usage_percentage)}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#E1E5F5]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#6877C8,#8D99E6)]"
                    style={{ width: `${Math.min(Number(budget?.usage_percentage ?? 0), 100)}%` }}
                  />
                </div>
                {Number(budget?.over_budget_amount ?? 0) > 0 && (
                  <p className="mt-3 text-xs font-black leading-6 text-rose-600">
                    تم تجاوز الميزانية التقديرية، لكن النظام يسمح باستمرار العمل والحفظ.
                  </p>
                )}
              </div>
            </Card>
            <Card title="الهاشتاقات">
              <div className="flex flex-wrap gap-2">
                {campaign.hashtags?.length ? (
                  campaign.hashtags.map((tag: string) => (
                    <span key={tag} className="rounded-full bg-[#EEF0FF] px-3 py-2 text-xs font-black text-[#596BC4]">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#8991AA]">لا توجد هاشتاقات.</span>
                )}
              </div>
            </Card>
            <Card title="ملاحظات داخلية">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#6F7896]">
                {campaign.internal_notes || "لا توجد ملاحظات داخلية."}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-white/85 bg-white/94 p-5 shadow-[0_18px_48px_rgba(72,84,150,0.08)] sm:p-6">
      <h2 className="mb-5 text-lg font-black text-[#3E4C7C]">{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/85 bg-white/94 p-5 shadow-[0_16px_42px_rgba(72,84,150,0.08)]">
      <p className="text-xs font-bold text-[#8A92AA]">{label}</p>
      <p className="mt-2 text-lg font-black text-[#405080]">{value}</p>
    </div>
  );
}

function BudgetCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number | null | undefined;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-[20px] border p-4 shadow-sm ${danger ? "border-rose-200 bg-rose-50" : "border-white/85 bg-white/94"}`}>
      <p className={`text-xs font-bold ${danger ? "text-rose-600" : "text-[#8A92AA]"}`}>{label}</p>
      <p className={`mt-2 text-base font-black ${danger ? "text-rose-700" : "text-[#405080]"}`}>{formatMoney(value)}</p>
    </div>
  );
}

function TimelineItem({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="mt-1 h-3 w-3 rounded-full bg-[#6877C8]" />
        {!last && <span className="h-11 w-px bg-[#D8DDF7]" />}
      </div>
      <div>
        <p className="text-xs text-[#8A92AA]">{label}</p>
        <p className="mt-1 text-sm font-black text-[#52608B]">{value}</p>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "غير محدد";
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(Number(value))}%`;
}
