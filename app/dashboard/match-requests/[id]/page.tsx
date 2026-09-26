import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { approveArchiveMatch, createAsNewInfluencer } from "../actions";

export const dynamic = "force-dynamic";

const copy = {
  ar: {
    title: "مراجعة مطابقة التسجيل",
    back: "طلبات المطابقة",
    newData: "بيانات التسجيل الجديدة",
    candidates: "سجلات الأرشيف المحتملة",
    noCandidates: "لا توجد احتمالات مطابقة محفوظة لهذا الطلب.",
    reasons: "أسباب المطابقة",
    mobile: "الجوال",
    email: "البريد",
    city: "المدينة",
    accounts: "الحسابات",
    status: "حالة السجل",
    work: "الأعمال السابقة",
    score: "درجة المطابقة",
    approve: "اعتماد أنه نفس المؤثر",
    newIdentity: "ليس نفس المؤثر — إنشاء ملف جديد",
    exactMobileWarning: "رقم الجوال مطابق 100%. إذا كان الشخص مختلفًا فعلًا فلا يمكن إنشاء ملف ثانٍ بنفس الرقم؛ يجب تصحيح الرقم في تسجيل جديد.",
    mergeRule: "عند اعتماد المطابقة، يتم ملء البيانات الناقصة فقط ويحافظ النظام على الأعمال السابقة والبيانات الموجودة.",
    errors: {
      mobile_conflict: "لا يمكن إنشاء سجل جديد لأن رقم الجوال مستخدم في ملف موجود. اعتمد المطابقة إذا كان نفس الشخص، أو اطلب منه إعادة التسجيل برقم صحيح مختلف.",
      match_failed: "تعذر اعتماد المطابقة.",
      create_failed: "تعذر إنشاء ملف جديد.",
    },
  },
  en: {
    title: "Review registration match",
    back: "Match requests",
    newData: "New registration data",
    candidates: "Possible archive records",
    noCandidates: "No stored match candidates for this submission.",
    reasons: "Match reasons",
    mobile: "Mobile",
    email: "Email",
    city: "City",
    accounts: "Accounts",
    status: "Record status",
    work: "Past work",
    score: "Match score",
    approve: "Confirm same creator",
    newIdentity: "Not the same creator — create a new profile",
    exactMobileWarning: "The mobile number matches exactly. A second profile cannot use the same number; if this is a different person, they must register again with the correct number.",
    mergeRule: "When a match is confirmed, only missing fields are filled. Existing data and work history are preserved.",
    errors: {
      mobile_conflict: "A new profile cannot be created because this mobile is already used. Confirm the match if it is the same person, or ask for a corrected registration.",
      match_failed: "Could not confirm the match.",
      create_failed: "Could not create a new profile.",
    },
  },
};

