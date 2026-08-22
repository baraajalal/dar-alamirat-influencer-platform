import Link from "next/link";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

type CampaignRow = { name: string; brand: string | null };
type AssignmentRow = {
  id: string;
  campaigns: CampaignRow | CampaignRow[] | null;
};

export default async function InfluencerPaymentsPage() {
  const { admin, influencer } = await requireInfluencerAccount();

  const [{ data: assignments }, { data: financial }] = await Promise.all([
    admin
      .from("campaign_assignments")
      .select("id,campaigns(name,brand)")
      .eq("influencer_id", influencer.id),
    admin
      .from("influencer_financial_profiles")
      .select(
        "bank_name,iban,iban_last4,account_holder_name,bank_profile_status,influencer_confirmed_at,finance_reviewed_at,finance_review_notes",
      )
      .eq("influencer_id", influencer.id)
      .maybeSingle(),
  ]);

  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const assignmentIds = assignmentRows.map((row) => row.id);
  const campaignByAssignment = new Map<
    string,
    { name: string; brand: string | null }
  >();

  for (const assignment of assignmentRows) {
    const campaign = relation(assignment.campaigns);
    if (campaign) {
      campaignByAssignment.set(assignment.id, campaign);
    }
  }

  let payments: Array<{
    id: string;
    assignment_id: string;
    type: string;
    expected_amount: number | string | null;
    amount: number | string | null;
    paid_amount: number | string | null;
    status: string;
    due_at: string | null;
    paid_at: string | null;
    voucher_status: string | null;
    product_status: string | null;
  }> = [];

  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from("payments")
      .select(
        "id,assignment_id,type,expected_amount,amount,paid_amount,status,due_at,paid_at,voucher_status,product_status",
      )
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false });
    payments = (data ?? []) as typeof payments;
  }

  const totalExpected = payments.reduce(
    (sum, row) => sum + Number(row.expected_amount ?? row.amount ?? 0),
    0,
  );
  const totalPaid = payments.reduce(
    (sum, row) => sum + Number(row.paid_amount ?? 0),
    0,
  );
  const totalRemaining = Math.max(0, totalExpected - totalPaid);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
        <p className="text-sm font-black text-white/70">المستحقات</p>
        <h1 className="mt-2 text-2xl font-black">المدفوعات وحالة البنك</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
          تابعي المستحقات المسجلة لكل حملة. بيانات البنك تظهر مقنّعة داخل حسابك،
          ولا تظهر كاملة إلا للإدارة المالية.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="إجمالي المستحق" value={`${money(totalExpected)} ر.س`} />
        <Metric label="تم دفعه" value={`${money(totalPaid)} ر.س`} />
        <Metric label="المتبقي" value={`${money(totalRemaining)} ر.س`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#9F6EB8]">الملف المالي</p>
              <h2 className="mt-1 text-xl font-black">بيانات البنك المقنّعة</h2>
            </div>
            <StatusBadge status={financial?.bank_profile_status ?? "incomplete"} />
          </div>

          <div className="mt-5 space-y-4 rounded-2xl bg-[#FCF9FD] p-5">
            <Info label="اسم البنك" value={financial?.bank_name || "غير مضاف"} />
            <Info
              label="صاحب الحساب"
              value={maskName(financial?.account_holder_name ?? null)}
            />
            <Info
              label="الآيبان"
              value={maskIban(financial?.iban ?? null, financial?.iban_last4 ?? null)}
              ltr
            />
            <Info
              label="تأكيد المؤثر"
              value={financial?.influencer_confirmed_at ? "تم التأكيد" : "بانتظار التأكيد"}
            />
            <Info
              label="مراجعة المالية"
              value={financial?.finance_reviewed_at ? "تمت المراجعة" : "بانتظار المراجعة"}
            />
          </div>

          {financial?.finance_review_notes ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800">
              {financial.finance_review_notes}
            </div>
          ) : null}

          <Link
            href="/portal/profile/payment-details"
            className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-[#9A68B5] px-5 py-3 text-sm font-black text-white"
          >
            تأكيد أو تحديث بيانات البنك
          </Link>
        </div>

        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <p className="text-sm font-bold text-[#9F6EB8]">سجل المستحقات</p>
          <h2 className="mt-1 text-xl font-black">الحملات والمدفوعات</h2>

          <div className="mt-5 space-y-3">
            {payments.length === 0 ? (
              <Empty text="لا توجد مستحقات مسجلة حاليًا." />
            ) : (
              payments.map((payment) => {
                const campaign = campaignByAssignment.get(payment.assignment_id);
                const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
                const paid = Number(payment.paid_amount ?? 0);
                return (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-[#F3EDF7] bg-[#FEFCFF] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-[#4A315C]">
                          {campaign?.name ?? "حملة"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#8D7C94]">
                          {campaign?.brand ?? "دار الأميرات"} · {typeLabel(payment.type)}
                        </p>
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Mini label="المستحق" value={`${money(expected)} ر.س`} />
                      <Mini label="المدفوع" value={`${money(paid)} ر.س`} />
                      <Mini label="المتبقي" value={`${money(Math.max(0, expected - paid))} ر.س`} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_14px_40px_rgba(68,82,140,0.08)]">
      <p className="text-sm text-[#7D86A1]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#3D274F]">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold text-[#94839C]">{label}</span>
      <span className="text-sm font-black text-[#5C456B]" dir={ltr ? "ltr" : "rtl"}>
        {value}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-[11px] font-bold text-[#929AB4]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#5C456B]">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#EADFF0] bg-[#FDFBFE] px-4 py-10 text-center text-sm text-[#8C7B94]">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    incomplete: "غير مكتملة",
    needs_confirmation: "بانتظار التأكيد",
    pending_review: "بانتظار المالية",
    approved: "معتمدة",
    update_pending: "تحديث قيد المراجعة",
    rejected: "مطلوب تحديث",
    draft: "مسودة",
    awaiting_approval: "بانتظار الاعتماد",
    ready_for_finance: "جاهز للمالية",
    partially_paid: "مدفوع جزئيًا",
    paid: "تم الدفع",
    cancelled: "ملغي",
  };
  const positive = ["approved", "paid"].includes(status);
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-black ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function maskIban(value: string | null, fallbackLast4: string | null) {
  const clean = String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const last4 = clean.slice(-4) || fallbackLast4 || "••••";
  return `SA•• •••• •••• •••• ••${last4}`;
}

function maskName(value: string | null) {
  if (!value?.trim()) return "غير مضاف";
  return value
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0)}${"•".repeat(Math.min(5, Math.max(1, part.length - 1)))}`)
    .join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(value);
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    bank_transfer: "تحويل بنكي",
    voucher: "قسيمة",
    product: "منتجات",
    commission: "عمولة",
    other: "مقابل آخر",
  };
  return labels[value] ?? value;
}
