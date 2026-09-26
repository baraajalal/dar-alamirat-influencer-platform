import Link from "next/link";
import { notFound } from "next/navigation";
import SocialPlatformLink from "@/components/social-platform-link";
import { requirePermission } from "@/lib/auth/require-user";
import { reviewApplication, updateOpportunitySettings } from "./actions";

export const dynamic = "force-dynamic";

type Social = {
  platform: string;
  platform_label: string | null;
  username: string;
  profile_url: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
  average_views: number | null;
  average_likes: number | null;
};
type Influencer = {
  id: string;
  full_name: string;
  mobile_e164: string;
  city: string | null;
  country: string | null;
  social_accounts: Social[];
};
type Application = {
  id: string;
  status: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  assignment_id: string | null;
  terms_accepted_at: string | null;
  agreed_compensation_mode: string | null;
  agreed_compensation_amount: number | null;
  agreed_compensation_max_amount: number | null;
  agreed_compensation_currency: string | null;
  influencers: Influencer | Influencer[] | null;
};

export default async function CampaignApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; reviewed?: string; error?: string; assignment?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { supabase } = await requirePermission("campaigns", "update");

  const [{ data: campaign, error: campaignError }, { data: applications, error: applicationsError }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,brand,status,brief,hashtags,reference_links,brief_public_url,portal_visibility,opportunity_type,opportunity_summary,opportunity_goal,application_requirements,opportunity_image_urls,public_compensation_mode,public_compensation_amount,public_compensation_max_amount,public_compensation_currency,public_compensation_notes,require_campaign_terms_acceptance,applications_open_at,applications_close_at,max_applications,max_participants")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("campaign_applications")
      .select("id,status,message,rejection_reason,created_at,reviewed_at,assignment_id,terms_accepted_at,agreed_compensation_mode,agreed_compensation_amount,agreed_compensation_max_amount,agreed_compensation_currency,influencers(id,full_name,mobile_e164,city,country,social_accounts(platform,platform_label,username,profile_url,followers_count,engagement_rate,average_views,average_likes))")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();
  if (applicationsError) throw new Error(applicationsError.message);
  const rows = (applications ?? []) as unknown as Application[];

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-[28px] bg-gradient-to-br from-[#A775C0] to-[#6676C8] p-6 text-white shadow-lg">
        <p className="text-sm font-black text-white/70">{campaign.brand || "دار الأميرات"}</p>
        <h1 className="mt-2 text-2xl font-black">فرص المجتمع · {campaign.name}</h1>
        <p className="mt-3 text-sm font-semibold text-white/80">اضبط ما يراه المؤثر، ثم راجع حساباته مباشرة قبل القبول أو الرفض.</p>
        <Link href={`/dashboard/campaigns/${id}`} className="mt-5 inline-flex rounded-xl bg-white/15 px-4 py-2 text-xs font-black text-white">العودة للحملة</Link>
      </section>

      {query.saved === "1" ? <Notice>تم حفظ تفاصيل الفرصة التي ستظهر للمؤثر.</Notice> : null}
      {query.reviewed === "1" ? <Notice>تم تحديث قرار الطلب بنجاح.</Notice> : null}
      {query.error ? <ErrorNotice>{errorText(query.error)}</ErrorNotice> : null}

      <section className="rounded-[26px] border border-[#ECE1F1] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-[#4C335F]">إعدادات الفرصة للمؤثر</h2>
        <p className="mt-2 text-sm font-semibold text-[#8A92AA]">البريف والهاشتاقات والروابط المرجعية تُقرأ من بيانات الحملة الأساسية، وهنا تحدد الهدف والصور والمقابل وشروط التقديم.</p>

        <form action={updateOpportunitySettings} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="campaign_id" value={id} />
          <Field label="الظهور في بوابة المؤثر"><select name="portal_visibility" defaultValue={campaign.portal_visibility} className={input}><option value="hidden">مخفية</option><option value="invite_only">دعوات فقط</option><option value="community">متاحة للمجتمع</option></select></Field>
          <Field label="نوع الفرصة"><select name="opportunity_type" defaultValue={campaign.opportunity_type ?? ""} className={input}><option value="">غير محدد</option><option value="pr">PR</option><option value="paid">مدفوعة</option><option value="product">منتجات</option><option value="voucher">قسيمة</option><option value="hybrid">مختلطة</option><option value="other">أخرى</option></select></Field>

          <div className="md:col-span-2"><Field label="وصف مختصر للفرصة"><textarea name="opportunity_summary" defaultValue={campaign.opportunity_summary ?? ""} className={textarea}/></Field></div>
          <div className="md:col-span-2"><Field label="هدف الحملة الذي سيظهر للمؤثر"><textarea name="opportunity_goal" defaultValue={campaign.opportunity_goal ?? ""} className={textarea}/></Field></div>
          <div className="md:col-span-2"><Field label="متطلبات التقديم والتنفيذ"><textarea name="application_requirements" defaultValue={campaign.application_requirements ?? ""} className={textarea}/></Field></div>
          <div className="md:col-span-2"><Field label="صور المنتجات والمواد المرئية — رابط واحد في كل سطر"><textarea name="opportunity_image_urls" dir="ltr" defaultValue={(campaign.opportunity_image_urls ?? []).join("\n")} className={`${textarea} text-left`}/></Field></div>

          <Field label="طريقة المقابل"><select name="public_compensation_mode" defaultValue={campaign.public_compensation_mode ?? "none"} className={input}><option value="none">بدون مقابل مالي / PR</option><option value="fixed">مبلغ ثابت</option><option value="range">نطاق مبلغ</option><option value="negotiable">حسب الاتفاق</option></select></Field>
          <Field label="العملة"><input name="public_compensation_currency" defaultValue={campaign.public_compensation_currency ?? "SAR"} className={input} dir="ltr"/></Field>
          <Field label="المبلغ أو الحد الأدنى"><input name="public_compensation_amount" type="number" min="0" step="0.01" defaultValue={campaign.public_compensation_amount ?? ""} className={input}/></Field>
          <Field label="الحد الأعلى عند استخدام نطاق"><input name="public_compensation_max_amount" type="number" min="0" step="0.01" defaultValue={campaign.public_compensation_max_amount ?? ""} className={input}/></Field>
          <div className="md:col-span-2"><Field label="تفاصيل المقابل"><textarea name="public_compensation_notes" defaultValue={campaign.public_compensation_notes ?? ""} className={textarea} placeholder="مثال: يشمل ريل + 3 ستوريات، والدفع بعد النشر بـ 14 يوم"/></Field></div>

          <Field label="فتح التقديم"><input name="applications_open_at" type="datetime-local" defaultValue={toLocal(campaign.applications_open_at)} className={input}/></Field>
          <Field label="إغلاق التقديم"><input name="applications_close_at" type="datetime-local" defaultValue={toLocal(campaign.applications_close_at)} className={input}/></Field>
          <Field label="الحد الأقصى للطلبات"><input name="max_applications" type="number" min="1" defaultValue={campaign.max_applications ?? ""} className={input}/></Field>
          <Field label="الحد الأقصى للمقبولين"><input name="max_participants" type="number" min="1" defaultValue={campaign.max_participants ?? ""} className={input}/></Field>

          <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4 text-sm font-bold text-[#5C456B]">
            <input name="require_campaign_terms_acceptance" type="checkbox" defaultChecked={campaign.require_campaign_terms_acceptance ?? true} className="mt-1 h-5 w-5" />
            <span>إلزام المؤثر بالموافقة على تفاصيل الحملة والبريف والمقابل قبل إرسال طلب الانضمام.</span>
          </label>

          <button className="rounded-2xl bg-[#8F62A7] px-6 py-3 text-sm font-black text-white md:col-span-2">حفظ إعدادات الفرصة</button>
        </form>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <Preview title="البريف الحالي" value={campaign.brief || "غير محدد"} />
          <Preview title="الهاشتاقات الحالية" value={(campaign.hashtags ?? []).join(" ") || "غير محددة"} />
          <Preview title="المراجع الحالية" value={`${(campaign.reference_links ?? []).length} رابط`} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between"><div><h2 className="text-xl font-black text-[#432A57]">طلبات الانضمام</h2><p className="mt-1 text-sm font-semibold text-[#8A92AA]">{rows.length} طلب · افتح حسابات المؤثر مباشرة لتقييم الملاءمة</p></div></div>
        {rows.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-[#E8DDEA] bg-white p-12 text-center text-sm text-[#8C7B94]">لا توجد طلبات حتى الآن.</div>
        ) : rows.map((row) => {
          const influencer = relation(row.influencers);
          return (
            <article key={row.id} className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-[#4C335F]">{influencer?.full_name ?? "—"}</h3>
                  <p dir="ltr" className="mt-1 text-start text-xs font-bold text-[#8A92AA]">{influencer?.mobile_e164 ?? "—"}</p>
                  <p className="mt-2 text-xs font-bold text-[#8A92AA]">{[influencer?.city,influencer?.country].filter(Boolean).join(" · ") || "الموقع غير محدد"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status status={row.status}/>
                  {influencer?.id ? <Link href={`/dashboard/influencers/${influencer.id}`} className="rounded-xl border border-[#E6DAEB] px-3 py-2 text-xs font-black text-[#6D5EC0]">فتح ملف المؤثر</Link> : null}
                </div>
              </div>

              {influencer?.social_accounts?.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {influencer.social_accounts.map((social) => (
                    <div key={`${social.platform}-${social.username}`} className="rounded-2xl border border-[#EAE3F0] bg-[#FCFAFD] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p dir="ltr" className="text-sm font-black text-[#503A60]">@{social.username}</p>
                          <p className="mt-1 text-xs font-bold text-[#8A92AA]">{formatFollowers(social.followers_count)} متابع</p>
                        </div>
                        <SocialPlatformLink platform={social.platform} platformLabel={social.platform_label} url={social.profile_url || fallbackSocialUrl(social.platform, social.username)} compact />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <MiniMetric label="التفاعل" value={formatPercent(social.engagement_rate)} />
                        <MiniMetric label="المشاهدات" value={formatFollowers(social.average_views)} />
                        <MiniMetric label="الإعجابات" value={formatFollowers(social.average_likes)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {row.message ? <Preview title="رسالة المؤثر" value={row.message} /> : null}
                <Preview title="المقابل الذي وافق عليه" value={applicationCompensationLabel(row)} />
              </div>
              {row.terms_accepted_at ? <p className="mt-3 text-xs font-bold text-emerald-700">وافق على تفاصيل الحملة والمقابل في {formatDateTime(row.terms_accepted_at)}</p> : null}
              {row.rejection_reason ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span className="font-black">سبب الرفض: </span>{row.rejection_reason}</div> : null}
              {row.assignment_id ? <Link href={`/dashboard/campaigns/${id}/influencers/${row.assignment_id}`} className="mt-4 inline-flex rounded-xl border border-[#E6DAEB] px-4 py-2 text-xs font-black text-[#6D5EC0]">فتح التكليف الناتج</Link> : null}

              {row.status === "pending" || row.status === "shortlisted" ? (
                <form action={reviewApplication} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                  <input type="hidden" name="campaign_id" value={id}/>
                  <input type="hidden" name="application_id" value={row.id}/>
                  <input name="reason" placeholder="سبب الرفض — إلزامي عند الرفض" className={input}/>
                  <button name="decision" value="shortlisted" className="rounded-xl border border-[#D9CEE0] bg-white px-4 py-3 text-xs font-black text-[#6B5776]">قائمة مختصرة</button>
                  <button name="decision" value="accepted" className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">قبول وإنشاء تكليف</button>
                  <button name="decision" value="rejected" className="rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white">رفض مع السبب</button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

const input="h-12 w-full rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] px-4 text-sm font-bold outline-none focus:border-[#A170BA]";
const textarea=`${input} min-h-28 py-3`;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}</span>{children}</label>}
function Notice({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{children}</div>}
function ErrorNotice({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">{children}</div>}
function Status({status}:{status:string}){const l:Record<string,string>={pending:"بانتظار المراجعة",shortlisted:"القائمة المختصرة",accepted:"مقبول",rejected:"مرفوض",withdrawn:"مسحوب"};return <span className="rounded-full bg-[#F3F2FB] px-3 py-2 text-xs font-black text-[#5E72CF]">{l[status]??status}</span>}
function Preview({title,value}:{title:string;value:string}){return <div className="rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4"><p className="text-xs font-black text-[#705B7A]">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#66536E]">{value}</p></div>}
function MiniMetric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-white p-2"><p className="text-[10px] font-bold text-[#9B8BA2]">{label}</p><p className="mt-1 text-xs font-black text-[#5B4667]">{value}</p></div>}
function relation<T>(v:T|T[]|null):T|null{return Array.isArray(v)?v[0]??null:v}
function formatFollowers(v:number|null){if(v===null)return "—";return new Intl.NumberFormat("ar-SA",{notation:"compact",maximumFractionDigits:1}).format(v)}
function formatPercent(v:number|null){if(v===null)return "—";return `${new Intl.NumberFormat("ar-SA",{maximumFractionDigits:2}).format(v)}%`}
function formatDateTime(value:string){return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(value))}
function applicationCompensationLabel(row:Application){const currency=row.agreed_compensation_currency||"SAR";const n=(v:number|null)=>v===null?"":new Intl.NumberFormat("ar-SA",{maximumFractionDigits:2}).format(v);if(row.agreed_compensation_mode==="fixed")return `${n(row.agreed_compensation_amount)} ${currency}`;if(row.agreed_compensation_mode==="range")return `${n(row.agreed_compensation_amount)} - ${n(row.agreed_compensation_max_amount)} ${currency}`;if(row.agreed_compensation_mode==="negotiable")return "حسب الاتفاق";return "PR / بدون مقابل مالي"}
function fallbackSocialUrl(platform:string,username:string){const u=encodeURIComponent(username.replace(/^@/,""));const key=platform.toLowerCase();if(key==="instagram")return `https://www.instagram.com/${u}`;if(key==="tiktok")return `https://www.tiktok.com/@${u}`;if(key==="snapchat")return `https://www.snapchat.com/add/${u}`;if(key==="youtube")return `https://www.youtube.com/@${u}`;if(key==="x"||key==="twitter")return `https://x.com/${u}`;if(key==="facebook")return `https://www.facebook.com/${u}`;return null}
function toLocal(value:string|null){if(!value)return "";const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));const get=(t:string)=>parts.find((p)=>p.type===t)?.value??"";return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`}
function errorText(code:string){const l:Record<string,string>={invalid_settings:"إعدادات الفرصة غير صحيحة.",invalid_window:"موعد إغلاق التقديم يجب أن يكون بعد موعد الفتح.",invalid_limits:"حدود الطلبات والمقبولين يجب أن تكون أرقامًا صحيحة أكبر من صفر.",invalid_compensation:"راجع إعدادات المقابل المالي.",paid_compensation_required:"الحملة المدفوعة تحتاج تحديد المقابل المعروض للمؤثر.",invalid_images:"روابط الصور يجب أن تكون روابط HTTP/HTTPS صحيحة وبحد أقصى 12 صورة.",save_failed:"تعذر حفظ إعدادات الفرصة.",participant_limit:"تم الوصول للحد الأقصى للمقبولين.",influencer_unavailable:"المؤثر غير متاح حاليًا بسبب تكليف قائم أو فترة انتظار.",rejection_reason_required:"اكتب سبب الرفض قبل رفض الطلب.",review_failed:"تعذر تحديث قرار الطلب."};return l[code]??"تعذر إكمال العملية."}
