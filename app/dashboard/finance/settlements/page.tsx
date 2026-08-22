import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshSettlement } from "./actions";

export const dynamic = "force-dynamic";

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(num(value));
}

function date(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function settlementLabel(row: { fully_settled: boolean | null; pending_approval_count: number; pending_execution_count: number; zero_amount_count: number }) {
  if (row.zero_amount_count > 0) return { label: "تحتاج معالجة", className: "bg-[#FFF0F0] text-[#B64F55]" };
  if (row.fully_settled) return { label: "مكتملة", className: "bg-[#E7F9F1] text-[#238364]" };
  if (row.pending_approval_count > 0) return { label: "بانتظار الاعتماد", className: "bg-[#FFF7DF] text-[#A66B16]" };
  if (row.pending_execution_count > 0) return { label: "قيد التنفيذ", className: "bg-[#F7F0FA] text-[#9362AD]" };
  return { label: "غير مكتملة", className: "bg-[#F2F3F7] text-[#6F7894]" };
}

function remainingDays(value: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["admin", "finance"]);
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "all";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assignment_financial_settlements")
    .select("assignment_id,influencer_name,mobile,campaign_name,brand_name,assignment_status,settled_at,availability_blocked_until,payment_count,expected_total,executed_total,remaining_total,zero_amount_count,pending_execution_count,pending_approval_count,fully_settled,last_financial_activity_at")
    .order("remaining_total", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row) => {
    const matchesSearch = !query || `${row.influencer_name} ${row.mobile} ${row.campaign_name} ${row.brand_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (status === "settled") return Boolean(row.fully_settled);
    if (status === "approval") return row.pending_approval_count > 0;
    if (status === "execution") return row.pending_execution_count > 0;
    if (status === "issues") return row.zero_amount_count > 0;
    return true;
  });

  const totals = (data ?? []).reduce((acc, row) => ({
    expected: acc.expected + num(row.expected_total),
    executed: acc.executed + num(row.executed_total),
    remaining: acc.remaining + num(row.remaining_total),
    settled: acc.settled + (row.fully_settled ? 1 : 0),
  }), { expected: 0, executed: 0, remaining: 0, settled: 0 });

  return (
    <div dir="inherit" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#9566AF,#C5A2D5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">الإقفال المالي الموحد</p>
            <h1 className="mt-2 text-3xl font-black">التسويات والمتابعة</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/82">مقارنة المتفق عليه بما تم تنفيذه فعليًا عبر التحويلات والقسائم والمنتجات، ثم إقفال التكليف وبدء مدة الحظر تلقائيًا.</p>
          </div>
          <Link href="/dashboard/finance" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للقسم المالي</Link>
        </div>
      </section>

      {params.success ? <div className="rounded-2xl bg-[#E7F9F1] px-5 py-4 text-sm font-black text-[#238364]">تمت مراجعة التسوية وتحديث حالة التكليف.</div> : null}
      {params.error ? <div className="rounded-2xl bg-[#FFF0F0] px-5 py-4 text-sm font-black text-[#B64F55]">تعذر تحديث التسوية. راجع بيانات المستحق وحاول مرة أخرى.</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="إجمالي المستحق" value={money(totals.expected)} />
        <Stat label="المنفذ فعليًا" value={money(totals.executed)} />
        <Stat label="المتبقي" value={money(totals.remaining)} />
        <Stat label="تكليفات مكتملة" value={String(totals.settled)} />
      </section>

      <section className="rounded-[26px] border border-[#F0E7F4] bg-white p-5 shadow-[0_14px_42px_rgba(67,82,155,.07)]">
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1 text-xs font-black text-[#715F7D]">بحث
            <input name="q" defaultValue={query} placeholder="اسم المؤثر، الجوال أو الحملة" className="mt-2 w-full rounded-2xl border border-[#DDE3F3] px-4 py-3 text-sm font-bold outline-none focus:border-[#7182D3]" />
          </label>
          <label className="min-w-[210px] text-xs font-black text-[#715F7D]">حالة التسوية
            <select name="status" defaultValue={status} className="mt-2 w-full rounded-2xl border border-[#DDE3F3] bg-white px-4 py-3 text-sm font-bold outline-none">
              <option value="all">الكل</option><option value="settled">مكتملة</option><option value="approval">بانتظار الاعتماد</option><option value="execution">قيد التنفيذ</option><option value="issues">تحتاج معالجة</option>
            </select>
          </label>
          <button className="rounded-2xl bg-[#9566AF] px-6 py-3 text-sm font-black text-white">تطبيق</button>
        </form>
      </section>

      <section className="overflow-x-auto rounded-[28px] border border-[#F0E7F4] bg-white shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <table className="min-w-[1180px] w-full text-right text-sm">
          <thead className="bg-[#FAF6FC] text-xs font-black text-[#715F7D]"><tr><th className="px-4 py-4">المؤثر</th><th className="px-4 py-4">الحملة</th><th className="px-4 py-4">وسائل المقابل</th><th className="px-4 py-4">المستحق</th><th className="px-4 py-4">المنفذ</th><th className="px-4 py-4">المتبقي</th><th className="px-4 py-4">الحالة</th><th className="px-4 py-4">الإقفال</th><th className="px-4 py-4">إجراء</th></tr></thead>
          <tbody className="divide-y divide-[#F5EFF7]">
            {rows.map((row) => {
              const badge = settlementLabel(row);
              return <tr key={row.assignment_id} className="text-[#604970]">
                <td className="px-4 py-4"><p className="font-black">{row.influencer_name}</p><p className="mt-1 text-xs text-[#8D7B95]" dir="ltr">{row.mobile}</p></td>
                <td className="px-4 py-4"><p className="font-black">{row.campaign_name}</p><p className="mt-1 text-xs text-[#8D7B95]">{row.brand_name ?? "—"}</p></td>
                <td className="px-4 py-4 font-black">{row.payment_count}</td>
                <td className="px-4 py-4 font-black">{money(row.expected_total)}</td>
                <td className="px-4 py-4 font-black text-[#238364]">{money(row.executed_total)}</td>
                <td className="px-4 py-4 font-black text-[#B46A32]">{money(row.remaining_total)}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${badge.className}`}>{badge.label}</span></td>
                <td className="px-4 py-4 text-xs font-bold"><p>{date(row.settled_at)}</p>{row.availability_blocked_until ? <><p className="mt-1 text-[#8D7B95]">الحظر حتى {date(row.availability_blocked_until)}</p><p className="mt-1 font-black text-amber-700">متبقي {remainingDays(row.availability_blocked_until)} يوم</p></> : null}</td>
                <td className="px-4 py-4"><form action={refreshSettlement}><input type="hidden" name="assignment_id" value={row.assignment_id} /><button className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#9362AD]">مراجعة وإقفال</button></form></td>
              </tr>;
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="p-10 text-center text-sm font-black text-[#8D7B95]">لا توجد نتائج مطابقة.</div> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_14px_40px_rgba(67,82,155,.08)]"><p className="text-xs font-black text-[#8D7B95]">{label}</p><p className="mt-3 text-2xl font-black text-[#4A315C]">{value}</p></article>;
}
