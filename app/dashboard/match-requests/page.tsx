import Link from "next/link";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";

export const dynamic = "force-dynamic";

const copy = {
  ar: {
    title: "طلبات مطابقة الأرشيف",
    subtitle: "كل تسجيل جديد يُعامل كطلب مستقل. النظام يقترح التطابق فقط، والقرار النهائي للمدير قبل إنشاء أو ربط ملف المؤثر.",
    back: "العودة للمؤثرين",
    name: "التسجيل الجديد",
    mobile: "الجوال",
    email: "البريد",
    candidates: "احتمالات المطابقة",
    strongest: "أقوى نتيجة",
    created: "التاريخ",
    action: "الإجراء",
    review: "مراجعة المطابقة",
    empty: "لا توجد طلبات مطابقة معلقة.",
  },
  en: {
    title: "Archive match requests",
    subtitle: "Every registration is treated as a fresh submission. The system only proposes matches; the admin makes the final identity decision before linking or creating a creator profile.",
    back: "Back to influencers",
    name: "New registration",
    mobile: "Mobile",
    email: "Email",
    candidates: "Match candidates",
    strongest: "Top score",
    created: "Created",
    action: "Action",
    review: "Review match",
    empty: "No pending archive match requests.",
  },
};

export default async function MatchRequestsPage() {
  const { supabase } = await requireRole(["admin"]);
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const t = copy[locale];

  const { data: submissions } = await supabase
    .from("influencer_registration_submissions")
    .select("id,normalized_mobile,requested_email,payload,match_summary,created_at,status")
    .eq("status", "awaiting_admin_review")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <section>
        <Link href="/dashboard/influencers" className="text-sm font-extrabold text-[#6071C3]">← {t.back}</Link>
        <h1 className="mt-3 text-3xl font-black text-[#3D274F]">{t.title}</h1>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-7 text-[#858EA6]">{t.subtitle}</p>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/90 bg-white shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        {(submissions ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-[#FAF6FC] text-[#66739D]"><tr>
                {[t.name,t.mobile,t.email,t.candidates,t.strongest,t.created,t.action].map((h)=><th key={h} className="p-4 text-start text-xs font-black">{h}</th>)}
              </tr></thead>
              <tbody>{(submissions ?? []).map((s:any)=>{
                const influencer = s.payload?.influencer ?? {};
                return <tr key={s.id} className="border-t border-[#EEF1F8]">
                  <td className="p-4 font-black text-[#432A57]">{influencer.fullName || "—"}</td>
                  <td dir="ltr" className="p-4 text-start font-bold">+{s.normalized_mobile}</td>
                  <td dir="ltr" className="p-4 text-start">{s.requested_email}</td>
                  <td className="p-4 font-black">{s.match_summary?.candidates ?? "—"}</td>
                  <td className="p-4 font-black text-[#8C5BA5]">{s.match_summary?.strongestScore ?? "—"}</td>
                  <td className="p-4">{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA", { dateStyle:"medium", timeStyle:"short" }).format(new Date(s.created_at))}</td>
                  <td className="p-4"><Link href={`/dashboard/match-requests/${s.id}`} className="rounded-xl bg-[#8C5BA5] px-4 py-2 text-xs font-black text-white">{t.review}</Link></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <div className="p-14 text-center text-sm font-bold text-[#9299AE]">{t.empty}</div>}
      </section>
    </main>
  );
}
