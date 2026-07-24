import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "نشطة",
  paused: "موقوفة مؤقتًا",
  completed: "مكتملة",
  archived: "مؤرشفة",
};

export default async function CampaignDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { profile, supabase } = await requireRole(["admin", "coordinator", "finance"]);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id,name,brand,product,campaign_type,brief,start_date,end_date,content_due_at,publishing_date,budget,status,manager_id,hashtags,reference_links,internal_notes,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) notFound();

  const [{ data: manager }, { data: assignments }] = await Promise.all([
    campaign.manager_id
      ? supabase.from("profiles").select("full_name").eq("id", campaign.manager_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string } | null }),
    supabase
      .from("campaign_assignments")
      .select("id,status,influencer_id,content_due_at,publishing_date,created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const canManage = profile.role === "admin" || profile.role === "coordinator";

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard/campaigns" className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]">العودة للحملات</Link>
          <div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#6877C8] p-2 shadow-[0_10px_25px_rgba(104,119,200,0.25)]"><Image src="/da-logo.png" alt="دار الأميرات" width={110} height={55} className="h-10 w-auto object-contain" priority /></div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1350px] px-4 py-8 sm:px-6 lg:px-8">
        {query.created === "1" && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">تم إنشاء الحملة وحفظ جميع بياناتها بنجاح.</div>}

        <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6877C8_0%,#5A6BC1_52%,#8794DE_100%)] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.25)] sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">{statusLabels[campaign.status] ?? campaign.status}</span><span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">{campaign.brand || "بدون براند"}</span></div>
              <h1 className="mt-5 text-3xl font-black sm:text-4xl">{campaign.name}</h1>
              <p className="mt-3 text-sm text-white/75">{campaign.product || campaign.campaign_type || "حملة إعلانية"}</p>
            </div>
            {canManage && <button disabled className="min-h-14 cursor-not-allowed rounded-2xl border border-white/25 bg-white/12 px-6 font-black text-white/70">إضافة مؤثرين — الخطوة التالية</button>}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="مدير الحملة" value={manager?.full_name ?? "غير محدد"} />
          <InfoCard label="عدد المؤثرين" value={`${assignments?.length ?? 0}`} />
          <InfoCard label="موعد النشر" value={formatDate(campaign.publishing_date)} />
          <InfoCard label="الميزانية" value={formatMoney(campaign.budget)} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="space-y-6">
            <Card title="البريف والتعليمات">
              <p className="whitespace-pre-wrap text-sm leading-8 text-[#68718F]">{campaign.brief || "لم تتم إضافة بريف حتى الآن."}</p>
            </Card>
            <Card title="المؤثرون المرتبطون بالحملة">
              {(assignments?.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D8DDF7] bg-[#FAFBFF] px-5 py-10 text-center"><p className="font-black text-[#596BC4]">لم تتم إضافة مؤثرين بعد</p><p className="mt-2 text-sm text-[#8991AA]">الخطوة القادمة هي البحث عن المؤثر وربطه بالحملة.</p></div>
              ) : (
                <div className="space-y-3">{assignments!.map((assignment) => <div key={assignment.id} className="rounded-2xl border border-[#E5E8F5] p-4 text-sm"><div className="flex justify-between"><span className="font-black">تكليف مؤثر</span><span>{assignment.status}</span></div></div>)}</div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="الجدول الزمني">
              <TimelineItem label="بداية الحملة" value={formatDate(campaign.start_date)} />
              <TimelineItem label="تسليم المحتوى" value={formatDateTime(campaign.content_due_at)} />
              <TimelineItem label="موعد النشر" value={formatDate(campaign.publishing_date)} />
              <TimelineItem label="نهاية الحملة" value={formatDate(campaign.end_date)} last />
            </Card>
            <Card title="الهاشتاقات">
              <div className="flex flex-wrap gap-2">{campaign.hashtags?.length ? campaign.hashtags.map((tag: string) => <span key={tag} className="rounded-full bg-[#EEF0FF] px-3 py-2 text-xs font-black text-[#596BC4]">{tag}</span>) : <span className="text-sm text-[#8991AA]">لا توجد هاشتاقات.</span>}</div>
            </Card>
            <Card title="ملاحظات داخلية">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#6F7896]">{campaign.internal_notes || "لا توجد ملاحظات داخلية."}</p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[26px] border border-white/85 bg-white/94 p-5 shadow-[0_18px_48px_rgba(72,84,150,0.08)] sm:p-6"><h2 className="mb-5 text-lg font-black text-[#3E4C7C]">{title}</h2>{children}</section>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div className="rounded-[22px] border border-white/85 bg-white/94 p-5 shadow-[0_16px_42px_rgba(72,84,150,0.08)]"><p className="text-xs font-bold text-[#8A92AA]">{label}</p><p className="mt-2 text-lg font-black text-[#405080]">{value}</p></div>; }
function TimelineItem({ label, value, last = false }: { label: string; value: string; last?: boolean }) { return <div className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1 h-3 w-3 rounded-full bg-[#6877C8]"/>{!last && <span className="h-11 w-px bg-[#D8DDF7]"/>}</div><div><p className="text-xs text-[#8A92AA]">{label}</p><p className="mt-1 text-sm font-black text-[#52608B]">{value}</p></div></div>; }
function formatDate(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }
function formatDateTime(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)); }
function formatMoney(value: number | null) { if (value === null) return "غير محددة"; return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value); }
