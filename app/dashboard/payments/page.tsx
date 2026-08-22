import Link from "next/link";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { DashboardStatCard } from "@/components/dashboard/dashboard-widgets";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  assignment_id: string;
  compensation_id: string | null;
  type: string;
  amount: number | string | null;
  expected_amount: number | string | null;
  paid_amount: number | string | null;
  status: string;
  due_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  voucher_status: string | null;
  product_status: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  payment_timing: string | null;
  has_contract: boolean | null;
  currency: string | null;
};

type CompensationRow = {
  id: string;
  assignment_id: string;
  type: string;
  amount: number | string | null;
  expected_payment_at: string | null;
};

type CampaignRow = { id: string; name: string; brand: string | null };
type InfluencerRow = { id: string; full_name: string; mobile_e164: string };

const statusLabels = {
  ar: {
    draft: "مسودة",
    awaiting_approval: "بانتظار الاعتماد",
    ready_for_finance: "جاهز للمالية",
    partially_paid: "مدفوع جزئيًا",
    paid: "مكتمل",
    cancelled: "ملغي",
  },
  en: {
    draft: "Draft",
    awaiting_approval: "Awaiting approval",
    ready_for_finance: "Ready for finance",
    partially_paid: "Partially paid",
    paid: "Completed",
    cancelled: "Cancelled",
  },
} as const;

const typeLabels = {
  ar: {
    bank_transfer: "تحويل بنكي",
    voucher: "قسيمة مشتريات",
    product: "مقابل منتجات",
    commission: "عمولة",
    other: "أخرى",
  },
  en: {
    bank_transfer: "Bank transfer",
    voucher: "Shopping voucher",
    product: "Products",
    commission: "Commission",
    other: "Other",
  },
} as const;

