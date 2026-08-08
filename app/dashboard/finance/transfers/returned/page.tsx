import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryFailedTransfer } from "../actions";

export const dynamic = "force-dynamic";

function money(value: number | string | null) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(Number(value ?? 0));
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)) : "—";
}
const categories: Record<string,string> = { bank_data: "بيانات بنكية", beneficiary_rejected: "رفض المستفيد", bank_rejected: "رفض البنك", technical: "مشكلة تقنية", other: "أخرى" };

export default async function ReturnedTransfersPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requireRole(["admin", "finance"]);
  const query = (await searchParams) ?? {};
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("failed_transfer_items").select("*").order("failed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const messages: Record<string,string> = {
    not_retryable: "تمت إعادة هذه العملية سابقًا أو يوجد تحويل جديد نشط لها.",
    bank_profile_not_approved: "يجب اعتماد البيانات البنكية الجديدة قبل إعادة التحويل.",
    invalid_item: "تعذر تحديد عملية التحويل.",
  };
  return <div dir="rtl" className="space-y-6">
    <section className="rounded-[30px] bg-[linear-gradient(135deg,#A94D63,#D7899C)] p-7 text-white shadow-[0_24px_64px_rgba(150,60,85,.2)]">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black text-white/70">متابعة الاستثناءات البنكية</p><h1 className="mt-2 text-3xl font-black">التحويلات المرتجعة</h1><p className="mt-3 text-sm font-bold text-white/85">الاحتفاظ بالمحاولة السابقة، تصحيح سبب الرفض، ثم إنشاء مسودة إعادة تحويل مستقلة.</p></div><Link href="/dashboard/finance/transfers" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#A94D63]">العودة للتحويلات</Link></div>
    </section>
    {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{messages[query.error] ?? "تعذر تنفيذ العملية."}</div> : null}
    <section className="overflow-x-auto rounded-[28px] border border-[#E1E6F5] bg-white shadow-[0_16px_48px_rgba(67,82,155,.07)]">
      <table className="min-w-[1400px] text-right text-sm"><thead className="bg-[#F7F1F3] text-xs font-black text-[#7B5963]"><tr><th className="px-4 py-4">المؤثر</th><th className="px-4 py-4">الحملة</th><th className="px-4 py-4">المبلغ</th><th className="px-4 py-4">المجموعة السابقة</th><th className="px-4 py-4">سبب الفشل</th><th className="px-4 py-4">بيانات البنك</th><th className="px-4 py-4">طلب التحديث</th><th className="px-4 py-4">الإجراء</th></tr></thead>
      <tbody className="divide-y divide-[#F1E7EA]">{(rows ?? []).map((row) => <tr key={row.batch_item_id} className="text-[#4F5367]"><td className="px-4 py-4"><p className="font-black">{row.influencer_name}</p><p dir="ltr" className="mt-1 text-xs text-[#9296A8]">{row.mobile}</p></td><td className="px-4 py-4"><p className="font-black">{row.campaign_name}</p><p className="text-xs text-[#9296A8]">{row.brand_name ?? "—"}</p></td><td className="px-4 py-4 font-black">{money(row.amount)}</td><td className="px-4 py-4"><Link className="font-black text-[#596BC4]" href={`/dashboard/finance/transfers/${row.batch_id}`}>{row.batch_code}</Link><p className="mt-1 text-xs">{date(row.failed_at)}</p></td><td className="px-4 py-4"><p className="font-black text-rose-700">{categories[row.failure_category] ?? row.failure_category}</p><p className="mt-1 max-w-xs text-xs font-bold">{row.failure_reason}</p></td><td className="px-4 py-4"><p className="font-bold">{row.bank_name ?? "—"}</p><p dir="ltr" className="mt-1 text-xs">{row.iban ?? "—"}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${row.bank_profile_status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.bank_profile_status === "approved" ? "معتمدة" : "تحتاج اعتماد"}</span></td><td className="px-4 py-4 font-bold">{row.bank_update_status ?? "لا يوجد"}</td><td className="px-4 py-4">{row.can_retry ? <form action={retryFailedTransfer}><input type="hidden" name="failed_item_id" value={row.batch_item_id}/><button className="rounded-xl bg-[#A94D63] px-4 py-2 text-xs font-black text-white">إعادة للتحويل</button></form> : <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">تمت الإعادة</span>}</td></tr>)}</tbody></table>
      {(rows ?? []).length === 0 ? <div className="p-10 text-center text-sm font-black text-[#8A93AE]">لا توجد تحويلات مرتجعة.</div> : null}
    </section>
  </div>;
}
