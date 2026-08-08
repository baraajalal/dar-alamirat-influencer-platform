/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositiveAmount(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    const parsed = num(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(value);
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "مسودة",
    under_review: "بانتظار المراجعة",
    approved: "معتمدة",
    exported: "تم تجهيز الملفات",
    submitted_to_bank: "مرفوعة للبنك",
    processing: "قيد التنفيذ",
    completed: "مكتملة",
    returned: "معادة",
    rejected: "مرفوضة",
  };
  return labels[value] ?? value;
}

export default async function FinanceReportsPage() {
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [{ data: payments }, { data: batches }, { data: vouchers }, { data: staffPerformance }, { count: failedCount }, { count: alertCount }] = await Promise.all([
    admin.from("payments").select("id,assignment_id,compensation_id,type,status,expected_amount,amount,paid_amount,finance_review_status,due_at,created_at").limit(5000),
    admin.from("payment_batches").select("id,name,batch_code,month_label,status,total_amount,item_count,bank_file_count,manual_count,scheduled_for,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("voucher_issues").select("id,amount,status,source_type").limit(5000),
    admin.from("finance_staff_performance").select("*").order("transferred_amount", { ascending: false }),
    admin.from("failed_transfer_items").select("batch_item_id", { count: "exact", head: true }),
    admin.from("finance_alerts").select("entity_id", { count: "exact", head: true }),
  ]);

  const paymentRows = payments ?? [];
  const paymentAssignmentIds = [...new Set(paymentRows.map((row) => row.assignment_id).filter(Boolean))];
  const { data: compensationRows } = paymentAssignmentIds.length
    ? await admin.from("assignment_compensations").select("id,assignment_id,type,amount").in("assignment_id", paymentAssignmentIds)
    : { data: [] };
  const compensationById = new Map((compensationRows ?? []).map((row) => [row.id, row]));
  const compensationByAssignmentAndType = new Map(
    (compensationRows ?? []).map((row) => [`${row.assignment_id}:${row.type}`, row]),
  );
  const paymentExpectedAmount = (row: (typeof paymentRows)[number]) => {
    const compensation =
      (row.compensation_id ? compensationById.get(row.compensation_id) : undefined) ??
      compensationByAssignmentAndType.get(`${row.assignment_id}:${row.type}`);
    return firstPositiveAmount(row.expected_amount, row.amount, compensation?.amount);
  };

  const expected = paymentRows.reduce((sum, row) => sum + paymentExpectedAmount(row), 0);
  const paid = paymentRows.reduce((sum, row) => sum + num(row.paid_amount), 0);
  const remaining = Math.max(0, expected - paid);
  const approvedReady = paymentRows
    .filter((row) => row.finance_review_status === "approved" && row.status === "ready_for_finance")
    .reduce((sum, row) => sum + Math.max(0, paymentExpectedAmount(row) - num(row.paid_amount)), 0);
  const delayed = paymentRows.filter((row) => row.due_at && new Date(row.due_at).getTime() < new Date().getTime() && !["paid", "cancelled"].includes(row.status)).length;
  const voucherValue = (vouchers ?? []).reduce((sum, row) => sum + num(row.amount), 0);
  const completedBatches = (batches ?? []).filter((row) => row.status === "completed").reduce((sum, row) => sum + num(row.total_amount), 0);

  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#5368C3,#91A0E5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">عرض فقط</p>
            <h1 className="mt-2 text-3xl font-black">التقرير المالي العام</h1>
            <p className="mt-3 text-sm font-bold leading-7 text-white/82">الموقف المالي، المجموعات المعتمدة والمرفوعة للبنك، التحويلات اليدوية، والقسائم.</p>
          </div>
          <Link href="/dashboard/finance" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للقسم المالي</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="إجمالي المستحق" value={money(expected)} />
        <Stat label="إجمالي المدفوع" value={money(paid)} />
        <Stat label="المتبقي" value={money(remaining)} />
        <Stat label="جاهز للتجميع" value={money(approvedReady)} />
        <Stat label="مجموعات مكتملة" value={money(completedBatches)} />
        <Stat label="قيمة القسائم" value={money(voucherValue)} />
        <Stat label="مستحقات متأخرة" value={String(delayed)} />
        <Stat label="عدد المجموعات" value={String(batches?.length ?? 0)} />
        <Stat label="تحويلات مرتجعة" value={String(failedCount ?? 0)} />
        <Stat label="تنبيهات متأخرة" value={String(alertCount ?? 0)} />
      </section>

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div><p className="text-xs font-black text-[#8A93AE]">الشهر الحالي</p><h2 className="mt-1 text-xl font-black text-[#3D4D7D]">أداء الفريق المالي</h2></div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E3E7F5]"><table className="min-w-[1000px] text-right text-sm"><thead className="bg-[#F4F6FD] text-xs font-black text-[#69769C]"><tr><th className="px-4 py-4">الموظف</th><th className="px-4 py-4">المجموعات المنشأة</th><th className="px-4 py-4">المكتملة</th><th className="px-4 py-4">المراجعات</th><th className="px-4 py-4">التحويلات</th><th className="px-4 py-4">قيمة التحويل</th><th className="px-4 py-4">متوسط الإكمال</th><th className="px-4 py-4">تسليم المنتجات</th></tr></thead><tbody className="divide-y divide-[#EEF0F7]">{(staffPerformance ?? []).map((row) => <tr key={row.profile_id} className="text-[#485985]"><td className="px-4 py-4 font-black">{row.full_name}</td><td className="px-4 py-4 font-bold">{row.batches_created}</td><td className="px-4 py-4 font-bold">{row.batches_completed}</td><td className="px-4 py-4 font-bold">{row.batches_reviewed}</td><td className="px-4 py-4 font-bold">{row.transfers_recorded}</td><td className="px-4 py-4 font-black">{money(num(row.transferred_amount))}</td><td className="px-4 py-4 font-bold">{num(row.avg_batch_hours)} ساعة</td><td className="px-4 py-4 font-bold">{row.products_completed}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8A93AE]">المجموعات المالية</p>
            <h2 className="mt-1 text-xl font-black text-[#3D4D7D]">آخر مجموعات التحويل</h2>
          </div>
          <Link href="/dashboard/finance/transfers" className="rounded-xl bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">فتح التحويلات</Link>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E3E7F5]">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-[#F4F6FD] text-xs font-black text-[#69769C]"><tr><th className="px-4 py-4">المجموعة</th><th className="px-4 py-4">الشهر</th><th className="px-4 py-4">الإجمالي</th><th className="px-4 py-4">العدد</th><th className="px-4 py-4">ملف البنك</th><th className="px-4 py-4">يدوي</th><th className="px-4 py-4">الحالة</th></tr></thead>
            <tbody className="divide-y divide-[#EEF0F7]">
              {(batches ?? []).slice(0, 20).map((batch) => (
                <tr key={batch.id} className="text-[#485985]">
                  <td className="px-4 py-4"><Link href={`/dashboard/finance/transfers/${batch.id}`} className="font-black text-[#596BC4]">{batch.name}</Link><p className="mt-1 text-xs text-[#939BB2]" dir="ltr">{batch.batch_code}</p></td>
                  <td className="px-4 py-4 font-bold">{batch.month_label}</td>
                  <td className="px-4 py-4 font-black">{money(num(batch.total_amount))}</td>
                  <td className="px-4 py-4 font-bold">{batch.item_count}</td>
                  <td className="px-4 py-4 font-bold">{batch.bank_file_count}</td>
                  <td className="px-4 py-4 font-bold">{batch.manual_count}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-[#F0F2FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">{statusLabel(batch.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(batches ?? []).length === 0 ? <div className="p-8 text-center text-sm font-black text-[#8A93AE]">لا توجد مجموعات تحويل بعد.</div> : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_14px_40px_rgba(67,82,155,.08)]"><p className="text-xs font-black text-[#8A93AE]">{label}</p><p className="mt-3 text-2xl font-black text-[#344578]">{value}</p></article>;
}
