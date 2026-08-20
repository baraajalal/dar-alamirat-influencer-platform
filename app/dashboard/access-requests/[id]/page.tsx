import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { approvePortalAccess, rejectPortalAccess, requestPortalChanges } from "../actions";
import CopyLinkButton from "@/components/copy-link-button";
import SocialPlatformLink from "@/components/social-platform-link";

export const dynamic = "force-dynamic";

const statusLabels: Record<string,string> = { pending:"بانتظار المراجعة", needs_changes:"مطلوب تعديل", approved:"تمت الموافقة - بانتظار التفعيل", completed:"مفعّل", rejected:"مرفوض", cancelled:"ملغي" };
const successLabels: Record<string,string> = { approved:"تمت الموافقة وإنشاء رابط تفعيل آمن لمدة 72 ساعة.", changes:"تم تسجيل طلب التعديل وإنشاء رابط تعديل لمدة 72 ساعة.", rejected:"تم رفض الطلب." };
const errorLabels: Record<string,string> = { request_closed:"لا يمكن تنفيذ الإجراء على الحالة الحالية.", token_failed:"تعذر إنشاء الرابط الآمن.", approve_failed:"تعذرت الموافقة.", changes_failed:"تعذر طلب التعديل.", reject_failed:"تعذر رفض الطلب.", notes_required:"اكتب ملاحظات التعديل أولًا.", already_linked:"المؤثر لديه حساب مرتبط مسبقًا." };

