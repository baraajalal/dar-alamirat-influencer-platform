import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, supabase } = await requireRole(["admin", "coordinator", "finance"]);

  const [{ count: campaignCount }, { count: influencerCount }, { count: accessRequestCount }] = await Promise.all([
    supabase.from("campaigns").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("influencers").select("id", { count: "exact", head: true }),
    supabase.from("portal_access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <form action={logout}><button className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]">تسجيل الخروج</button></form>
          <div className="flex items-center gap-3"><div className="hidden text-left sm:block"><p className="text-sm font-black text-[#33447F]">{profile.full_name}</p><p className="text-xs text-[#8991AB]">{roleLabel(profile.role)}</p></div><div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#6877C8] p-2 shadow-[0_10px_25px_rgba(104,119,200,0.25)]"><Image src="/da-logo.png" alt="دار الأميرات" width={110} height={55} className="h-10 w-auto object-contain" priority /></div></div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1350px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6877C8_0%,#5A6BC1_52%,#8794DE_100%)] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.25)] sm:p-8"><span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">لوحة الإدارة</span><h1 className="mt-4 text-3xl font-black sm:text-4xl">أهلًا {profile.full_name}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">إدارة المؤثرين والحملات والمحتوى والمدفوعات من مساحة موحدة.</p></section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3"><Stat label="الحملات الحالية" value={campaignCount ?? 0} /><Stat label="ملفات المؤثرين" value={influencerCount ?? 0} /><Stat label="طلبات التفعيل" value={accessRequestCount ?? 0} /></section>

        <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard href="/dashboard/campaigns" number="01" title="إدارة الحملات" description="إنشاء الحملات ومتابعة المؤثرين والمحتوى والمستحقات." primary />
          <DashboardCard href="/dashboard/influencers" number="02" title="إدارة المؤثرين" description="البحث في الملفات، مراجعة البيانات والحسابات الاجتماعية." />
          <DashboardCard href="/dashboard/access-requests" number="03" title="طلبات تفعيل البوابة" description="مراجعة الطلبات وإرسال دعوات الدخول للمؤثرين." />
          <DashboardCard number="04" title="مراجعة المحتوى" description="ستُنقل إلى Supabase في المرحلة التالية." disabled />
          <DashboardCard number="05" title="المدفوعات" description="متابعة التحويلات والقسائم وموافقة المالية." disabled />
          <DashboardCard number="06" title="التقارير والأداء" description="مؤشرات الحملات والمؤثرين وأداء الموظفين." disabled />
        </section>
      </div>
    </main>
  );
}

function DashboardCard({ href, number, title, description, primary = false, disabled = false }: { href?: string; number: string; title: string; description: string; primary?: boolean; disabled?: boolean }) {
  const content = <><div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${primary ? "bg-white/16 text-white" : "bg-[#EEF0FF] text-[#6171C7]"}`}>{number}</div><h2 className={`mt-6 text-xl font-black ${primary ? "text-white" : "text-[#3F4D7D]"}`}>{title}</h2><p className={`mt-2 text-sm leading-7 ${primary ? "text-white/72" : "text-[#7E87A5]"}`}>{description}</p><span className={`mt-6 inline-flex text-sm font-black ${primary ? "text-white" : disabled ? "text-[#A1A7B8]" : "text-[#596BC4]"}`}>{disabled ? "قريبًا" : "فتح الوحدة ←"}</span></>;
  const className = `rounded-[26px] border p-6 shadow-[0_18px_48px_rgba(72,84,150,0.08)] transition ${primary ? "border-transparent bg-[linear-gradient(135deg,#6877C8,#5365BB)] hover:-translate-y-1" : disabled ? "border-white/85 bg-white/65" : "border-white/85 bg-white/94 hover:-translate-y-1 hover:border-[#D8DDF7]"}`;
  return href && !disabled ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-[22px] border border-white/85 bg-white/94 p-5 shadow-[0_16px_42px_rgba(72,84,150,0.08)]"><p className="text-sm font-bold text-[#8991AA]">{label}</p><p className="mt-2 text-3xl font-black text-[#405080]">{value}</p></div>; }
function roleLabel(role: string) { return role === "admin" ? "مدير النظام" : role === "coordinator" ? "منسق حملات" : role === "finance" ? "المالية" : role; }
