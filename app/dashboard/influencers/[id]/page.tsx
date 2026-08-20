/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { reviewInfluencerRegistration } from "../actions";
import SocialPlatformLink from "@/components/social-platform-link";

export const dynamic = "force-dynamic";

const assignmentLabels: Record<string, string> = {
  invited: "تمت الدعوة", accepted: "تم القبول", product_pending: "بانتظار المنتج",
  brief_pending: "بانتظار البريف", content_pending: "بانتظار المحتوى", under_review: "قيد المراجعة",
  needs_changes: "يحتاج تعديلات", approved: "معتمد", payment_pending: "بانتظار الدفع",
  paid: "مدفوع", closed: "مغلق", rejected: "مرفوض", cancelled: "ملغي",
};

export default async function InfluencerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, supabase } = await requirePermission("influencers", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  const canUpdate = hasPermission(profile.role, "influencers", "update");
  const canApprove = hasPermission(profile.role, "influencers", "approve");
  const canViewFinance = ["admin", "finance"].includes(profile.role);
  const t = locale === "en" ? {
    back: "Back to influencers", update: "Update profile", approve: "Approve", reject: "Reject",
    completion: "Profile completion", followers: "Total followers", engagement: "Average engagement", availability: "Availability",
    available: "Available", linked: "Linked", cooldown: "Cooldown", personal: "Personal information", mobile: "Mobile", email: "Email", gender: "Gender", city: "City", country: "Country", portal: "Portal account", enabled: "Enabled", disabled: "Not enabled", female: "Female", male: "Male",
    categories: "Advertising categories", preferences: "Content preferences", social: "Social accounts", views: "Views", likes: "Likes", openAccount: "Open account ↗", noSocial: "No social accounts registered.",
    campaigns: "Current and previous campaigns", noCampaigns: "The influencer has not been linked to a campaign yet.", campaignAvailability: "Campaign availability", availableLink: "Available to assign", activeCampaign: "Currently linked to a campaign", cooldownState: "Within cooldown period", availableAfter: "Available after", cooldownRemaining: "Days remaining",
    dues: "Dues and payments", paid: "Total paid", pending: "Pending payment", compensationItems: "Compensation items", finance: "Protected financial data", holder: "Account holder", bank: "Bank", iban: "IBAN", nationalId: "National ID", mawthooq: "Mawthooq number", financeNote: "Sensitive data is visible only to admins and finance, and values are masked in the interface.",
    system: "System information", fileStatus: "Profile status", archive: "Archive match", source: "Registration source", updated: "Last update",
  } : {
    back: "العودة إلى المؤثرين", update: "تحديث الملف", approve: "اعتماد", reject: "رفض",
    completion: "اكتمال الملف", followers: "إجمالي المتابعين", engagement: "متوسط التفاعل", availability: "حالة التوفر",
    available: "متاح", linked: "مرتبط", cooldown: "حظر", personal: "البيانات الشخصية", mobile: "الجوال", email: "البريد الإلكتروني", gender: "الجنس", city: "المدينة", country: "الدولة", portal: "حساب البوابة", enabled: "مفعل", disabled: "غير مفعل", female: "أنثى", male: "ذكر",
    categories: "مجالات الإعلان", preferences: "تفضيلات المحتوى", social: "حسابات التواصل الاجتماعي", views: "المشاهدات", likes: "الإعجابات", openAccount: "فتح الحساب ↗", noSocial: "لا توجد حسابات تواصل مسجلة.",
    campaigns: "الحملات السابقة والحالية", noCampaigns: "لم يتم ربط المؤثر بأي حملة حتى الآن.", campaignAvailability: "التوفر للحملات", availableLink: "متاح للربط", activeCampaign: "مرتبط بحملة حاليًا", cooldownState: "داخل فترة الحظر", availableAfter: "متاح بعد", cooldownRemaining: "الأيام المتبقية لفك الحظر",
    dues: "المستحقات والمدفوعات", paid: "إجمالي المدفوع", pending: "بانتظار الدفع", compensationItems: "بنود المقابل", finance: "البيانات المالية المحمية", holder: "اسم صاحب الحساب", bank: "البنك", iban: "الآيبان", nationalId: "الهوية", mawthooq: "رقم موثوق", financeNote: "تظهر البيانات الحساسة للمدير والمالية فقط، والقيم مقنّعة في واجهة العرض.",
    system: "معلومات النظام", fileStatus: "حالة الملف", archive: "مطابقة الأرشيف", source: "مصدر التسجيل", updated: "آخر تحديث",
  };

  const { data: influencer, error } = await supabase
    .from("influencers")
    .select("id,full_name,mobile_e164,email,city,country,gender,mawthooq_status,preferred_ad_categories,content_style_preferences,account_status,archive_match_status,registration_source,user_id,profile_completion,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!influencer) notFound();

  const [{ data: social }, { data: assignments }, { data: financial }] = await Promise.all([
    supabase.from("social_accounts").select("id,platform,platform_label,username,profile_url,followers_count,average_likes,average_views,average_comments,engagement_rate,female_audience,male_audience,audience_main_city,audience_main_country,last_checked_at").eq("influencer_id", id).order("followers_count", { ascending: false }),
    supabase.from("campaign_assignments").select("id,campaign_id,status,execution_type,content_due_at,publishing_date,agreed_amount,currency,availability_blocked_until,settled_at,created_at").eq("influencer_id", id).order("created_at", { ascending: false }),
    canViewFinance ? supabase.from("influencer_financial_profiles").select("national_id,bank_name,iban,account_holder_name,mawthooq_number,mawthooq_expiry_date").eq("influencer_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const assignmentRows = assignments ?? [];
  const campaignIds = Array.from(new Set(assignmentRows.map((item) => item.campaign_id)));
  const assignmentIds = assignmentRows.map((item) => item.id);
  const [{ data: campaigns }, { data: payments }, { data: compensations }] = await Promise.all([
    campaignIds.length ? supabase.from("campaigns").select("id,name,brand,status").in("id", campaignIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? supabase.from("payments").select("id,assignment_id,type,amount,status,paid_at").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? supabase.from("assignment_compensations").select("id,assignment_id,type,amount,product_reference_value").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
  ]);
  const campaignMap = new Map((campaigns ?? []).map((item) => [item.id, item]));
  const totalFollowers = (social ?? []).reduce((sum, item) => sum + Number(item.followers_count ?? 0), 0);
  const averageEngagement = (social ?? []).length ? (social ?? []).reduce((sum, item) => sum + Number(item.engagement_rate ?? 0), 0) / (social ?? []).length : 0;
  const totalPaid = (payments ?? []).filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pendingAmount = (payments ?? []).filter((item) => !["paid", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const activeAssignment = assignmentRows.find((item) => !["paid", "closed", "rejected", "cancelled"].includes(item.status));
  const currentTime = Date.now();
  const cooldown = assignmentRows.find(
    (item) =>
      item.availability_blocked_until &&
      new Date(item.availability_blocked_until).getTime() > currentTime,
  );
  const availability = activeAssignment ? "active" : cooldown ? "cooldown" : "available";
  const cooldownRemainingDays = cooldown?.availability_blocked_until
    ? Math.max(1, Math.ceil((new Date(cooldown.availability_blocked_until).getTime() - currentTime) / 86_400_000))
    : 0;
  const fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA");
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/influencers" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#6071C3]"><DashboardIcon name="arrow" className="h-4 w-4 rotate-180" /> {t.back}</Link>
        <div className="flex gap-2">
          {canUpdate ? <Link href={`/?mobile=${encodeURIComponent(influencer.mobile_e164)}`} className="rounded-2xl border border-[#DCE1F3] bg-white px-4 py-2.5 text-sm font-extrabold text-[#5365B8]">{t.update}</Link> : null}
          {canApprove && influencer.account_status === "pending_review" ? <><Decision id={id} decision="approve" label={t.approve} className="bg-emerald-600 text-white" /><Decision id={id} decision="reject" label={t.reject} className="bg-rose-50 text-rose-700" /></> : null}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6679D1,#5064BD_62%,#8797DE)] p-6 text-white shadow-[0_22px_60px_rgba(64,82,172,.23)] sm:p-8">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full border border-white/12" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/16 text-2xl font-black ring-1 ring-white/20">{String(influencer.full_name ?? "")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part: string) => part.charAt(0))
  .join("")}</span>
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black sm:text-3xl">{influencer.full_name}</h2>{influencer.mawthooq_status ? <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-50">موثوق</span> : null}</div><p dir="ltr" className="mt-2 text-start text-sm font-bold text-white/75">{influencer.mobile_e164}</p><p className="mt-1 text-sm font-bold text-white/68">{[influencer.city, influencer.country].filter(Boolean).join("، ")}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label={t.completion} value={`${influencer.profile_completion ?? 0}%`} />
            <HeroMetric label={t.followers} value={fmt.format(totalFollowers)} />
            <HeroMetric label={t.engagement} value={`${averageEngagement.toFixed(1)}%`} />
            <HeroMetric label={t.availability} value={availability === "available" ? t.available : availability === "active" ? t.linked : t.cooldown} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          <Panel title={t.personal}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label={t.mobile} value={influencer.mobile_e164} ltr />
              <Info label={t.email} value={influencer.email} ltr />
              <Info label={t.gender} value={influencer.gender === "female" ? t.female : influencer.gender === "male" ? t.male : null} />
              <Info label={t.city} value={influencer.city} />
              <Info label={t.country} value={influencer.country} />
              <Info label={t.portal} value={influencer.user_id ? t.enabled : t.disabled} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2"><Tags title={t.categories} values={influencer.preferred_ad_categories ?? []} /><Tags title={t.preferences} values={influencer.content_style_preferences ?? []} /></div>
          </Panel>

          <Panel title={t.social}>
            <div className="grid gap-4 md:grid-cols-2">
              {(social ?? []).map((account) => <article key={account.id} className="rounded-2xl border border-[#E4E8F5] bg-[#FAFBFF] p-4"><div className="flex items-start justify-between gap-3"><div><SocialPlatformLink platform={account.platform} platformLabel={account.platform_label} url={account.profile_url}/>{account.username ? <p className="mt-1 font-black text-[#33447F]">@{account.username}</p> : null}</div><span className="rounded-xl bg-[#EEF1FF] px-2.5 py-1 text-xs font-black text-[#576AC2]">{fmt.format(Number(account.followers_count ?? 0))}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Mini label={t.views} value={fmt.format(Number(account.average_views ?? 0))} /><Mini label={t.likes} value={fmt.format(Number(account.average_likes ?? 0))} /><Mini label={t.engagement} value={`${Number(account.engagement_rate ?? 0).toFixed(1)}%`} /></div>{account.profile_url ? <a href={account.profile_url} target="_blank" rel="noreferrer" className="mt-4 block text-xs font-extrabold text-[#6072C5]">{t.openAccount}</a> : null}</article>)}
              {(social ?? []).length === 0 ? <Empty text={t.noSocial} /> : null}
            </div>
          </Panel>

          <Panel title={t.campaigns}>
            <div className="space-y-3">
              {assignmentRows.map((assignment) => { const campaign = campaignMap.get(assignment.campaign_id); return <Link key={assignment.id} href={`/dashboard/campaigns/${assignment.campaign_id}`} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5E8F5] bg-[#FAFBFF] p-4 transition hover:border-[#BFC9ED] sm:flex-row sm:items-center"><div><p className="font-black text-[#33447F]">{campaign?.name ?? "حملة"}</p><p className="mt-1 text-xs font-bold text-[#9299AE]">{campaign?.brand ?? "—"} · {assignment.execution_type ?? "—"}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-[#EEF1FF] px-3 py-1 text-xs font-black text-[#586AC1]">{assignmentLabels[assignment.status] ?? assignment.status}</span><span className="text-sm font-black text-[#455791]">{money.format(Number(assignment.agreed_amount ?? 0))}</span></div></Link>; })}
              {assignmentRows.length === 0 ? <Empty text={t.noCampaigns} /> : null}
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title={t.campaignAvailability}>
            <div className={`rounded-2xl p-4 ${availability === "available" ? "bg-emerald-50 text-emerald-800" : availability === "active" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}><p className="font-black">{availability === "available" ? t.availableLink : availability === "active" ? t.activeCampaign : t.cooldownState}</p>{activeAssignment ? <p className="mt-2 text-sm font-bold opacity-75">{campaignMap.get(activeAssignment.campaign_id)?.name}</p> : null}{cooldown?.availability_blocked_until ? <><p className="mt-2 text-sm font-bold opacity-75">{t.availableAfter} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" }).format(new Date(cooldown.availability_blocked_until))}</p><p className="mt-1 text-sm font-black">{t.cooldownRemaining}: {cooldownRemainingDays} {locale === "en" ? "days" : "يوم"}</p></> : null}</div>
          </Panel>

          <Panel title={t.dues}>
            <div className="grid gap-3"><MoneyCard label={t.paid} value={money.format(totalPaid)} tone="green" /><MoneyCard label={t.pending} value={money.format(pendingAmount)} tone="amber" /><MoneyCard label={t.compensationItems} value={String((compensations ?? []).length)} tone="blue" /></div>
          </Panel>

          {canViewFinance ? <Panel title={t.finance}><div className="space-y-3"><Info label={t.holder} value={financial?.account_holder_name} /><Info label={t.bank} value={financial?.bank_name} /><Info label={t.iban} value={financial?.iban ? maskValue(financial.iban) : null} ltr /><Info label={t.nationalId} value={financial?.national_id ? maskValue(financial.national_id) : null} ltr /><Info label={t.mawthooq} value={financial?.mawthooq_number} /></div><p className="mt-4 text-[11px] font-bold leading-6 text-[#9AA1B4]">{t.financeNote}</p></Panel> : null}

          <Panel title={t.system}><div className="space-y-3"><Info label={t.fileStatus} value={influencer.account_status} /><Info label={t.archive} value={influencer.archive_match_status} /><Info label={t.source} value={influencer.registration_source} /><Info label={t.updated} value={new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(influencer.updated_at))} /></div></Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6"><h3 className="mb-5 text-lg font-black text-[#34457E]">{title}</h3>{children}</section>; }
function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/15"><p className="text-[11px] font-bold text-white/65">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function Info({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) { return <div><p className="text-xs font-extrabold text-[#939BB2]">{label}</p><p dir={ltr ? "ltr" : undefined} className={`mt-1.5 min-h-6 text-sm font-black text-[#3D4E83] ${ltr ? "text-start" : ""}`}>{value || "—"}</p></div>; }
function Tags({ title, values }: { title: string; values: string[] }) { return <div><p className="text-xs font-extrabold text-[#939BB2]">{title}</p><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map((value) => <span key={value} className="rounded-full bg-[#EEF1FF] px-3 py-1 text-xs font-black text-[#5769BF]">{value}</span>) : <span className="text-sm font-bold text-[#A0A6B7]">—</span>}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-2"><p className="text-[10px] font-bold text-[#9AA1B4]">{label}</p><p className="mt-1 text-xs font-black text-[#485A94]">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full rounded-2xl border border-dashed border-[#DDE2F3] bg-[#FAFBFF] p-8 text-center text-sm font-bold text-[#929AB1]">{text}</div>; }
function MoneyCard({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "blue" }) { const classes = { green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", blue: "bg-[#EEF1FF] text-[#5365B8]" }[tone]; return <div className={`rounded-2xl p-4 ${classes}`}><p className="text-xs font-extrabold opacity-70">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function Decision({ id, decision, label, className }: { id: string; decision: "approve" | "reject"; label: string; className: string }) { return <form action={reviewInfluencerRegistration}><input type="hidden" name="influencer_id" value={id} /><input type="hidden" name="decision" value={decision} /><button className={`rounded-2xl px-4 py-2.5 text-sm font-black ${className}`}>{label}</button></form>; }
function maskValue(value: string) { const cleaned = value.replace(/\s/g, ""); return cleaned.length <= 6 ? "••••" : `${cleaned.slice(0, 3)}••••••${cleaned.slice(-3)}`; }
