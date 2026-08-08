import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { markTransferItemFailed, reviewPaymentBatch, saveTransferProof, submitBatchForReview, updateBatchExecutionStatus } from "../actions";

export const dynamic = "force-dynamic";

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(value);
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
}

const labels: Record<string, string> = {
  draft: "مسودة",
  under_review: "بانتظار مراجعة المسودة",
  approved: "معتمدة وجاهزة للتصدير",
  exported: "تم تجهيز الملفات",
  submitted_to_bank: "مرفوعة للبنك",
  processing: "قيد التنفيذ",
  completed: "مكتملة",
  returned: "معادة للتعديل",
  rejected: "مرفوضة",
};

export default async function PaymentBatchDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const session = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [{ data: batch, error }, { data: items }] = await Promise.all([
    admin.from("payment_batches").select("id,name,batch_code,month_label,scheduled_for,status,total_amount,item_count,bank_file_count,manual_count,created_by,submitted_by,submitted_at,reviewed_by,reviewed_at,review_notes,exported_at,submitted_to_bank_at,completed_at,created_at").eq("id", id).maybeSingle(),
    admin.from("payment_batch_items").select("id,payment_id,influencer_name,mobile,campaign_name,brand_name,bank_name,account_holder_name,iban,identity_type,identity_number,amount,contract_status,publication_url,transfer_method,manual_reason,item_status,failure_category,failure_reason,failed_at,bank_response_reference,proof_path,transfer_reference").eq("batch_id", id).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (!batch) notFound();

  const sameCreator = batch.created_by === session.user.id;
  const canReview = session.profile.role === "admin" || !sameCreator;
  const canExport = ["approved", "exported", "submitted_to_bank", "processing", "completed"].includes(batch.status);

  const errorMessages: Record<string, string> = {
    notes_required: "الملاحظة إلزامية عند الإرجاع أو الرفض.",
    separation_of_duties: "مجهز المسودة لا يستطيع اعتمادها بنفسه. استخدمي مراجعًا ماليًا آخر.",
    batch_not_under_review: "المجموعة ليست في حالة انتظار المراجعة.",
    failure_details_required: "سبب فشل التحويل وتصنيفه إلزاميان.",
    mark_failed_failed: "تعذر تسجيل فشل التحويل.",
    proof_required: "أدخل رابط أو مسار إثبات التحويل.",
  };

  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#5368C3,#91A0E5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">{batch.month_label}</p>
            <h1 className="mt-2 text-3xl font-black">{batch.name}</h1>
            <p className="mt-2 text-sm font-black text-white/72" dir="ltr">{batch.batch_code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/16 px-4 py-2 text-sm font-black ring-1 ring-white/20">{labels[batch.status] ?? batch.status}</span>
            <Link href="/dashboard/finance/transfers" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#5368C3]">العودة للمجموعات</Link>
          </div>
        </div>
      </section>

      {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{errorMessages[query.error] ?? "تعذر تنفيذ العملية."}</div> : null}
      {query.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">تم تنفيذ العملية بنجاح.</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="إجمالي المجموعة" value={money(num(batch.total_amount))} />
        <Stat label="عدد المستحقات" value={String(batch.item_count)} />
        <Stat label="ملف البنك" value={String(batch.bank_file_count)} />
        <Stat label="تحويل يدوي" value={String(batch.manual_count)} />
      </section>

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="grid gap-3 md:grid-cols-3">
          <Info label="تاريخ الإنشاء" value={date(batch.created_at)} />
          <Info label="تاريخ التحويل المتوقع" value={batch.scheduled_for ?? "—"} />
          <Info label="آخر مراجعة" value={date(batch.reviewed_at)} />
        </div>
        {batch.review_notes ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">ملاحظة المراجع: {batch.review_notes}</p> : null}
      </section>

      <section className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8A93AE]">تفاصيل المسودة</p>
            <h2 className="mt-1 text-xl font-black text-[#3D4D7D]">المستفيدون والتحويلات</h2>
          </div>
          {canExport ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/finance/payment-batches/${batch.id}/export?type=review`} className="rounded-xl bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">Excel المراجعة</a>
              <a href={`/api/finance/payment-batches/${batch.id}/export?type=bank`} className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">CSV البنك</a>
              <a href={`/api/finance/payment-batches/${batch.id}/export?type=manual`} className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">Excel اليدوي</a>
            </div>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E3E7F5]">
          <table className="min-w-[1300px] text-right text-sm">
            <thead className="bg-[#F4F6FD] text-xs font-black text-[#69769C]"><tr><th className="px-4 py-4">المؤثر</th><th className="px-4 py-4">الحملة والبراند</th><th className="px-4 py-4">المبلغ</th><th className="px-4 py-4">البنك</th><th className="px-4 py-4">الآيبان</th><th className="px-4 py-4">الهوية/الإقامة/السجل</th><th className="px-4 py-4">التعاقد</th><th className="px-4 py-4">النشر</th><th className="px-4 py-4">النوع</th><th className="px-4 py-4">الحالة والإثبات</th><th className="px-4 py-4">فشل التحويل</th></tr></thead>
            <tbody className="divide-y divide-[#EEF0F7]">
              {(items ?? []).map((item) => (
                <tr key={item.id} className="text-[#485985]">
                  <td className="px-4 py-4"><p className="font-black">{item.influencer_name}</p><p className="mt-1 text-xs text-[#939BB2]" dir="ltr">{item.mobile}</p></td>
                  <td className="px-4 py-4"><p className="font-black">{item.campaign_name}</p><p className="mt-1 text-xs text-[#939BB2]">{item.brand_name ?? "—"}</p></td>
                  <td className="px-4 py-4 font-black">{money(num(item.amount))}</td>
                  <td className="px-4 py-4"><p className="font-bold">{item.bank_name ?? "—"}</p><p className="mt-1 text-xs text-[#939BB2]">{item.account_holder_name ?? "—"}</p></td>
                  <td className="px-4 py-4 font-bold" dir="ltr">{item.iban ?? "—"}</td>
                  <td className="px-4 py-4"><p className="font-bold">{item.identity_number ?? "غير متوفر"}</p><p className="mt-1 text-xs text-[#939BB2]">{item.identity_type ?? "—"}</p></td>
                  <td className="px-4 py-4 font-bold">{item.contract_status === "approved" ? "معتمد" : item.contract_status === "not_required" ? "غير مطلوب" : "غير مكتمل"}</td>
                  <td className="px-4 py-4">{item.publication_url ? <a href={item.publication_url} target="_blank" rel="noreferrer" className="text-xs font-black text-[#596BC4]">فتح الرابط</a> : <span className="text-xs font-bold text-[#939BB2]">دفع مسبق/لا يوجد</span>}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${item.transfer_method === "manual" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.transfer_method === "manual" ? "يدوي" : "ملف البنك"}</span>{item.manual_reason ? <p className="mt-2 max-w-xs text-xs font-bold text-amber-700">{item.manual_reason}</p> : null}</td>
                  <td className="px-4 py-4"><p className="font-black">{item.item_status === "failed" ? "فشل التحويل" : item.item_status}</p>{item.proof_path ? <a href={item.proof_path} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black text-[#596BC4]">فتح الإثبات</a> : <form action={saveTransferProof} className="mt-2 space-y-2"><input type="hidden" name="batch_id" value={batch.id}/><input type="hidden" name="item_id" value={item.id}/><input name="proof_path" placeholder="رابط/مسار الإثبات" className="w-44 rounded-lg border border-[#DDE2F2] p-2 text-xs"/><input name="transfer_reference" placeholder="مرجع التحويل" className="w-44 rounded-lg border border-[#DDE2F2] p-2 text-xs"/><button className="block rounded-lg bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">حفظ الإثبات</button></form>}</td>
                  <td className="px-4 py-4">{item.item_status === "failed" ? <div className="max-w-xs"><p className="font-black text-rose-700">{item.failure_reason}</p><p className="mt-1 text-xs">{item.bank_response_reference ?? "—"}</p></div> : batch.status === "processing" || batch.status === "submitted_to_bank" ? <form action={markTransferItemFailed} className="w-56 space-y-2"><input type="hidden" name="batch_id" value={batch.id}/><input type="hidden" name="item_id" value={item.id}/><select name="failure_category" className="w-full rounded-lg border border-[#DDE2F2] p-2 text-xs font-bold"><option value="">تصنيف الفشل</option><option value="bank_data">بيانات بنكية</option><option value="beneficiary_rejected">رفض المستفيد</option><option value="bank_rejected">رفض البنك</option><option value="technical">مشكلة تقنية</option><option value="other">أخرى</option></select><input name="bank_response_reference" placeholder="مرجع البنك" className="w-full rounded-lg border border-[#DDE2F2] p-2 text-xs"/><textarea name="failure_reason" placeholder="سبب الفشل" rows={2} className="w-full rounded-lg border border-[#DDE2F2] p-2 text-xs"/><button className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white">تسجيل كمرتجع</button></form> : <span className="text-xs font-bold text-[#939BB2]">بعد الرفع للبنك</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
          <h2 className="text-xl font-black text-[#3D4D7D]">مراجعة واعتماد المسودة</h2>
          {batch.status === "draft" || batch.status === "returned" ? (
            <form action={submitBatchForReview} className="mt-5">
              <input type="hidden" name="batch_id" value={batch.id} />
              <button className="w-full rounded-xl bg-[#596BC4] px-5 py-3 text-sm font-black text-white">إرسال المسودة للمراجعة</button>
            </form>
          ) : null}

          {batch.status === "under_review" ? (
            <form action={reviewPaymentBatch} className="mt-5 space-y-3">
              <input type="hidden" name="batch_id" value={batch.id} />
              <textarea name="notes" rows={3} placeholder="ملاحظة الإرجاع أو الرفض" className="w-full rounded-xl border border-[#DDE2F2] p-3 text-sm font-bold outline-none" />
              {!canReview ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-black text-amber-800">أنت جهزت هذه المسودة؛ يجب أن يعتمدها مراجع مالي آخر.</p> : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <button disabled={!canReview} name="decision" value="approve" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">اعتماد</button>
                <button disabled={!canReview} name="decision" value="return" className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40">إرجاع</button>
                <button disabled={!canReview} name="decision" value="reject" className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">رفض</button>
              </div>
            </form>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
          <h2 className="text-xl font-black text-[#3D4D7D]">حالة تنفيذ المجموعة</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-[#7E88A8]">بعد تجهيز الملفات، حدّثي حالة الرفع للبنك والتنفيذ. الإكمال يغلق المستحقات داخل المجموعة.</p>
          <form action={updateBatchExecutionStatus} className="mt-5 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="batch_id" value={batch.id} />
            <button disabled={!canExport} name="action" value="mark_exported" className="rounded-xl bg-[#EEF1FF] px-4 py-3 text-sm font-black text-[#596BC4] disabled:opacity-40">تم تجهيز الملفات</button>
            <button disabled={!canExport} name="action" value="submit_to_bank" className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">تم الرفع للبنك</button>
            <button disabled={!canExport} name="action" value="mark_processing" className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40">قيد التنفيذ</button>
            <button disabled={!canExport} name="action" value="complete" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">إكمال المجموعة</button>
          </form>
        </article>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_14px_40px_rgba(67,82,155,.08)]"><p className="text-xs font-black text-[#8A93AE]">{label}</p><p className="mt-3 text-2xl font-black text-[#344578]">{value}</p></article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#F6F7FC] p-4"><p className="text-xs font-black text-[#929AB1]">{label}</p><p className="mt-2 text-sm font-black text-[#4B5B87]">{value}</p></div>;
}
