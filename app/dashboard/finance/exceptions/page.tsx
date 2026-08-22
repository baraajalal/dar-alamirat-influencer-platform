import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  zero_amount: "مبلغ صفر",
  bank_profile_not_ready: "بيانات بنكية",
  overpaid: "دفع زائد",
  voucher_ready_without_code: "قسيمة بلا كود",
  voucher_expired_unsent: "قسيمة منتهية",
  approved_stale: "تأخر التنفيذ",
  paid_state_mismatch: "عدم تطابق الحالة",
};

const severity: Record<string, string> = {
  critical: "bg-[#FFE8EA] text-[#B42332]",
  high: "bg-[#FFF0F0] text-[#B64F55]",
  medium: "bg-[#FFF7DF] text-[#A66B16]",
};

export default async function FinanceExceptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["admin", "finance"]);
  const params = await searchParams;
  const type = typeof params.type === "string" ? params.type : "all";
  const admin = createAdminClient();
  const { data, error } = await admin.from("finance_exceptions").select("exception_id,payment_id,assignment_id,influencer_name,mobile,campaign_name,exception_type,severity,title,details,detected_from").order("detected_from", { ascending: true }).limit(1000);
  if (error) throw new Error(error.message);
  const allRows = data ?? [];
  const rows = type === "all" ? allRows : allRows.filter((row) => row.exception_type === type);
  const counts = allRows.reduce<Record<string, number>>((acc, row) => { acc[row.exception_type] = (acc[row.exception_type] ?? 0) + 1; return acc; }, {});

  return <div dir="inherit" className="space-y-6">
    <section className="rounded-[30px] bg-[linear-gradient(135deg,#8B5666,#C7808D)] p-7 text-white shadow-[0_24px_64px_rgba(120,65,83,.20)]">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black text-white/70">رقابة استباقية</p><h1 className="mt-2 text-3xl font-black">مشكلات تحتاج معالجة</h1><p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/82">كشف تلقائي للمبالغ الصفرية، البيانات البنكية الناقصة، القسائم المتأخرة، الدفع الزائد، وعدم تطابق حالات التنفيذ.</p></div><Link href="/dashboard/finance" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للقسم المالي</Link></div>
    </section>

    <section className="flex flex-wrap gap-2 rounded-[24px] border border-[#F0E7F4] bg-white p-4 shadow-sm">
      <Link href="?type=all" className={`rounded-full px-4 py-2 text-xs font-black ${type === "all" ? "bg-[#9566AF] text-white" : "bg-[#F1F3FA] text-[#66739A]"}`}>الكل ({allRows.length})</Link>
      {Object.entries(labels).map(([key, label]) => <Link key={key} href={`?type=${key}`} className={`rounded-full px-4 py-2 text-xs font-black ${type === key ? "bg-[#9566AF] text-white" : "bg-[#F1F3FA] text-[#66739A]"}`}>{label} ({counts[key] ?? 0})</Link>)}
    </section>

    <section className="space-y-3">
      {rows.map((row) => <article key={row.exception_id} className="rounded-[24px] border border-[#F1EAF5] bg-white p-5 shadow-[0_12px_34px_rgba(67,82,155,.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${severity[row.severity] ?? "bg-[#F1F3FA] text-[#66739A]"}`}>{labels[row.exception_type] ?? row.exception_type}</span><h2 className="text-base font-black text-[#4F3762]">{row.title}</h2></div><p className="mt-2 text-sm font-bold leading-7 text-[#82718C]">{row.details}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-[#8D7B95]"><span>{row.influencer_name}</span><span dir="ltr">{row.mobile}</span><span>{row.campaign_name}</span><span>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(row.detected_from))}</span></div></div><div className="flex gap-2"><Link href="/dashboard/finance/settlements?status=issues" className="rounded-xl bg-[#F7F0FA] px-4 py-2 text-xs font-black text-[#9362AD]">فتح التسويات</Link>{row.exception_type === "bank_profile_not_ready" ? <Link href="/dashboard/finance/bank-profiles" className="rounded-xl bg-[#FAF6FC] px-4 py-2 text-xs font-black text-[#9362AD]">ملفات البنك</Link> : null}</div></div>
      </article>)}
      {rows.length === 0 ? <div className="rounded-[24px] border border-[#DDEDE6] bg-[#F1FBF6] p-10 text-center text-sm font-black text-[#238364]">لا توجد مشكلات من هذا النوع حاليًا.</div> : null}
    </section>
  </div>;
}