const copy = {
  ar: {
    title: "المدفوعات والمستحقات",
    subtitle: "تابعي الاعتمادات والتحويلات والقسائم وتسليم المنتجات من مكان واحد.",
    search: "اسم المؤثر، الجوال أو اسم الحملة",
    allStatuses: "كل الحالات",
    allTypes: "كل أنواع المقابل",
    allCampaigns: "كل الحملات",
    filter: "تطبيق الفلاتر",
    clear: "مسح",
    expected: "إجمالي المستحق",
    paid: "إجمالي المدفوع",
    remaining: "المتبقي",
    approvals: "بانتظار الاعتماد",
    influencer: "المؤثر",
    campaign: "الحملة",
    type: "نوع المقابل",
    amount: "المستحق",
    paidAmount: "المدفوع",
    status: "الحالة",
    due: "موعد الاستحقاق",
    action: "الإجراء",
    details: "عرض التفاصيل",
    noResults: "لا توجد مستحقات مطابقة للفلاتر الحالية.",
    contract: "مرتبط بعقد",
    beforePublish: "قبل النشر",
    afterPublish: "بعد النشر",
    byAgreement: "حسب الاتفاق",
  },
  en: {
    title: "Payments & Dues",
    subtitle: "Track approvals, bank transfers, vouchers and product delivery in one place.",
    search: "Influencer, mobile or campaign",
    allStatuses: "All statuses",
    allTypes: "All compensation types",
    allCampaigns: "All campaigns",
    filter: "Apply filters",
    clear: "Clear",
    expected: "Total due",
    paid: "Total paid",
    remaining: "Remaining",
    approvals: "Awaiting approval",
    influencer: "Influencer",
    campaign: "Campaign",
    type: "Compensation",
    amount: "Expected",
    paidAmount: "Paid",
    status: "Status",
    due: "Due date",
    action: "Action",
    details: "View details",
    noResults: "No dues match the current filters.",
    contract: "Contract linked",
    beforePublish: "Before publishing",
    afterPublish: "After publishing",
    byAgreement: "By agreement",
  },
} as const;

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tone(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "partially_paid") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "awaiting_approval") return "bg-violet-50 text-violet-700 ring-violet-100";
  if (status === "ready_for_finance") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-slate-50 text-slate-600 ring-slate-100";
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; type?: string; campaign?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requirePermission("payments", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  const t = copy[locale];
  const statusText = statusLabels[locale];
  const typeText = typeLabels[locale];

  const { data: paymentData, error } = await supabase
    .from("payments")
    .select(
      "id,assignment_id,compensation_id,type,amount,expected_amount,paid_amount,status,due_at,submitted_at,approved_at,paid_at,voucher_status,product_status,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  const payments = (paymentData ?? []) as PaymentRow[];
  const assignmentIds = Array.from(new Set(payments.map((item) => item.assignment_id)));

  const { data: compensationData, error: compensationError } = assignmentIds.length
    ? await supabase
        .from("assignment_compensations")
        .select("id,assignment_id,type,amount,expected_payment_at")
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };

  if (compensationError) throw new Error(compensationError.message);
  const compensations = (compensationData ?? []) as CompensationRow[];
  const compensationById = new Map(compensations.map((item) => [item.id, item]));
  const compensationByAssignmentType = new Map(
    compensations.map((item) => [`${item.assignment_id}:${item.type}`, item]),
  );

  function paymentExpectedAmount(payment: PaymentRow) {
    const storedExpected = num(payment.expected_amount);
    if (storedExpected > 0) return storedExpected;

    const paymentAmount = num(payment.amount);
    if (paymentAmount > 0) return paymentAmount;

    const compensation = payment.compensation_id
      ? compensationById.get(payment.compensation_id)
      : compensationByAssignmentType.get(`${payment.assignment_id}:${payment.type}`);
    return num(compensation?.amount);
  }

  function paymentDueAt(payment: PaymentRow) {
    if (payment.due_at) return payment.due_at;
    const compensation = payment.compensation_id
      ? compensationById.get(payment.compensation_id)
      : compensationByAssignmentType.get(`${payment.assignment_id}:${payment.type}`);
    return compensation?.expected_payment_at ?? null;
  }

  const { data: assignmentData, error: assignmentError } = assignmentIds.length
    ? await supabase
        .from("campaign_assignments")
        .select("id,campaign_id,influencer_id,status,payment_timing,has_contract,currency")
        .in("id", assignmentIds)
    : { data: [], error: null };

  if (assignmentError) throw new Error(assignmentError.message);
  const assignments = (assignmentData ?? []) as AssignmentRow[];
  const assignmentMap = new Map(assignments.map((item) => [item.id, item]));
  const campaignIds = Array.from(new Set(assignments.map((item) => item.campaign_id)));
  const influencerIds = Array.from(new Set(assignments.map((item) => item.influencer_id)));

  const [{ data: campaignData }, { data: influencerData }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaigns").select("id,name,brand").in("id", campaignIds)
      : Promise.resolve({ data: [] }),
    influencerIds.length
      ? supabase.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const campaigns = (campaignData ?? []) as CampaignRow[];
  const influencers = (influencerData ?? []) as InfluencerRow[];
  const campaignMap = new Map(campaigns.map((item) => [item.id, item]));
  const influencerMap = new Map(influencers.map((item) => [item.id, item]));

  const q = (params.q ?? "").trim().toLowerCase();
  const filtered = payments.filter((payment) => {
    const assignment = assignmentMap.get(payment.assignment_id);
    const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
    const influencer = assignment ? influencerMap.get(assignment.influencer_id) : undefined;
    const searchable = [campaign?.name, campaign?.brand, influencer?.full_name, influencer?.mobile_e164]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!q || searchable.includes(q)) &&
      (!params.status || payment.status === params.status) &&
      (!params.type || payment.type === params.type) &&
      (!params.campaign || assignment?.campaign_id === params.campaign)
    );
  });

  const totalExpected = filtered.reduce((sum, item) => sum + paymentExpectedAmount(item), 0);
  const totalPaid = filtered.reduce((sum, item) => sum + num(item.paid_amount), 0);
  const totalRemaining = Math.max(totalExpected - totalPaid, 0);
  const awaitingCount = filtered.filter((item) => item.status === "awaiting_approval").length;
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", {
    dateStyle: "medium",
  });

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#5268C3_0%,#7183D4_58%,#A8B6E7_100%)] p-6 text-white shadow-[0_24px_65px_rgba(63,81,171,.24)] sm:p-8">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border border-white/12" />
        <div className="absolute -bottom-24 right-12 h-56 w-56 rounded-full bg-white/8" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <DashboardIcon name="payments" className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-white/72">{t.subtitle}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label={t.expected} value={money.format(totalExpected)} icon="payments" accent="blue" />
        <DashboardStatCard label={t.paid} value={money.format(totalPaid)} icon="payments" accent="green" />
        <DashboardStatCard label={t.remaining} value={money.format(totalRemaining)} icon="payments" accent="gold" />
        <DashboardStatCard label={t.approvals} value={awaitingCount} icon="content" accent="violet" />
      </section>

      <section className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        <form className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto_auto]">
          <input
            name="q"
            defaultValue={params.q}
            placeholder={t.search}
            className="h-12 rounded-2xl border border-[#EEE2F2] bg-[#FDFBFE] px-4 text-sm font-bold text-[#503863] outline-none transition focus:border-[#8392D8] focus:ring-4 focus:ring-[#8392D8]/10"
          />
          <select name="status" defaultValue={params.status ?? ""} className="h-12 rounded-2xl border border-[#EEE2F2] bg-[#FDFBFE] px-4 text-sm font-bold text-[#4B5C91] outline-none">
            <option value="">{t.allStatuses}</option>
            {Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="type" defaultValue={params.type ?? ""} className="h-12 rounded-2xl border border-[#EEE2F2] bg-[#FDFBFE] px-4 text-sm font-bold text-[#4B5C91] outline-none">
            <option value="">{t.allTypes}</option>
            {Object.entries(typeText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="campaign" defaultValue={params.campaign ?? ""} className="h-12 rounded-2xl border border-[#EEE2F2] bg-[#FDFBFE] px-4 text-sm font-bold text-[#4B5C91] outline-none">
            <option value="">{t.allCampaigns}</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <button className="h-12 rounded-2xl bg-[#9463AE] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(75,94,184,.22)] transition hover:bg-[#485BB5]">{t.filter}</button>
          <Link href="/dashboard/payments" className="flex h-12 items-center justify-center rounded-2xl border border-[#ECE1F1] px-5 text-sm font-black text-[#705E7B] transition hover:bg-[#F8F3FA]">{t.clear}</Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/90 bg-white/95 shadow-[0_20px_60px_rgba(69,83,151,.09)]">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[#FAF6FC] text-[#715F7C]">
              <tr>
                {[t.influencer, t.campaign, t.type, t.amount, t.paidAmount, t.status, t.due, t.action].map((label) => (
                  <th key={label} className="px-5 py-4 text-start text-xs font-black">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5EFF7]">
              {filtered.map((payment) => {
                const assignment = assignmentMap.get(payment.assignment_id);
                const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
                const influencer = assignment ? influencerMap.get(assignment.influencer_id) : undefined;
                const expected = paymentExpectedAmount(payment);
                const paid = num(payment.paid_amount);
                const timing = assignment?.payment_timing === "before_publish" ? t.beforePublish : assignment?.payment_timing === "after_publish" ? t.afterPublish : t.byAgreement;

                return (
                  <tr key={payment.id} className="text-[#455582] transition hover:bg-[#FEFCFF]">
                    <td className="px-5 py-4">
                      <p className="font-black text-[#432A57]">{influencer?.full_name ?? "—"}</p>
                      <p dir="ltr" className="mt-1 text-start text-xs font-bold text-[#9B8BA3]">{influencer?.mobile_e164 ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-extrabold">{campaign?.name ?? "—"}</p>
                      <p className="mt-1 text-xs font-bold text-[#9B8BA3]">{campaign?.brand ?? "—"}</p>
                      {assignment?.has_contract ? <span className="mt-2 inline-flex rounded-full bg-[#FFF5D8] px-2.5 py-1 text-[10px] font-black text-[#8A6A1F]">{t.contract} · {timing}</span> : null}
                    </td>
                    <td className="px-5 py-4 font-extrabold">{typeText[payment.type as keyof typeof typeText] ?? payment.type}</td>
                    <td className="px-5 py-4 font-black">{money.format(expected)}</td>
                    <td className="px-5 py-4">
                      <p className="font-black text-emerald-700">{money.format(paid)}</p>
                      {paid < expected ? <p className="mt-1 text-[11px] font-bold text-[#9B8BA3]">{money.format(expected - paid)}</p> : null}
                    </td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ring-1 ${tone(payment.status)}`}>{statusText[payment.status as keyof typeof statusText] ?? payment.status}</span></td>
                    <td className="px-5 py-4 text-xs font-bold text-[#715F7C]">{paymentDueAt(payment) ? date.format(new Date(paymentDueAt(payment)!)) : "—"}</td>
                    <td className="px-5 py-4"><Link href={`/dashboard/payments/${payment.id}`} className="inline-flex rounded-xl bg-[#F7F0FA] px-3.5 py-2 text-xs font-black text-[#5568BF] transition hover:bg-[#E1E6FF]">{t.details}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="p-10 text-center text-sm font-bold text-[#95849D]">{t.noResults}</div> : null}
      </section>
    </main>
  );
}
