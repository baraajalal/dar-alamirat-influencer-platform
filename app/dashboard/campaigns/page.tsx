import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

type CampaignRow = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  campaign_type: string | null;
  start_date: string | null;
  end_date: string | null;
  publishing_date: string | null;
  budget: number | null;
  status: CampaignStatus;
  manager_id: string | null;
  created_at: string;
};

const statusLabels: Record<CampaignStatus, string> = {
  draft: "مسودة",
  active: "نشطة",
  paused: "موقوفة",
  completed: "مكتملة",
  archived: "مؤرشفة",
};

const statusStyles: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-[#EEF0FF] text-[#596BC4]",
  archived: "bg-[#F3F3F6] text-[#777B8B]",
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; created?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { profile, supabase } = await requireRole(["admin", "coordinator", "finance"]);

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id,name,brand,product,campaign_type,start_date,end_date,publishing_date,budget,status,manager_id,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const managerIds = Array.from(new Set(campaignRows.map((campaign) => campaign.manager_id).filter(Boolean))) as string[];

  const [{ data: assignments }, { data: managers }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaign_assignments").select("campaign_id,status").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as { campaign_id: string; status: string }[] }),
    managerIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", managerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const managerMap = new Map((managers ?? []).map((manager) => [manager.id, manager.full_name]));
  const assignmentCounts = new Map<string, number>();
  const completedAssignmentCounts = new Map<string, number>();

  for (const assignment of assignments ?? []) {
    assignmentCounts.set(assignment.campaign_id, (assignmentCounts.get(assignment.campaign_id) ?? 0) + 1);
    if (["paid", "closed"].includes(assignment.status)) {
      completedAssignmentCounts.set(
        assignment.campaign_id,
        (completedAssignmentCounts.get(assignment.campaign_id) ?? 0) + 1,
      );
    }
  }

  const query = (params.q ?? "").trim().toLowerCase();
  const requestedStatus = params.status as CampaignStatus | undefined;
  const filtered = campaignRows.filter((campaign) => {
    const matchesQuery =
      !query ||
      [campaign.name, campaign.brand, campaign.product, campaign.campaign_type]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    const matchesStatus = !requestedStatus || campaign.status === requestedStatus;
    return matchesQuery && matchesStatus;
  });

  const total = campaignRows.length;
  const active = campaignRows.filter((campaign) => campaign.status === "active").length;
  const draft = campaignRows.filter((campaign) => campaign.status === "draft").length;
  const completed = campaignRows.filter((campaign) => campaign.status === "completed").length;
  const canCreate = profile.role === "admin" || profile.role === "coordinator";

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <DecorativeBackground />

      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]">لوحة الإدارة</Link>
            <span className="hidden rounded-2xl bg-[#F2F4FF] px-4 py-3 text-xs font-black text-[#6978C8] sm:inline-flex">العربية</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-left sm:block">
              <p className="text-sm font-black text-[#33447F]">إدارة الحملات</p>
              <p className="text-xs text-[#8991AB]">مرحبًا، {profile.full_name}</p>
            </div>
            <div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#6877C8] p-2 shadow-[0_10px_25px_rgba(104,119,200,0.25)]">
              <Image src="/da-logo.png" alt="دار الأميرات" width={110} height={55} className="h-10 w-auto object-contain" priority />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1450px] px-4 py-8 sm:px-6 lg:px-8">
        {params.created === "1" && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">تم إنشاء الحملة بنجاح.</div>
        )}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <span className="inline-flex rounded-full bg-[#EEF0FF] px-4 py-2 text-xs font-black text-[#6171C7]">مركز عمليات الحملات</span>
            <h1 className="mt-3 text-3xl font-black text-[#33447F] sm:text-4xl">الحملات الإعلانية</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#7D86A4]">أنشئي الحملات، تابعي تقدم المؤثرين، المحتوى والمستحقات من مكان واحد.</p>
          </div>
          {canCreate && (
            <Link href="/dashboard/campaigns/new" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-7 font-black text-white shadow-[0_14px_30px_rgba(82,99,185,0.28)] transition hover:-translate-y-0.5">
              <PlusIcon /> إنشاء حملة جديدة
            </Link>
          )}
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إجمالي الحملات" value={total} icon="✦" />
          <StatCard label="الحملات النشطة" value={active} icon="●" tone="green" />
          <StatCard label="المسودات" value={draft} icon="◐" tone="amber" />
          <StatCard label="المكتملة" value={completed} icon="✓" tone="blue" />
        </section>

        <section className="mt-6 rounded-[28px] border border-white/80 bg-white/92 p-4 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl sm:p-5">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <SearchIcon />
              <input name="q" defaultValue={params.q ?? ""} placeholder="ابحثي باسم الحملة أو البراند أو المنتج" className="h-14 w-full rounded-2xl border border-[#D8DDF7] bg-[#FBFCFF] pr-12 pl-4 text-sm font-bold text-[#33447F] outline-none transition focus:border-[#6877C8] focus:shadow-[0_0_0_4px_rgba(104,119,200,0.10)]" />
            </div>
            <select name="status" defaultValue={params.status ?? ""} className="h-14 rounded-2xl border border-[#D8DDF7] bg-[#FBFCFF] px-4 text-sm font-black text-[#52618F] outline-none focus:border-[#6877C8]">
              <option value="">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className="h-14 rounded-2xl bg-[#EEF0FF] px-6 font-black text-[#596BC4] transition hover:bg-[#E2E6FF]">تطبيق البحث</button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-white/80 bg-white/94 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead className="bg-[#F4F6FF] text-[#53618E]">
                <tr>
                  <Th>الحملة</Th><Th>الفترة</Th><Th>الحالة</Th><Th>المؤثرون</Th><Th>التقدم</Th><Th>الميزانية</Th><Th>مدير الحملة</Th><Th>الإجراء</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => {
                  const count = assignmentCounts.get(campaign.id) ?? 0;
                  const completedCount = completedAssignmentCounts.get(campaign.id) ?? 0;
                  const progress = count ? Math.round((completedCount / count) * 100) : 0;
                  return (
                    <tr key={campaign.id} className="border-t border-[#EEF0F7] transition hover:bg-[#FCFCFF]">
                      <Td>
                        <div className="font-black text-[#33447F]">{campaign.name}</div>
                        <div className="mt-1 text-xs text-[#8A92AA]">{[campaign.brand, campaign.product].filter(Boolean).join(" — ") || "بدون براند محدد"}</div>
                      </Td>
                      <Td>{formatRange(campaign.start_date, campaign.end_date)}</Td>
                      <Td><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${statusStyles[campaign.status]}`}>{statusLabels[campaign.status]}</span></Td>
                      <Td><span className="font-black text-[#5264BB]">{count}</span> مؤثر</Td>
                      <Td><Progress value={progress} /></Td>
                      <Td>{formatMoney(campaign.budget)}</Td>
                      <Td>{campaign.manager_id ? managerMap.get(campaign.manager_id) ?? "—" : "—"}</Td>
                      <Td><Link href={`/dashboard/campaigns/${campaign.id}`} className="inline-flex rounded-xl border border-[#D8DDF7] bg-white px-4 py-2 font-black text-[#596BC4] transition hover:bg-[#F1F3FF]">فتح التفاصيل</Link></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-4 lg:hidden">
            {filtered.map((campaign) => {
              const count = assignmentCounts.get(campaign.id) ?? 0;
              const completedCount = completedAssignmentCounts.get(campaign.id) ?? 0;
              const progress = count ? Math.round((completedCount / count) * 100) : 0;
              return (
                <article key={campaign.id} className="rounded-2xl border border-[#E5E8F5] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-black text-[#33447F]">{campaign.name}</h2><p className="mt-1 text-xs text-[#8A92AA]">{campaign.brand || "بدون براند"}</p></div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[campaign.status]}`}>{statusLabels[campaign.status]}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><MiniInfo label="الفترة" value={formatRange(campaign.start_date, campaign.end_date)} /><MiniInfo label="المؤثرون" value={`${count}`} /><MiniInfo label="الميزانية" value={formatMoney(campaign.budget)} /><MiniInfo label="المدير" value={campaign.manager_id ? managerMap.get(campaign.manager_id) ?? "—" : "—"} /></div>
                  <div className="mt-5"><Progress value={progress} /></div>
                  <Link href={`/dashboard/campaigns/${campaign.id}`} className="mt-5 flex h-12 items-center justify-center rounded-xl bg-[#EEF0FF] font-black text-[#596BC4]">فتح التفاصيل</Link>
                </article>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="px-5 py-16 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F0F2FF] text-2xl text-[#6877C8]">✦</div><h2 className="mt-4 text-lg font-black text-[#435180]">لا توجد حملات مطابقة</h2><p className="mt-2 text-sm text-[#8991AA]">غيّري البحث أو أنشئي أول حملة.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return "غير محدد";
  const formatter = new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${formatter.format(new Date(`${start}T12:00:00`))} — ${formatter.format(new Date(`${end}T12:00:00`))}`;
  return formatter.format(new Date(`${start ?? end}T12:00:00`));
}

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value);
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: number; icon: string; tone?: "default" | "green" | "amber" | "blue" }) {
  const tones = { default: "bg-[#EEF0FF] text-[#6171C7]", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", blue: "bg-[#EDF5FF] text-[#4F7BC3]" };
  return <div className="rounded-[24px] border border-white/85 bg-white/92 p-5 shadow-[0_16px_42px_rgba(72,84,150,0.08)]"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#8790AA]">{label}</p><p className="mt-2 text-3xl font-black text-[#33447F]">{value}</p></div><span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black ${tones[tone]}`}>{icon}</span></div></div>;
}

function Progress({ value }: { value: number }) {
  return <div className="min-w-32"><div className="mb-1 flex items-center justify-between text-xs font-black text-[#69749D]"><span>التقدم</span><span>{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#ECEEF7]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#6877C8,#92A0E8)]" style={{ width: `${value}%` }} /></div></div>;
}

function MiniInfo({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#F8F9FD] p-3"><p className="text-xs text-[#8C93A9]">{label}</p><p className="mt-1 font-black text-[#4B5886]">{value}</p></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="whitespace-nowrap p-4 text-right font-black">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="p-4 align-middle text-[#606B8E]">{children}</td>; }
function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>; }
function SearchIcon() { return <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8792BF]" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }
function DecorativeBackground() { return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-24 top-24 h-80 w-80 rounded-full border-[44px] border-white/45"/><div className="absolute -bottom-28 right-10 h-96 w-96 rounded-full border-[55px] border-[#D8DDF7]/25"/><span className="absolute right-[8%] top-28 h-2.5 w-2.5 rounded-full bg-[#F7D27A] shadow-[0_0_12px_rgba(247,210,122,0.7)]"/></div>; }
