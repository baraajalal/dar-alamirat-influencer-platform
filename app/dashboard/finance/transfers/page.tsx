import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentBatch } from "./actions";

export const dynamic = "force-dynamic";

type Payment = { id: string; assignment_id: string; compensation_id: string | null; expected_amount: number | string | null; amount: number | string | null; paid_amount: number | string | null; effective_amount: number | string | null; remaining_amount: number | string | null; transfer_method: string | null; manual_transfer_reason: string | null; ready_for_batch_at: string | null };
type Assignment = { id: string; influencer_id: string; campaign_id: string };
type Influencer = { id: string; full_name: string; mobile_e164: string };
type Campaign = { id: string; name: string; brand: string | null };

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "مسودة",
    under_review: "بانتظار مراجعة المسودة",
    approved: "معتمدة",
    exported: "تم تجهيز الملفات",
    submitted_to_bank: "مرفوعة للبنك",
    processing: "قيد التنفيذ",
    completed: "مكتملة",
    returned: "معادة للتعديل",
    rejected: "مرفوضة",
    cancelled: "ملغاة",
  };
  return labels[status] ?? status;
}

export default async function FinancialTransfersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const params = (await searchParams) ?? {};
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [{ data: paymentRows }, { data: batches }] = await Promise.all([
    admin.from("finance_transfer_candidates").select("id,assignment_id,compensation_id,expected_amount,amount,paid_amount,effective_amount,remaining_amount,transfer_method,manual_transfer_reason,ready_for_batch_at").eq("type", "bank_transfer").eq("finance_review_status", "approved").eq("status", "ready_for_finance").order("ready_for_batch_at", { ascending: true }).limit(1000),
    admin.from("payment_batches").select("id,name,batch_code,month_label,scheduled_for,status,total_amount,item_count,bank_file_count,manual_count,created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const payments = (paymentRows ?? []) as Payment[];
  const { data: groupedRows } = payments.length
    ? await admin.from("payment_batch_items").select("payment_id").in("payment_id", payments.map((row) => row.id)).neq("item_status", "cancelled")
    : { data: [] };
  const grouped = new Set((groupedRows ?? []).map((row) => row.payment_id));
  const readyPayments = payments.filter((row) => !grouped.has(row.id));

  const assignmentIds = [...new Set(readyPayments.map((row) => row.assignment_id))];
  const { data: assignmentRows } = assignmentIds.length
    ? await admin.from("campaign_assignments").select("id,influencer_id,campaign_id").in("id", assignmentIds)
    : { data: [] };
  const assignments = (assignmentRows ?? []) as Assignment[];
  const assignmentMap = new Map(assignments.map((row) => [row.id, row]));
  const influencerIds = [...new Set(assignments.map((row) => row.influencer_id))];
  const campaignIds = [...new Set(assignments.map((row) => row.campaign_id))];
  const [{ data: influencerRows }, { data: campaignRows }] = await Promise.all([
    influencerIds.length ? admin.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds) : Promise.resolve({ data: [] }),
    campaignIds.length ? admin.from("campaigns").select("id,name,brand").in("id", campaignIds) : Promise.resolve({ data: [] }),
  ]);
  const influencerMap = new Map(((influencerRows ?? []) as Influencer[]).map((row) => [row.id, row]));
  const campaignMap = new Map(((campaignRows ?? []) as Campaign[]).map((row) => [row.id, row]));

  const errorMessages: Record<string, string> = {
    invalid_batch: "راجعي اسم المجموعة ورقمها والشهر وحددي مستحقًا واحدًا على الأقل.",
    payments_not_ready: "بعض المستحقات لم تعد جاهزة للتجميع.",
    batch_code_exists: "رقم المجموعة مستخدم مسبقًا.",
    payment_already_grouped: "أحد المستحقات موجود داخل مجموعة أخرى.",
  };

  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#5368C3,#91A0E5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">المرحلة الثانية</p>
            <h1 className="mt-2 text-3xl font-black">التحويلات المالية</h1>
            <p className="mt-3 text-sm font-bold leading-7 text-white/82">جمّعي المستحقات المعتمدة في مسودة، راجعيها مرة ثانية، ثم جهزي ملف البنك وملف التحويل اليدوي.</p>
          </div>
          <Link href="/dashboard/finance" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للقسم المالي</Link>
        </div>
      </section>

      {params.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{errorMessages[params.error] ?? "تعذر تنفيذ العملية."}</div> : null}

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8A93AE]">جاهزة للتجميع</p>
            <h2 className="mt-1 text-xl font-black text-[#3D4D7D]">إنشاء مسودة تحويل جديدة</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">{readyPayments.length} مستحق</span>
        </div>

        <form action={createPaymentBatch} className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-black text-[#68749A]">اسم المجموعة<input name="name" required placeholder="تحويلات الأسبوع الأول" className="mt-2 w-full rounded-xl border border-[#DDE2F2] px-4 py-3 text-sm font-bold outline-none" /></label>
            <label className="text-xs font-black text-[#68749A]">رقم المجموعة<input name="batch_code" required placeholder="AUG-2026-W1" dir="ltr" className="mt-2 w-full rounded-xl border border-[#DDE2F2] px-4 py-3 text-sm font-bold outline-none" /></label>
            <label className="text-xs font-black text-[#68749A]">الشهر التابع للمجموعة<input name="month_label" required placeholder="أغسطس 2026" className="mt-2 w-full rounded-xl border border-[#DDE2F2] px-4 py-3 text-sm font-bold outline-none" /></label>
            <label className="text-xs font-black text-[#68749A]">تاريخ التحويل المتوقع<input name="scheduled_for" type="date" className="mt-2 w-full rounded-xl border border-[#DDE2F2] px-4 py-3 text-sm font-bold outline-none" /></label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E3E7F5]">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-[#F4F6FD] text-xs font-black text-[#69769C]">
                <tr>
                  <th className="px-4 py-4">تحديد</th>
                  <th className="px-4 py-4">المؤثر</th>
                  <th className="px-4 py-4">الحملة والبراند</th>
                  <th className="px-4 py-4">المبلغ</th>
                  <th className="px-4 py-4">طريقة التحويل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0F7]">
                {readyPayments.map((payment) => {
                  const assignment = assignmentMap.get(payment.assignment_id);
                  const influencer = assignment ? influencerMap.get(assignment.influencer_id) : undefined;
                  const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
                  const remaining = num(payment.remaining_amount) > 0
                    ? num(payment.remaining_amount)
                    : Math.max(0, firstPositiveAmount(payment.effective_amount, payment.expected_amount, payment.amount) - num(payment.paid_amount));
                  return (
                    <tr key={payment.id} className="text-[#485985]">
                      <td className="px-4 py-4"><input type="checkbox" name="payment_ids" value={payment.id} className="h-4 w-4" /></td>
                      <td className="px-4 py-4"><p className="font-black">{influencer?.full_name ?? "—"}</p><p className="mt-1 text-xs text-[#939BB2]" dir="ltr">{influencer?.mobile_e164 ?? "—"}</p></td>
                      <td className="px-4 py-4"><p className="font-black">{campaign?.name ?? "—"}</p><p className="mt-1 text-xs text-[#939BB2]">{campaign?.brand ?? "—"}</p></td>
                      <td className="px-4 py-4 font-black">{money(remaining)}</td>
                      <td className="px-4 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${payment.transfer_method === "manual" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{payment.transfer_method === "manual" ? "يدوي" : "ملف البنك"}</span>{payment.manual_transfer_reason ? <p className="mt-2 max-w-xs text-xs font-bold text-amber-700">{payment.manual_transfer_reason}</p> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {readyPayments.length === 0 ? <div className="p-8 text-center text-sm font-black text-[#8A93AE]">لا توجد مستحقات معتمدة جاهزة للتجميع.</div> : null}
          </div>

          <button disabled={readyPayments.length === 0} className="rounded-xl bg-[#596BC4] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">حفظ كمسودة جاهزة للمراجعة</button>
        </form>
      </section>

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8A93AE]">المجموعات المالية</p>
            <h2 className="mt-1 text-xl font-black text-[#3D4D7D]">مسودات ومجموعات التحويل</h2>
          </div>
          <span className="rounded-full bg-[#EEF1FF] px-4 py-2 text-sm font-black text-[#596BC4]">{batches?.length ?? 0}</span>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E3E7F5]">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-[#F4F6FD] text-xs font-black text-[#69769C]"><tr><th className="px-4 py-4">المجموعة</th><th className="px-4 py-4">الشهر</th><th className="px-4 py-4">الإجمالي</th><th className="px-4 py-4">البنك / يدوي</th><th className="px-4 py-4">الحالة</th><th className="px-4 py-4">الإجراء</th></tr></thead>
            <tbody className="divide-y divide-[#EEF0F7]">
              {(batches ?? []).map((batch) => (
                <tr key={batch.id} className="text-[#485985]">
                  <td className="px-4 py-4"><p className="font-black">{batch.name}</p><p className="mt-1 text-xs text-[#939BB2]" dir="ltr">{batch.batch_code}</p></td>
                  <td className="px-4 py-4 font-bold">{batch.month_label}</td>
                  <td className="px-4 py-4 font-black">{money(num(batch.total_amount))}</td>
                  <td className="px-4 py-4 font-bold">{batch.bank_file_count} / {batch.manual_count}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-[#F0F2FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">{statusLabel(batch.status)}</span></td>
                  <td className="px-4 py-4"><Link href={`/dashboard/finance/transfers/${batch.id}`} className="rounded-xl bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">فتح المسودة</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(batches ?? []).length === 0 ? <div className="p-8 text-center text-sm font-black text-[#8A93AE]">لم يتم إنشاء مجموعات تحويل بعد.</div> : null}
        </div>
      </section>
    </div>
  );
}
