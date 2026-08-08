import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-user";
import { sendAssignmentInvitation } from "./actions";

export const dynamic = "force-dynamic";

type Assignment = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  coordinator_id: string | null;
  status: string;
  execution_type: string | null;
  invitation_status: string | null;
  invitation_sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  has_contract: boolean;
  contract_reference: string | null;
  coordinator_progress: number | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  invited: "بانتظار الدعوة",
  accepted: "مقبول",
  product_pending: "بانتظار المنتج",
  brief_pending: "بانتظار البريف",
  content_pending: "بانتظار المحتوى",
  under_review: "تحت المراجعة",
  needs_changes: "يحتاج تعديل",
  approved: "معتمد",
  payment_pending: "بانتظار الاستحقاق",
  paid: "تمت التسوية",
  closed: "مغلق",
  rejected: "معتذر",
  cancelled: "ملغى",
};

export default async function AssignmentWorkspacePage({ searchParams }: { searchParams: Promise<{ q?: string; campaign?: string; status?: string; employee?: string; error?: string; assignment?: string }> }) {
  const filters = await searchParams;
  const { supabase, user, profile } = await requirePermission("campaigns", "view");
  const isManager = profile.role === "admin" || profile.role === "viewer";

  let assignmentQuery = supabase.from("campaign_assignments")
    .select("id,campaign_id,influencer_id,coordinator_id,status,execution_type,invitation_status,invitation_sent_at,accepted_at,declined_at,has_contract,contract_reference,coordinator_progress,created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  if (!isManager) assignmentQuery = assignmentQuery.eq("coordinator_id", user.id);
  if (filters.campaign) assignmentQuery = assignmentQuery.eq("campaign_id", filters.campaign);
  if (filters.status) assignmentQuery = assignmentQuery.eq("status", filters.status);
  if (isManager && filters.employee) assignmentQuery = assignmentQuery.eq("coordinator_id", filters.employee);

  const [assignmentsResult, campaignsResult, coordinatorsResult] = await Promise.all([
    assignmentQuery,
    supabase.from("campaigns").select("id,name,brand,status,progress_percentage,start_date,end_date").order("created_at", { ascending: false }),
    isManager ? supabase.from("profiles").select("id,full_name,role").in("role", ["admin", "coordinator"]).eq("is_active", true).order("full_name") : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; role: string }>, error: null }),
  ]);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (campaignsResult.error) throw new Error(campaignsResult.error.message);
  if (coordinatorsResult.error) throw new Error(coordinatorsResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as Assignment[];
  const influencerIds = [...new Set(assignments.map((row) => row.influencer_id))];
  const campaignIds = [...new Set(assignments.map((row) => row.campaign_id))];
  const coordinatorIds = [...new Set(assignments.map((row) => row.coordinator_id).filter(Boolean))] as string[];
  const [{ data: influencers }, { data: campaigns }, { data: coordinators }] = await Promise.all([
    influencerIds.length ? supabase.from("influencers").select("id,full_name,mobile_e164,city,profile_completion").in("id", influencerIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; mobile_e164: string; city: string | null; profile_completion: number }> }),
    campaignIds.length ? supabase.from("campaigns").select("id,name,brand,progress_percentage").in("id", campaignIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string; brand: string | null; progress_percentage: number | null }> }),
    coordinatorIds.length ? supabase.from("profiles").select("id,full_name").in("id", coordinatorIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);
  const influencerMap = new Map((influencers ?? []).map((row) => [row.id, row]));
  const campaignMap = new Map((campaigns ?? []).map((row) => [row.id, row]));
  const coordinatorMap = new Map((coordinators ?? []).map((row) => [row.id, row.full_name]));

  const q = (filters.q ?? "").trim().toLowerCase();
  const visibleAssignments = assignments.filter((row) => {
    if (!q) return true;
    const influencer = influencerMap.get(row.influencer_id);
    const campaign = campaignMap.get(row.campaign_id);
    return [influencer?.full_name, influencer?.mobile_e164, campaign?.name].some((item) => String(item ?? "").toLowerCase().includes(q));
  });

  const kpis = {
    influencers: new Set(assignments.map((row) => row.influencer_id)).size,
    active: assignments.filter((row) => !["paid", "closed", "rejected", "cancelled"].includes(row.status)).length,
    invited: assignments.filter((row) => row.invitation_status === "sent" || row.invitation_sent_at).length,
    accepted: assignments.filter((row) => row.accepted_at).length,
    contracts: assignments.filter((row) => row.has_contract && row.contract_reference).length,
    completed: assignments.filter((row) => ["paid", "closed"].includes(row.status)).length,
    average: assignments.length ? Math.round(assignments.reduce((sum, row) => sum + Number(row.coordinator_progress ?? 0), 0) / assignments.length) : 0,
  };

  return (
    <div className="space-y-7" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#6578CF]">مساحة عمل المنسق</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">إضافة مؤثر لحملة ومتابعة التكليفات</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">ابدأ بالمؤثر، اختر الحملة، أنشئ التكليف، ثم أرسل الدعوة عبر واتساب وتابع التقدم من مكان واحد.</p>
        </div>
        <Link href="/dashboard/campaigns/assignments/new" className="rounded-2xl bg-[#5368C3] px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200">+ إضافة مؤثر لحملة</Link>
      </div>

      {filters.assignment ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-800">تم إنشاء التكليف بنجاح وأصبح ظاهرًا في القائمة.</div> : null}
      {filters.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-800">تعذر تنفيذ العملية: {filters.error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["مؤثروني", kpis.influencers], ["تكليفات نشطة", kpis.active], ["دعوات مرسلة", kpis.invited], ["مقبولون", kpis.accepted],
          ["عقود مكتملة", kpis.contracts], ["تكليفات مكتملة", kpis.completed], ["متوسط التقدم", `${kpis.average}%`], ["إجمالي التكليفات", assignments.length],
        ].map(([label, value]) => <div key={String(label)} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-slate-900">{value}</p></div>)}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 lg:grid-cols-5">
          <input name="q" defaultValue={filters.q} placeholder="بحث بالاسم أو الجوال أو الحملة" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#6578CF]" />
          <select name="campaign" defaultValue={filters.campaign ?? ""} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">كل الحملات</option>{(campaignsResult.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select name="status" defaultValue={filters.status ?? ""} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          {isManager ? <select name="employee" defaultValue={filters.employee ?? ""} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">كل الموظفين</option>{(coordinatorsResult.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select> : <div />}
          <button className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white">تطبيق الفلاتر</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-black text-slate-900">تكليفات المؤثرين</h2><p className="mt-1 text-sm font-bold text-slate-500">{visibleAssignments.length} تكليف ظاهر</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="px-5 py-4">المؤثر</th><th className="px-5 py-4">الحملة</th><th className="px-5 py-4">المنسق</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">الدعوة</th><th className="px-5 py-4">التقدم</th><th className="px-5 py-4">الإجراءات</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAssignments.map((row) => {
                const influencer = influencerMap.get(row.influencer_id);
                const campaign = campaignMap.get(row.campaign_id);
                const progress = Math.round(Number(row.coordinator_progress ?? 0));
                return <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-black text-slate-900">{influencer?.full_name ?? "مؤثر"}</p><p className="mt-1 text-xs font-bold text-slate-500">{influencer?.mobile_e164 ?? "—"}</p></td>
                  <td className="px-5 py-4"><p className="font-black text-slate-800">{campaign?.name ?? "—"}</p><p className="mt-1 text-xs font-bold text-slate-500">{campaign?.brand ?? "—"}</p></td>
                  <td className="px-5 py-4 font-bold text-slate-600">{coordinatorMap.get(row.coordinator_id ?? "") ?? "غير محدد"}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#5368C3]">{statusLabels[row.status] ?? row.status}</span></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${row.invitation_status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.invitation_status === "sent" ? "تم الإرسال" : "لم تُرسل"}</span></td>
                  <td className="min-w-40 px-5 py-4"><div className="flex items-center justify-between text-xs font-black text-slate-600"><span>{progress}%</span><span>{campaign?.progress_percentage ? `الحملة ${Math.round(Number(campaign.progress_percentage))}%` : ""}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6578CF]" style={{ width: `${Math.min(100, progress)}%` }} /></div></td>
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Link href={`/dashboard/campaigns/${row.campaign_id}/influencers/${row.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">فتح</Link><form action={sendAssignmentInvitation}><input type="hidden" name="assignment_id" value={row.id} /><button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">واتساب</button></form></div></td>
                </tr>;
              })}
              {!visibleAssignments.length ? <tr><td colSpan={7} className="px-6 py-14 text-center text-sm font-black text-slate-400">لا توجد تكليفات مطابقة.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