export default async function MatchRequestDetails({ params, searchParams }: { params: Promise<{id:string}>; searchParams?: Promise<{error?:string}> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { supabase } = await requireRole(["admin"]);
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const t = copy[locale];

  const { data: submission } = await supabase
    .from("influencer_registration_submissions")
    .select("id,normalized_mobile,requested_email,payload,status,created_at")
    .eq("id", id)
    .maybeSingle();
  if (!submission) notFound();

  const { data: candidates } = await supabase
    .from("influencer_match_candidates")
    .select("id,influencer_id,score,mobile_match,social_username_match,profile_url_match,name_support_match,reasons,decision")
    .eq("submission_id", id)
    .order("score", { ascending: false });

  const candidateIds = (candidates ?? []).map((c)=>c.influencer_id);
  const [{ data: influencers }, { data: socials }, { data: history }] = await Promise.all([
    candidateIds.length ? supabase.from("influencers").select("id,full_name,mobile_e164,email,city,country,directory_status,user_id").in("id", candidateIds) : Promise.resolve({data:[]}),
    candidateIds.length ? supabase.from("social_accounts").select("id,influencer_id,platform,username,profile_url,followers_count").in("influencer_id", candidateIds) : Promise.resolve({data:[]}),
    candidateIds.length ? supabase.from("influencer_work_history").select("id,influencer_id").in("influencer_id", candidateIds) : Promise.resolve({data:[]}),
  ]);

  const influencerMap = new Map((influencers ?? []).map((x:any)=>[x.id,x]));
  const socialMap = new Map<string, any[]>();
  for (const row of socials ?? []) socialMap.set(row.influencer_id,[...(socialMap.get(row.influencer_id) ?? []),row]);
  const historyCount = new Map<string,number>();
  for (const row of history ?? []) historyCount.set(row.influencer_id,(historyCount.get(row.influencer_id) ?? 0)+1);

  const incoming:any = submission.payload?.influencer ?? {};
  const incomingSocial:any[] = submission.payload?.socialAccounts ?? [];
  const errorText = query.error ? t.errors[query.error as keyof typeof t.errors] : null;

  return <main className="space-y-6">
    <section>
      <Link href="/dashboard/match-requests" className="text-sm font-extrabold text-[#6071C3]">← {t.back}</Link>
      <h1 className="mt-3 text-3xl font-black text-[#3D274F]">{t.title}</h1>
      <p className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-800">{t.mergeRule}</p>
      {errorText ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{errorText}</p> : null}
    </section>

    <section className="rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
      <h2 className="text-lg font-black text-[#432A57]">{t.newData}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label={locale==="en"?"Name":"الاسم"} value={incoming.fullName || "—"}/>
        <Info label={t.mobile} value={`+${submission.normalized_mobile}`} ltr/>
        <Info label={t.email} value={submission.requested_email || "—"} ltr/>
        <Info label={t.city} value={incoming.city || "—"}/>
      </div>
      <div className="mt-4"><p className="mb-2 text-xs font-black text-[#66739D]">{t.accounts}</p><div className="flex flex-wrap gap-2">{incomingSocial.map((a:any,i:number)=><span key={`${a.platform}-${a.username}-${i}`} dir="ltr" className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-bold text-[#5967A6]">{a.platform}: @{a.username || "—"}</span>)}</div></div>
    </section>

    <section className="space-y-4">
      <h2 className="text-lg font-black text-[#432A57]">{t.candidates}</h2>
      {(candidates ?? []).length ? (candidates ?? []).map((candidate:any)=>{
        const i:any = influencerMap.get(candidate.influencer_id);
        const accounts = socialMap.get(candidate.influencer_id) ?? [];
        const exactMobile = Boolean(candidate.mobile_match);
        return <article key={candidate.id} className="rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-[#432A57]">{i?.full_name || "—"}</h3><span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-xs font-black text-[#6658A8]">{i?.directory_status || "—"}</span></div>
              <p dir="ltr" className="mt-2 text-start text-sm font-bold text-[#737D9A]">{i?.mobile_e164 || "—"}</p>
            </div>
            <div className="rounded-2xl bg-[#F4F6FB] px-5 py-3 text-center"><p className="text-[10px] font-black text-[#8A92AA]">{t.score}</p><p className="mt-1 text-2xl font-black text-[#5669C4]">{candidate.score}</p></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Info label={t.email} value={i?.email || "—"} ltr/>
            <Info label={t.city} value={i?.city || "—"}/>
            <Info label={t.work} value={String(historyCount.get(candidate.influencer_id) ?? 0)}/>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{accounts.map((a:any)=><span key={a.id} dir="ltr" className="rounded-xl border border-[#EEEAF4] bg-[#FCFAFD] px-3 py-2 text-xs font-bold text-[#53618D]">{a.platform}: @{a.username}</span>)}</div>
          <div className="mt-4"><p className="mb-2 text-xs font-black text-[#66739D]">{t.reasons}</p><div className="flex flex-wrap gap-2">{candidate.mobile_match?<Badge text={locale==="en"?"Mobile":"الجوال"}/>:null}{candidate.social_username_match?<Badge text={locale==="en"?"Username":"اسم الحساب"}/>:null}{candidate.profile_url_match?<Badge text={locale==="en"?"Profile URL":"رابط الحساب"}/>:null}{candidate.name_support_match?<Badge text={locale==="en"?"Name support":"الاسم عامل مساعد"}/>:null}</div></div>
          {exactMobile ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800">{t.exactMobileWarning}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <form action={approveArchiveMatch}><input type="hidden" name="submission_id" value={id}/><input type="hidden" name="influencer_id" value={candidate.influencer_id}/><button className="rounded-xl bg-[#5669C4] px-5 py-3 text-sm font-black text-white">{t.approve}</button></form>
          </div>
        </article>;
      }) : <div className="rounded-2xl bg-white p-6 text-sm font-bold text-[#9299AE]">{t.noCandidates}</div>}
    </section>

    <section className="rounded-[28px] border border-rose-100 bg-white p-6">
      <form action={createAsNewInfluencer}>
        <input type="hidden" name="submission_id" value={id}/>
        <button className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700">{t.newIdentity}</button>
      </form>
    </section>
  </main>;
}

function Info({label,value,ltr}:{label:string;value:string;ltr?:boolean}){return <div className="rounded-2xl bg-[#F8F9FC] p-4"><p className="text-[10px] font-black text-[#9098AE]">{label}</p><p dir={ltr?"ltr":undefined} className={`mt-1 font-black text-[#4F5D8E] ${ltr?"text-start":""}`}>{value}</p></div>}
function Badge({text}:{text:string}){return <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">✓ {text}</span>}