export default async function AccessRequestDetailsPage({ params, searchParams }:{ params:Promise<{id:string}>; searchParams:Promise<{success?:string;error?:string;link?:string}>}) {
  const { id } = await params; const query = await searchParams;
  const { supabase, profile } = await requireRole(["admin","coordinator","finance"]);
  const { data: request } = await supabase.from("portal_access_requests").select("id,influencer_id,requested_email,normalized_mobile,request_reason,status,priority,review_notes,submitted_at,resubmitted_at,created_at,influencers(id,user_id,full_name,email,mobile_e164,gender,birth_year,city,country,mawthooq_status,preferred_ad_categories,content_style_preferences,shooting_style_preferences,profile_completion,archive_match_status,archive_influencer_id)").eq("id",id).maybeSingle();
  if (!request) notFound();
  const influencer = Array.isArray(request.influencers) ? request.influencers[0] : request.influencers;
  if (!influencer) notFound();
  const [{ data: social }, { data: financial }] = await Promise.all([
    supabase.from("social_accounts").select("id,platform,platform_label,username,profile_url,followers_count,average_views,average_likes,average_comments,engagement_rate,female_audience,male_audience,audience_main_city,audience_main_country").eq("influencer_id",influencer.id).order("created_at"),
    supabase.from("influencer_financial_profiles").select("mawthooq_number,mawthooq_expiry_date").eq("influencer_id",influencer.id).maybeSingle(),
  ]);
  const canAct = profile.role === "admin";
  const safeLink = typeof query.link === "string" ? query.link : "";
  const whatsappText = query.success === "changes" ? `مرحبًا، تمت مراجعة طلبك ونحتاج منك تحديث بعض البيانات. استخدم الرابط التالي خلال 72 ساعة:\n${safeLink}` : `مرحبًا، تمت الموافقة على طلب انضمامك إلى منصة مؤثري دار الأميرات. فعّل حسابك وأنشئ كلمة المرور من الرابط التالي خلال 72 ساعة:\n${safeLink}`;
  return <main dir="rtl" className="min-h-screen bg-[#F4F6FB] p-4 sm:p-8 text-[#33447F]">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-[#6877C8]">مراجعة طلب التفعيل</p><h1 className="mt-1 text-3xl font-black">{influencer.full_name}</h1></div><Link href="/dashboard/access-requests" className="rounded-xl border bg-white px-4 py-2 font-black">العودة للطلبات</Link></div>
      {query.success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{successLabels[query.success] || "تمت العملية."}</div> : null}
      {query.error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{errorLabels[query.error] || "حدث خطأ."}</div> : null}
      {safeLink ? <section className="mb-6 rounded-[24px] border border-[#D8DDF7] bg-white p-5"><h2 className="font-black">الرابط الجاهز للإرسال</h2><p dir="ltr" className="mt-3 break-all rounded-xl bg-[#F5F7FD] p-3 text-sm">{safeLink}</p><div className="mt-3 flex flex-wrap gap-2"><CopyLinkButton value={safeLink}/><CopyLinkButton value={whatsappText} label="نسخ رسالة واتساب"/></div><p className="mt-3 text-xs font-bold text-[#8891AC]">لا يُرسل أي بريد إلكتروني. شارك الرابط يدويًا مع المؤثر عبر واتساب أو القناة المناسبة.</p></section> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="البيانات الشخصية"><Rows items={[["الحالة",statusLabels[request.status]||request.status],["اكتمال الملف",`${influencer.profile_completion ?? 0}%`],["الجوال",request.normalized_mobile],["البريد",request.requested_email],["الجنس",influencer.gender || "—"],["سنة الميلاد",String(influencer.birth_year || "—")],["المدينة",influencer.city || "—"],["الدولة",influencer.country || "—"]]} /></Card>
        <Card title="موثوق والأرشيف"><Rows items={[["حالة موثوق",influencer.mawthooq_status===true?"لديه موثوق":influencer.mawthooq_status===false?"لا يوجد":"غير محدد"],["رقم موثوق",financial?.mawthooq_number || "—"],["انتهاء موثوق",financial?.mawthooq_expiry_date || "—"],["مطابقة الأرشيف",influencer.archive_match_status || "لم تتم المطابقة"],["سجل أرشيف مرتبط",influencer.archive_influencer_id ? "نعم - داخلي" : "لا"]]} /></Card>
        <Card title="حسابات التواصل"><div className="space-y-3">{(social||[]).map(a=><div key={a.id} className="rounded-xl bg-[#F7F8FC] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><SocialPlatformLink platform={a.platform} platformLabel={a.platform_label} url={a.profile_url}/><span>{a.followers_count ?? "—"} متابع</span></div>{a.profile_url || a.username ? <p dir="ltr" className="mt-2 break-all text-xs text-[#78819F]">{a.profile_url || a.username}</p> : null}<p className="mt-2 text-xs text-[#78819F]">مشاهدات {a.average_views ?? "—"} • تفاعل {a.engagement_rate ?? "—"}%</p></div>)}</div></Card>
        <Card title="تفضيلات المحتوى والتصوير"><TagList title="مجالات التعاون" values={influencer.preferred_ad_categories || []}/><TagList title="أنواع المحتوى" values={influencer.content_style_preferences || []}/><TagList title="أسلوب التصوير" values={influencer.shooting_style_preferences || []}/></Card>
      </div>
      {request.review_notes ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><b>آخر ملاحظات المراجعة:</b> {request.review_notes}</div> : null}
      {canAct ? <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <form action={approvePortalAccess} className="rounded-[22px] border bg-white p-5"><input type="hidden" name="requestId" value={request.id}/><h3 className="font-black text-emerald-700">اعتماد وتفعيل</h3><p className="mt-2 text-xs font-bold leading-6 text-[#7E87A1]">ينشئ رابط تفعيل آمن بدون إرسال بريد.</p><button disabled={!['pending','approved'].includes(request.status)||Boolean(influencer.user_id)} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-40">اعتماد وإنشاء رابط</button></form>
        <form action={requestPortalChanges} className="rounded-[22px] border bg-white p-5"><input type="hidden" name="requestId" value={request.id}/><h3 className="font-black text-amber-700">طلب تعديل</h3><textarea name="notes" required placeholder="اكتب للمؤثر البيانات المطلوب تعديلها..." className="mt-3 min-h-24 w-full rounded-xl border p-3 text-sm"/><button disabled={!['pending','needs_changes'].includes(request.status)} className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 font-black text-white disabled:opacity-40">إنشاء رابط تعديل</button></form>
        <form action={rejectPortalAccess} className="rounded-[22px] border bg-white p-5"><input type="hidden" name="requestId" value={request.id}/><h3 className="font-black text-red-700">رفض الطلب</h3><textarea name="notes" placeholder="سبب الرفض - اختياري" className="mt-3 min-h-24 w-full rounded-xl border p-3 text-sm"/><button disabled={!['pending','needs_changes'].includes(request.status)} className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-40">رفض</button></form>
      </section> : null}
    </div>
  </main>;
}
function Card({title,children}:{title:string;children:ReactNode}){return <section className="rounded-[24px] border border-[#E0E4F2] bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</section>}
function Rows({items}:{items:[string,string][]}){return <div className="space-y-2">{items.map(([k,v])=><div key={k} className="flex justify-between gap-4 border-b border-[#EEF0F6] py-2 text-sm"><span className="font-bold text-[#7E87A1]">{k}</span><b>{v}</b></div>)}</div>}
function TagList({title,values}:{title:string;values:string[]}){return <div className="mb-4"><p className="mb-2 text-xs font-black text-[#7E87A1]">{title}</p><div className="flex flex-wrap gap-2">{values.length?values.map(v=><span key={v} className="rounded-full bg-[#EEF0FB] px-3 py-1.5 text-xs font-black text-[#5969B2]">{v}</span>):<span className="text-sm text-[#9AA2B8]">—</span>}</div></div>}
