import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FinanceApprovalsPage() {
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [{ count: bankCount }, { count: duesCount }] = await Promise.all([
    admin.from("influencer_financial_profiles").select("influencer_id", { count: "exact", head: true }).in("bank_profile_status", ["pending_review", "influencer_confirmed", "update_pending"]),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("type", "bank_transfer").in("finance_review_status", ["pending", "returned"]),
  ]);

  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#596BC4,#91A0E5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <p className="text-sm font-black text-white/70">المرحلة الأولى</p>
        <h1 className="mt-2 text-3xl font-black">الاعتمادات المالية</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-white/82">راجعي ملف البنك أولًا، ثم اعتمدي مستحق الإعلان أو أعيدي الملاحظة للمؤثر.</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Link href="/dashboard/finance/bank-profiles" className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.08)] transition hover:-translate-y-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#8A93AE]">الملفات البنكية</p>
              <h2 className="mt-2 text-2xl font-black text-[#3D4D7D]">اعتماد بيانات البنك</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-[#7E88A8]">الآيبان، اسم الحساب، الهوية أو الإقامة أو السجل التجاري، وشهادة الآيبان.</p>
            </div>
            <span className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-[#EEF1FF] text-2xl font-black text-[#596BC4]">{bankCount ?? 0}</span>
          </div>
        </Link>

        <Link href="/dashboard/finance/ad-approvals" className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.08)] transition hover:-translate-y-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#8A93AE]">مستحقات الإعلانات</p>
              <h2 className="mt-2 text-2xl font-black text-[#3D4D7D]">اعتماد التحويل</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-[#7E88A8]">رابط النشر المعتمد أو عقد الدفع المسبق، المبلغ، وحالة بيانات البنك.</p>
            </div>
            <span className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-700">{duesCount ?? 0}</span>
          </div>
        </Link>
      </section>
    </div>
  );
}
