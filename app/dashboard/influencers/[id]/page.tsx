/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { PORTAL_ACCESS_OPEN_STATUSES } from "@/lib/domain/portal-access";
import SocialPlatformLink from "@/components/social-platform-link";
import { WorkHistoryForm } from "./work-history-form";
import { WorkHistoryDeleteButton } from "./work-history-delete-button";
import { assignInfluencerCoordinator, setInfluencerManagementMode } from "./directory-actions";
import { InfluencerEvaluationPanel, type EvaluationSummary } from "./evaluation-panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendInfluencerPortalAccess, sendInfluencerPasswordRecovery, setInfluencerPortalAccountState, setInfluencerRestriction, updateInfluencerPortalEmail } from "./operations-actions";

export const dynamic = "force-dynamic";

const assignmentLabelsAr: Record<string, string> = {
  invited: "تمت الدعوة", accepted: "تم القبول", product_pending: "بانتظار المنتج",
  brief_pending: "بانتظار البريف", content_pending: "بانتظار المحتوى", under_review: "قيد المراجعة",
  needs_changes: "يحتاج تعديلات", approved: "معتمد", payment_pending: "بانتظار الدفع",
  paid: "مدفوع", closed: "مغلق", rejected: "مرفوض", cancelled: "ملغي",
};
const assignmentLabelsEn: Record<string, string> = {
  invited: "Invited", accepted: "Accepted", product_pending: "Product pending",
  brief_pending: "Brief pending", content_pending: "Content pending", under_review: "Under review",
  needs_changes: "Needs changes", approved: "Approved", payment_pending: "Payment pending",
  paid: "Paid", closed: "Closed", rejected: "Rejected", cancelled: "Cancelled",
};

type PageParams = { id: string };
type PageSearch = { history_saved?: string; history_deleted?: string; history_error?: string; activation_sent?: string; activation_link?: string; directory_saved?: string; directory_error?: string; evaluation_saved?: string; evaluation_error?: string; restriction_saved?: string; restriction_error?: string; portal_saved?: string; portal_error?: string };

export default async function InfluencerDetailsPage({ params, searchParams }: { params: Promise<PageParams>; searchParams?: Promise<PageSearch> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("influencers", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const historyCopy = dictionary.workHistory;
  const canUpdate = hasPermission(profile.role, "influencers", "update");
  const canApprove = hasPermission(profile.role, "influencers", "approve");
  const canDeleteHistory = hasPermission(profile.role, "influencers", "delete");
  const canViewFinance = ["admin", "finance"].includes(profile.role);
  const isAdmin = profile.role === "admin";
  const canEvaluate = ["admin", "coordinator", "reviewer"].includes(profile.role);
  const assignmentLabels = locale === "en" ? assignmentLabelsEn : assignmentLabelsAr;
  const t = locale === "en" ? {
    back: "Back to influencers", update: "Update profile", approve: "Approve", reject: "Reject", mawthooqBadge: "Mawthooq",
    completion: "Profile completion", followers: "Total followers", engagement: "Average engagement", availability: "Availability",
    available: "Available", linked: "Linked", cooldown: "Cooldown", personal: "Personal information", mobile: "Mobile", email: "Email", gender: "Gender", city: "City", country: "Country", portal: "Portal account", enabled: "Enabled", disabled: "Not enabled", female: "Female", male: "Male",
    categories: "Advertising categories", preferences: "Content preferences", social: "Social accounts", views: "Views", likes: "Likes", openAccount: "Open account ↗", noSocial: "No social accounts registered.",
    campaigns: "Current and previous campaigns", campaignFallback: "Campaign", noCampaigns: "The influencer has not been linked to a campaign yet.", campaignAvailability: "Campaign availability", availableLink: "Available to assign", activeCampaign: "Currently linked to a campaign", cooldownState: "Active exclusivity restriction", availableAfter: "Restricted until", cooldownRemaining: "Days remaining", days: "days", allCampaignsRestriction: "All campaigns", selectedBrandsRestriction: "Selected brands", restrictedBrands: "Restricted brands",
    dues: "Dues and payments", paid: "Total paid", pending: "Pending payment", compensationItems: "Compensation items", finance: "Protected financial data", holder: "Account holder", bank: "Bank", iban: "IBAN", nationalId: "National ID", mawthooq: "Mawthooq number", financeNote: "Sensitive data is visible only to admins and finance, and values are masked in the interface.",
    system: "System information", fileStatus: "Profile status", archive: "Archive match", source: "Registration source", updated: "Last update", openReview: "Open review workflow", noAccessRequest: "No access request",
    directory: "Directory status", owner: "Coordinator", bio: "Bio", primaryCategory: "Primary category", unassigned: "Unassigned",
    directoryStatuses: { archived: "Archived", activation_pending: "Awaiting activation", active: "Active", managed: "VIP / Managed", suspended: "Suspended" },
    activationTitle: "Portal activation", activationDescription: "Archived creators must register through the public registration form first. The system then proposes archive matches for admin approval; direct archive activation is disabled. VIP / Managed remains the admin-approved exception.",
    activationEmail: "Activation email", generateLink: "Generate activation link", regenerateLink: "Regenerate activation link", activationLink: "Secure activation link", copyLink: "Copy this link and send it to the creator.",
    activationSent: "The activation link was generated. It expires in 72 hours.", directorySaved: "The creator status was updated.",
    managedTitle: "VIP / Managed", managedDescription: "Use this only for creators managed by the team, an agent, or an agency without requiring portal activation.",
    contactName: "Manager / agency contact", contactMobile: "Contact mobile", contactEmail: "Contact email", reason: "Reason / internal note", setManaged: "Set as VIP / Managed", suspend: "Suspend creator", restoreArchive: "Return to archived", restoreActive: "Reactivate portal account",
    assignOwner: "Assign coordinator", saveOwner: "Save coordinator", activationRequired: "Portal activation is required before creating a new campaign assignment.", managedAllowed: "This profile can be assigned to campaigns while managed by staff.",
    errors: { email_required: "Enter a valid activation email.", already_active: "This creator already has an active portal account.", activation_failed: "Could not generate the activation link.", reason_required: "A reason is required.", active_archive_forbidden: "An active portal account cannot be returned to archived.", status_failed: "Could not update the creator status.", coordinator_failed: "Could not update the coordinator." },
  } : {
    back: "العودة إلى المؤثرين", update: "تحديث الملف", approve: "اعتماد", reject: "رفض", mawthooqBadge: "موثوق",
    completion: "اكتمال الملف", followers: "إجمالي المتابعين", engagement: "متوسط التفاعل", availability: "حالة التوفر",
    available: "متاح", linked: "مرتبط", cooldown: "حظر", personal: "البيانات الشخصية", mobile: "الجوال", email: "البريد الإلكتروني", gender: "الجنس", city: "المدينة", country: "الدولة", portal: "حساب البوابة", enabled: "مفعل", disabled: "غير مفعل", female: "أنثى", male: "ذكر",
    categories: "مجالات الإعلان", preferences: "تفضيلات المحتوى", social: "حسابات التواصل الاجتماعي", views: "المشاهدات", likes: "الإعجابات", openAccount: "فتح الحساب ↗", noSocial: "لا توجد حسابات تواصل مسجلة.",
    campaigns: "الحملات السابقة والحالية", campaignFallback: "حملة", noCampaigns: "لم يتم ربط المؤثر بأي حملة حتى الآن.", campaignAvailability: "التوفر للحملات", availableLink: "متاح للربط", activeCampaign: "مرتبط بحملة حاليًا", cooldownState: "حظر أو حصرية فعالة", availableAfter: "الحظر حتى", cooldownRemaining: "الأيام المتبقية", days: "يوم", allCampaignsRestriction: "جميع الحملات", selectedBrandsRestriction: "براندات محددة", restrictedBrands: "البراندات المحظورة",
    dues: "المستحقات والمدفوعات", paid: "إجمالي المدفوع", pending: "بانتظار الدفع", compensationItems: "بنود المقابل", finance: "البيانات المالية المحمية", holder: "اسم صاحب الحساب", bank: "البنك", iban: "الآيبان", nationalId: "الهوية", mawthooq: "رقم موثوق", financeNote: "تظهر البيانات الحساسة للمدير والمالية فقط، والقيم مقنّعة في واجهة العرض.",
    system: "معلومات النظام", fileStatus: "حالة الملف", archive: "مطابقة الأرشيف", source: "مصدر التسجيل", updated: "آخر تحديث", openReview: "فتح مسار المراجعة", noAccessRequest: "لا يوجد طلب انضمام مرتبط",
    directory: "حالة المؤثر", owner: "منسق المتابعة", bio: "نبذة الحساب", primaryCategory: "التصنيف الأساسي", unassigned: "غير مسند",
    directoryStatuses: { archived: "مؤرشف", activation_pending: "بانتظار التفعيل", active: "مفعّل", managed: "VIP / Managed", suspended: "موقوف" },
    activationTitle: "تفعيل بوابة المؤثر", activationDescription: "المؤثر المؤرشف يجب أن يسجل أولًا من نموذج التسجيل العام. بعدها يقترح النظام مطابقة الأرشيف ويعتمدها المدير يدويًا؛ التفعيل المباشر من الأرشيف متوقف. الاستثناء هو VIP / Managed بعد اعتماد مدير النظام.",
    activationEmail: "بريد التفعيل", generateLink: "إنشاء رابط التفعيل", regenerateLink: "إعادة إنشاء رابط التفعيل", activationLink: "رابط التفعيل الآمن", copyLink: "انسخ الرابط وأرسله للمؤثر. صلاحيته 72 ساعة.",
    activationSent: "تم إنشاء رابط التفعيل بنجاح وصلاحيته 72 ساعة.", directorySaved: "تم تحديث حالة المؤثر.",
    managedTitle: "VIP / Managed", managedDescription: "استخدمها للمشاهير أو من تتم إدارتهم عبر الفريق أو مدير أعمال أو وكالة بدون إلزامهم بتفعيل البوابة.",
    contactName: "مدير الأعمال / جهة التواصل", contactMobile: "رقم التواصل", contactEmail: "بريد التواصل", reason: "السبب / ملاحظة داخلية", setManaged: "تحويل إلى VIP / Managed", suspend: "إيقاف المؤثر", restoreArchive: "إرجاع إلى مؤرشف", restoreActive: "إعادة تفعيل حساب البوابة",
    assignOwner: "تعيين منسق المتابعة", saveOwner: "حفظ المنسق", activationRequired: "يجب تفعيل البوابة قبل إنشاء تكليف جديد لهذا المؤثر.", managedAllowed: "يمكن ربط هذا الملف بالحملات لأنه مُدار بواسطة الفريق.",
    errors: { email_required: "أدخل بريد تفعيل صحيحًا.", already_active: "هذا المؤثر لديه بوابة مفعّلة بالفعل.", activation_failed: "تعذر إنشاء رابط التفعيل.", reason_required: "اكتب سبب الإجراء.", active_archive_forbidden: "لا يمكن إعادة حساب بوابة مفعّل إلى مؤرشف.", status_failed: "تعذر تحديث حالة المؤثر.", coordinator_failed: "تعذر تحديث منسق المتابعة." },
  };

  const { data: influencer, error } = await supabase
    .from("influencers")
    .select("id,full_name,mobile_e164,email,city,country,gender,mawthooq_status,preferred_ad_categories,content_style_preferences,account_status,activation_status,directory_status,profile_bio,primary_category,assigned_coordinator_id,managed_contact_name,managed_contact_mobile,managed_contact_email,directory_notes,activation_invited_at,archive_match_status,registration_source,user_id,profile_completion,restriction_status,restriction_reason,restriction_expires_at,restriction_updated_at,created_at,updated_at")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!influencer) notFound();

  const { data: accessRequest } = await supabase.from("portal_access_requests").select("id,status").eq("influencer_id", id).in("status", PORTAL_ACCESS_OPEN_STATUSES).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: coordinatorRows } = await supabase.from("profiles").select("id,full_name,role").in("role", ["admin", "coordinator"]).eq("is_active", true).order("full_name");
  const assignedCoordinator = (coordinatorRows ?? []).find((item) => item.id === influencer.assigned_coordinator_id);

  const [{ data: social }, { data: assignments }, { data: financial }, { data: historyRows }, { data: brands }] = await Promise.all([
    supabase.from("social_accounts").select("id,platform,platform_label,username,profile_url,followers_count,average_likes,average_views,average_comments,engagement_rate,female_audience,male_audience,audience_main_city,audience_main_country,last_checked_at").eq("influencer_id", id).order("followers_count", { ascending: false }),
    supabase.from("campaign_assignments").select("id,campaign_id,status,execution_type,content_due_at,publishing_date,agreed_amount,currency,availability_blocked_until,settled_at,created_at,exclusivity_scope,exclusivity_start_at,exclusivity_end_at,exclusivity_lifted_at,exclusivity_lift_reason").eq("influencer_id", id).order("created_at", { ascending: false }),
    canViewFinance ? supabase.from("influencer_financial_profiles").select("national_id,bank_name,iban,account_holder_name,mawthooq_number,mawthooq_expiry_date").eq("influencer_id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("influencer_work_history").select("id,brand_id,campaign_id,assignment_id,brand_name,campaign_name,collaboration_type,collaboration_status,collaboration_date,platform,content_type,content_url,compensation_amount,compensation_currency,views,likes,comments,shares,engagement_rate,outcome,performance_note,internal_notes,source,source_record_id,created_at,updated_at").eq("influencer_id", id).order("collaboration_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("brands").select("id,name_ar,name_en").eq("is_active", true).order(locale === "en" ? "name_en" : "name_ar"),
  ]);

  const { data: evaluationSummary } = await supabase.rpc("get_influencer_evaluation_summary", { p_influencer_id: id });

  let portalAuthUser: { id: string; email?: string; last_sign_in_at?: string | null } | null = null;
  if (isAdmin && influencer.user_id) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.getUserById(influencer.user_id);
      portalAuthUser = data.user ? { id: data.user.id, email: data.user.email, last_sign_in_at: data.user.last_sign_in_at } : null;
    } catch {
      portalAuthUser = null;
    }
  }

  const assignmentRows = assignments ?? [];
  const campaignIds = Array.from(new Set(assignmentRows.map((item) => item.campaign_id)));
  const assignmentIds = assignmentRows.map((item) => item.id);
  const [{ data: campaigns }, { data: payments }, { data: compensations }, { data: exclusivityBrandRows }] = await Promise.all([
    campaignIds.length ? supabase.from("campaigns").select("id,name,brand,status").in("id", campaignIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? supabase.from("payments").select("id,assignment_id,type,amount,status,paid_at").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? supabase.from("assignment_compensations").select("id,assignment_id,type,amount,product_reference_value").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? supabase.from("assignment_exclusivity_brands").select("assignment_id,brands(name_ar,name_en)").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
  ]);

  const history = historyRows ?? [];
  const campaignMap = new Map((campaigns ?? []).map((item) => [item.id, item]));
  const totalFollowers = (social ?? []).reduce((sum, item) => sum + Number(item.followers_count ?? 0), 0);
  const averageEngagement = (social ?? []).length ? (social ?? []).reduce((sum, item) => sum + Number(item.engagement_rate ?? 0), 0) / (social ?? []).length : 0;
  const totalPaid = (payments ?? []).filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pendingAmount = (payments ?? []).filter((item) => !["paid", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const activeAssignment = assignmentRows.find((item) => !["paid", "closed", "rejected", "cancelled"].includes(item.status));
  const currentTime = Date.now();
  const restriction = assignmentRows.find((item) => !item.exclusivity_lifted_at && ["brands", "all"].includes(String(item.exclusivity_scope)) && item.exclusivity_end_at && new Date(item.exclusivity_end_at).getTime() > currentTime);
  const availability = activeAssignment ? "active" : restriction ? "restricted" : "available";
  const restrictionRemainingDays = restriction?.exclusivity_end_at ? Math.max(1, Math.ceil((new Date(restriction.exclusivity_end_at).getTime() - currentTime) / 86_400_000)) : 0;
  const restrictionBrandNames = restriction ? ((exclusivityBrandRows ?? []) as Array<{ assignment_id: string; brands: { name_ar: string; name_en: string } | { name_ar: string; name_en: string }[] | null }>).filter((row) => row.assignment_id === restriction.id).flatMap((row) => Array.isArray(row.brands) ? row.brands : row.brands ? [row.brands] : []).map((brand) => locale === "en" ? brand.name_en : brand.name_ar) : [];
  const fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA");
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA", { dateStyle: "medium" });
  const historyBrandCount = new Set(history.map((item) => item.brand_id || item.brand_name).filter(Boolean)).size;
  const historyViews = history.filter((item) => item.views != null).map((item) => Number(item.views));
  const historyAvgViews = historyViews.length ? Math.round(historyViews.reduce((a,b)=>a+b,0) / historyViews.length) : 0;
  const latestHistoryDate = history.find((item) => item.collaboration_date)?.collaboration_date ?? null;

  const historyNotice = query.history_saved ? { tone: "success" as const, text: historyCopy.saved } : query.history_deleted ? { tone: "success" as const, text: historyCopy.deleted } : query.history_error ? { tone: "error" as const, text: query.history_error === "duplicate" ? historyCopy.duplicate : historyCopy.saveFailed } : null;
  const directoryNotice = query.activation_sent ? { tone: "success" as const, text: t.activationSent } : query.directory_saved ? { tone: "success" as const, text: t.directorySaved } : query.directory_error ? { tone: "error" as const, text: t.errors[query.directory_error as keyof typeof t.errors] ?? t.errors.status_failed } : null;
  const directoryStatus = (influencer.directory_status ?? "archived") as keyof typeof t.directoryStatuses;
  const restrictionCopy = dictionary.operations.restriction;
  const portalCopy = dictionary.operations.portalAdmin;
  const restrictionStatus = (influencer.restriction_status ?? "normal") as "normal" | "watchlist" | "blacklisted";
  const restrictionNotice = query.restriction_saved ? { tone: "success" as const, text: restrictionCopy.saved } : query.restriction_error ? { tone: "error" as const, text: query.restriction_error === "reason_required" ? restrictionCopy.reasonRequired : restrictionCopy.adminOnly } : null;
  const portalNotice = query.portal_saved ? { tone: "success" as const, text: query.portal_saved === "email" ? portalCopy.emailUpdated : query.portal_saved === "access" ? portalCopy.accessSent : query.portal_saved === "recovery" ? portalCopy.recoverySent : query.portal_saved === "suspended" ? portalCopy.suspend : portalCopy.reactivate } : query.portal_error ? { tone: "error" as const, text: query.portal_error === "invalid_email" ? portalCopy.invalidEmail : query.portal_error === "no_account" ? portalCopy.noAccount : portalCopy.actionFailed } : null;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/influencers" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#6071C3]"><DashboardIcon name="arrow" className="h-4 w-4 rotate-180" /> {t.back}</Link>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/influencers/archive" className="rounded-2xl border border-[#E2D8E8] bg-[#FCF8FD] px-4 py-2.5 text-sm font-extrabold text-[#8A5AA3]">{historyCopy.archiveButton}</Link>
          {canUpdate ? <Link href={`/?mobile=${encodeURIComponent(influencer.mobile_e164)}`} className="rounded-2xl border border-[#DCE1F3] bg-white px-4 py-2.5 text-sm font-extrabold text-[#8A5AA3]">{t.update}</Link> : null}
          {canApprove && influencer.account_status === "pending_review" ? (accessRequest ? <Link href={`/dashboard/access-requests/${accessRequest.id}`} className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800">{t.openReview}</Link> : <span className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600">{t.noAccessRequest}</span>) : null}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#A170BA,#5064BD_62%,#8797DE)] p-6 text-white shadow-[0_22px_60px_rgba(64,82,172,.23)] sm:p-8">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full border border-white/12" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/16 text-2xl font-black ring-1 ring-white/20">{String(influencer.full_name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part.charAt(0)).join("")}</span>
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black sm:text-3xl">{influencer.full_name}</h2>{influencer.mawthooq_status ? <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-50">{t.mawthooqBadge}</span> : null}<span className="rounded-full bg-white/16 px-3 py-1 text-xs font-black text-white ring-1 ring-white/20">{t.directoryStatuses[directoryStatus]}</span>{restrictionStatus !== "normal" ? <span className={`rounded-full px-3 py-1 text-xs font-black ${restrictionStatus === "blacklisted" ? "bg-rose-500/30 text-white" : "bg-amber-300/25 text-white"}`}>{restrictionStatus === "blacklisted" ? restrictionCopy.blacklisted : restrictionCopy.watchlist}</span> : null}</div><p dir="ltr" className="mt-2 text-start text-sm font-bold text-white/75">{influencer.mobile_e164}</p><p className="mt-1 text-sm font-bold text-white/68">{[influencer.city, influencer.country].filter(Boolean).join("، ")}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <HeroMetric label={t.completion} value={`${influencer.profile_completion ?? 0}%`} />
            <HeroMetric label={t.followers} value={fmt.format(totalFollowers)} />
            <HeroMetric label={t.engagement} value={`${averageEngagement.toFixed(1)}%`} />
            <HeroMetric label={historyCopy.total} value={fmt.format(history.length)} />
            <HeroMetric label={t.availability} value={availability === "available" ? t.available : availability === "active" ? t.linked : t.cooldown} />
          </div>
        </div>
      </section>

      {directoryNotice ? <div className={`rounded-2xl border p-4 text-sm font-black ${directoryNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{directoryNotice.text}</div> : null}
      {restrictionNotice ? <div className={`rounded-2xl border p-4 text-sm font-black ${restrictionNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{restrictionNotice.text}</div> : null}
      {portalNotice ? <div className={`rounded-2xl border p-4 text-sm font-black ${portalNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{portalNotice.text}</div> : null}

      <section id="activation" className="rounded-[28px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div><h3 className="text-lg font-black text-[#4A315C]">{t.activationTitle}</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-[#8A92AA]">{t.activationDescription}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-black ${directoryStatus === "active" ? "bg-emerald-50 text-emerald-700" : directoryStatus === "activation_pending" ? "bg-amber-50 text-amber-800" : directoryStatus === "suspended" ? "bg-rose-50 text-rose-700" : "bg-[#F7F0FA] text-[#6658A8]"}`}>{t.directoryStatuses[directoryStatus]}</span>
        </div>

        {directoryStatus === "archived" ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">{t.activationRequired}</p><Link href="/" className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-[#5669C4]">{locale === "en" ? "Open public registration form" : "فتح نموذج التسجيل العام"}</Link></div> : null}
        {directoryStatus === "activation_pending" ? <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-black text-blue-800">{locale === "en" ? "This creator has entered the registration / activation review workflow." : "هذا المؤثر دخل بالفعل في مسار التسجيل / مراجعة التفعيل."}</p> : null}
        {directoryStatus === "managed" ? <div className="mt-4 rounded-xl bg-[#F7F0FA] p-4"><p className="text-sm font-black text-[#6658A8]">{t.managedAllowed}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Info label={t.contactName} value={influencer.managed_contact_name} /><Info label={t.contactMobile} value={influencer.managed_contact_mobile} ltr /><Info label={t.contactEmail} value={influencer.managed_contact_email} ltr /></div></div> : null}

        {isAdmin ? <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <form action={assignInfluencerCoordinator} className="rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4"><input type="hidden" name="influencer_id" value={id} /><p className="text-sm font-black text-[#4A315C]">{t.assignOwner}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select name="coordinator_id" defaultValue={influencer.assigned_coordinator_id ?? ""} className="h-11 flex-1 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold text-[#53618D]"><option value="">{t.unassigned}</option>{(coordinatorRows ?? []).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><button className="h-11 rounded-xl bg-[#EEF1FB] px-4 text-sm font-black text-[#5669C4]">{t.saveOwner}</button></div></form>
          <div className="rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4"><p className="text-sm font-black text-[#4A315C]">{t.managedTitle}</p><p className="mt-1 text-xs font-semibold leading-6 text-[#8A92AA]">{t.managedDescription}</p><details className="mt-3"><summary className="cursor-pointer text-xs font-black text-[#7C5A91]">{t.setManaged}</summary><form action={setInfluencerManagementMode} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="influencer_id" value={id} /><input type="hidden" name="directory_status" value="managed" /><input name="managed_contact_name" defaultValue={influencer.managed_contact_name ?? ""} placeholder={t.contactName} className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold" /><input name="managed_contact_mobile" defaultValue={influencer.managed_contact_mobile ?? ""} placeholder={t.contactMobile} className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold" /><input name="managed_contact_email" type="email" defaultValue={influencer.managed_contact_email ?? ""} placeholder={t.contactEmail} className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold" /><input name="reason" required defaultValue={influencer.directory_notes ?? ""} placeholder={t.reason} className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold" /><button className="h-11 rounded-xl bg-[#8C5BA5] px-4 text-sm font-black text-white sm:col-span-2">{t.setManaged}</button></form></details><div className="mt-3 flex flex-wrap gap-2">{directoryStatus === "suspended" && influencer.user_id ? <form action={setInfluencerManagementMode}><input type="hidden" name="influencer_id" value={id} /><input type="hidden" name="directory_status" value="active" /><input type="hidden" name="reason" value={t.restoreActive} /><button className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{t.restoreActive}</button></form> : null}{!influencer.user_id && directoryStatus !== "archived" ? <form action={setInfluencerManagementMode}><input type="hidden" name="influencer_id" value={id} /><input type="hidden" name="directory_status" value="archived" /><input type="hidden" name="reason" value={t.restoreArchive} /><button className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#66739D]">{t.restoreArchive}</button></form> : null}</div></div>
        </div> : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className={`rounded-[26px] border p-5 shadow-sm ${restrictionStatus === "blacklisted" ? "border-rose-200 bg-rose-50/70" : restrictionStatus === "watchlist" ? "border-amber-200 bg-amber-50/70" : "border-[#EEE4F2] bg-white"}`}>
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#4A315C]">{restrictionCopy.title}</h3><p className="mt-1 text-xs font-semibold leading-6 text-[#8A92AA]">{restrictionCopy.subtitle}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${restrictionStatus === "blacklisted" ? "bg-rose-600 text-white" : restrictionStatus === "watchlist" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{restrictionStatus === "blacklisted" ? restrictionCopy.blacklisted : restrictionStatus === "watchlist" ? restrictionCopy.watchlist : restrictionCopy.normal}</span></div>
          {restrictionStatus !== "normal" ? <div className="mt-4 rounded-2xl bg-white/80 p-4"><Info label={restrictionCopy.reason} value={influencer.restriction_reason}/><div className="mt-3"><Info label={restrictionCopy.expiresAt} value={influencer.restriction_expires_at ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" }).format(new Date(influencer.restriction_expires_at)) : dictionary.operations.common.none}/></div></div> : null}
          <p className="mt-4 text-xs font-semibold leading-6 text-[#7C7181]">{restrictionStatus === "blacklisted" ? restrictionCopy.blacklistEffect : restrictionStatus === "watchlist" ? restrictionCopy.watchlistEffect : restrictionCopy.adminOnly}</p>
          {isAdmin ? <details className="mt-4 rounded-2xl border border-[#E9DFF0] bg-white p-4"><summary className="cursor-pointer text-xs font-black text-[#6658A8]">{dictionary.operations.common.showMore}</summary><form action={setInfluencerRestriction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="influencer_id" value={id}/><select name="restriction_status" defaultValue={restrictionStatus} className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold"><option value="normal">{restrictionCopy.normal}</option><option value="watchlist">{restrictionCopy.watchlist}</option><option value="blacklisted">{restrictionCopy.blacklisted}</option></select><input type="datetime-local" name="expires_at" className="h-11 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold"/><textarea name="reason" defaultValue={influencer.restriction_reason ?? ""} placeholder={restrictionCopy.reason} rows={3} className="rounded-xl border border-[#E0E5F5] bg-white p-3 text-sm font-bold sm:col-span-2"/><button className="h-11 rounded-xl bg-[#6658A8] px-4 text-sm font-black text-white sm:col-span-2">{restrictionCopy.save}</button></form></details> : null}
        </section>

        <section className="rounded-[26px] border border-[#EEE4F2] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#4A315C]">{portalCopy.title}</h3><p className="mt-1 text-xs font-semibold leading-6 text-[#8A92AA]">{portalCopy.subtitle}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${influencer.user_id ? influencer.activation_status === "suspended" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{influencer.user_id ? influencer.activation_status === "suspended" ? dictionary.operations.common.suspended : dictionary.operations.common.active : portalCopy.noAccount}</span></div>
          {influencer.user_id ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label={portalCopy.loginEmail} value={portalAuthUser?.email ?? influencer.email} ltr/><Info label={portalCopy.lastSignIn} value={portalAuthUser?.last_sign_in_at ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(portalAuthUser.last_sign_in_at)) : dictionary.operations.common.none}/></div><p className="mt-4 text-xs font-semibold leading-6 text-[#8A92AA]">{portalCopy.securityNote}</p>{isAdmin ? <details className="mt-4 rounded-2xl border border-[#E9DFF0] bg-[#FCFAFD] p-4"><summary className="cursor-pointer text-xs font-black text-[#6658A8]">{dictionary.operations.common.showMore}</summary><div className="mt-4 space-y-3"><form action={updateInfluencerPortalEmail} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="influencer_id" value={id}/><input type="email" name="email" defaultValue={portalAuthUser?.email ?? influencer.email ?? ""} placeholder={portalCopy.newEmail} required className="h-11 flex-1 rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold"/><button className="h-11 rounded-xl bg-[#6658A8] px-4 text-xs font-black text-white">{portalCopy.saveEmail}</button></form><div className="flex flex-wrap gap-2"><form action={sendInfluencerPasswordRecovery}><input type="hidden" name="influencer_id" value={id}/><button className="rounded-xl border border-[#DCD4E2] bg-white px-3 py-2 text-xs font-black text-[#6658A8]">{portalCopy.sendRecovery}</button></form><form action={resendInfluencerPortalAccess}><input type="hidden" name="influencer_id" value={id}/><button className="rounded-xl border border-[#DCD4E2] bg-white px-3 py-2 text-xs font-black text-[#6658A8]">{portalCopy.resendAccess}</button></form>{influencer.activation_status === "suspended" ? <form action={setInfluencerPortalAccountState}><input type="hidden" name="influencer_id" value={id}/><input type="hidden" name="portal_state" value="active"/><button className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{portalCopy.reactivate}</button></form> : <form action={setInfluencerPortalAccountState} className="flex flex-wrap gap-2"><input type="hidden" name="influencer_id" value={id}/><input type="hidden" name="portal_state" value="suspended"/><input name="reason" required placeholder={restrictionCopy.reason} className="h-9 rounded-xl border border-[#E0E5F5] bg-white px-3 text-xs font-bold"/><button className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">{portalCopy.suspend}</button></form>}</div><p className="text-[11px] font-semibold leading-5 text-[#9A8FA0]">{portalCopy.confirmEmail}</p></div></details> : null}</> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">{portalCopy.noAccount}</p>}
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          <Panel title={t.personal}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label={t.mobile} value={influencer.mobile_e164} ltr /><Info label={t.email} value={influencer.email} ltr /><Info label={t.gender} value={influencer.gender === "female" ? t.female : influencer.gender === "male" ? t.male : null} /><Info label={t.city} value={influencer.city} /><Info label={t.country} value={influencer.country} /><Info label={t.portal} value={influencer.user_id ? t.enabled : t.disabled} /><Info label={t.primaryCategory} value={influencer.primary_category} /><Info label={t.owner} value={assignedCoordinator?.full_name ?? t.unassigned} /></div>{influencer.profile_bio ? <div className="mt-5"><Info label={t.bio} value={influencer.profile_bio} /></div> : null}<div className="mt-5 grid gap-5 lg:grid-cols-2"><Tags title={t.categories} values={influencer.preferred_ad_categories ?? []} /><Tags title={t.preferences} values={influencer.content_style_preferences ?? []} /></div></Panel>

          <Panel title={t.social}><div className="grid gap-4 md:grid-cols-2">{(social ?? []).map((account) => <article key={account.id} className="rounded-2xl border border-[#E4E8F5] bg-[#FDFBFE] p-4"><div className="flex items-start justify-between gap-3"><div><SocialPlatformLink platform={account.platform} platformLabel={account.platform_label} url={account.profile_url}/>{account.username ? <p className="mt-1 font-black text-[#432A57]">@{account.username}</p> : null}</div><span className="rounded-xl bg-[#F7F0FA] px-2.5 py-1 text-xs font-black text-[#576AC2]">{fmt.format(Number(account.followers_count ?? 0))}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Mini label={t.views} value={fmt.format(Number(account.average_views ?? 0))} /><Mini label={t.likes} value={fmt.format(Number(account.average_likes ?? 0))} /><Mini label={t.engagement} value={`${Number(account.engagement_rate ?? 0).toFixed(1)}%`} /></div>{account.profile_url ? <a href={account.profile_url} target="_blank" rel="noreferrer" className="mt-4 block text-xs font-extrabold text-[#6072C5]">{t.openAccount}</a> : null}</article>)}{(social ?? []).length === 0 ? <Empty text={t.noSocial} /> : null}</div></Panel>

          <details className="rounded-[26px] border border-[#EEE4F2] bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-[#4A315C]">{dictionary.operations.applicationsCompact.manualAdvanced}</p><p className="mt-1 text-xs font-semibold text-[#8A92AA]">{dictionary.operations.applicationsCompact.settingsHint}</p></div><span className="rounded-full bg-[#F4EEFA] px-3 py-1 text-xs font-black text-[#6658A8]">{dictionary.operations.common.showMore}</span></div></summary><div className="mt-5"><InfluencerEvaluationPanel influencerId={id} locale={locale} canEvaluate={canEvaluate} summary={evaluationSummary as EvaluationSummary | null} saved={query.evaluation_saved === "1"} errorCode={query.evaluation_error} /></div></details>

          <section id="work-history" className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h3 className="text-lg font-black text-[#4A315C]">{historyCopy.title}</h3><p className="mt-1 max-w-2xl text-sm font-semibold leading-7 text-[#8A92AA]">{historyCopy.subtitle}</p><p className="mt-1 text-xs font-black text-[#9A6AAE]">{historyCopy.staffOnly}</p></div>{canUpdate ? <span className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#8C5BA5]">{historyCopy.add}</span> : null}</div>
            {historyNotice ? <div className={`mt-4 rounded-xl border p-3 text-sm font-black ${historyNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{historyNotice.text}</div> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-4"><ArchiveMetric label={historyCopy.total} value={fmt.format(history.length)} /><ArchiveMetric label={historyCopy.brands} value={fmt.format(historyBrandCount)} /><ArchiveMetric label={historyCopy.lastWork} value={latestHistoryDate ? date.format(new Date(`${latestHistoryDate}T00:00:00`)) : "—"} /><ArchiveMetric label={historyCopy.avgViews} value={historyViews.length ? fmt.format(historyAvgViews) : "—"} /></div>
            {canUpdate ? <details className="mt-5 rounded-2xl border border-[#EEE4F2] bg-white"><summary className="cursor-pointer list-none p-4 text-sm font-black text-[#8C5BA5]">+ {historyCopy.add}</summary><div className="px-4 pb-4"><WorkHistoryForm influencerId={id} locale={locale} dictionary={dictionary} brands={brands ?? []} /></div></details> : null}
            <div className="mt-5 space-y-4">
              {history.map((item) => {
                const typeLabel = historyCopy.types[item.collaboration_type as keyof typeof historyCopy.types] ?? item.collaboration_type;
                const statusLabel = historyCopy.statuses[item.collaboration_status as keyof typeof historyCopy.statuses] ?? item.collaboration_status;
                const outcomeLabel = historyCopy.outcomes[item.outcome as keyof typeof historyCopy.outcomes] ?? item.outcome;
                const sourceLabel = historyCopy[item.source as "manual"|"system"|"legacy_import"] ?? item.source;
                return <article key={item.id} className="rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-[#432A57]">{item.campaign_name}</h4><span className="rounded-full bg-[#F7F0FA] px-2.5 py-1 text-[11px] font-black text-[#8C5BA5]">{typeLabel}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{statusLabel}</span></div><p className="mt-1 text-sm font-bold text-[#8E96AC]">{item.brand_name || "—"}{item.platform ? ` · ${item.platform}` : ""}{item.collaboration_date ? ` · ${date.format(new Date(`${item.collaboration_date}T00:00:00`))}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#66739D]">{outcomeLabel}</span>{item.content_url ? <a href={item.content_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF1FB] px-3 py-1.5 text-xs font-black text-[#5669C4]">{historyCopy.openContent}</a> : null}</div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Mini label={historyCopy.fields.views} value={item.views == null ? "—" : fmt.format(Number(item.views))} /><Mini label={historyCopy.fields.likes} value={item.likes == null ? "—" : fmt.format(Number(item.likes))} /><Mini label={historyCopy.fields.comments} value={item.comments == null ? "—" : fmt.format(Number(item.comments))} /><Mini label={historyCopy.fields.engagement} value={item.engagement_rate == null ? "—" : `${Number(item.engagement_rate).toFixed(1)}%`} /><Mini label={historyCopy.fields.amount} value={item.compensation_amount == null ? "—" : new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { style: "currency", currency: item.compensation_currency || "SAR", maximumFractionDigits: 0 }).format(Number(item.compensation_amount))} /></div>
                  {(item.performance_note || item.internal_notes) ? <div className="mt-4 grid gap-3 md:grid-cols-2">{item.performance_note ? <Info label={historyCopy.fields.performanceNote} value={item.performance_note} /> : null}{item.internal_notes ? <Info label={historyCopy.fields.internalNotes} value={item.internal_notes} /> : null}</div> : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEE8F2] pt-3"><p className="text-[11px] font-bold text-[#9A9FB0]">{historyCopy.source}: {sourceLabel}</p><div className="flex gap-2">{canUpdate ? <details><summary className="cursor-pointer list-none rounded-lg bg-white px-3 py-1.5 text-xs font-black text-[#66739D]">{historyCopy.edit}</summary><div className="mt-3 min-w-[min(900px,80vw)]"><WorkHistoryForm influencerId={id} locale={locale} dictionary={dictionary} brands={brands ?? []} value={item} /></div></details> : null}{canDeleteHistory ? <WorkHistoryDeleteButton influencerId={id} historyId={item.id} label={historyCopy.delete} confirmation={historyCopy.deleteConfirm} /> : null}</div></div>
                </article>;
              })}
              {history.length === 0 ? <Empty text={historyCopy.noHistory} /> : null}
            </div>
          </section>

          <Panel title={t.campaigns}><div className="space-y-3">{assignmentRows.map((assignment) => { const campaign = campaignMap.get(assignment.campaign_id); return <Link key={assignment.id} href={`/dashboard/campaigns/${assignment.campaign_id}`} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#F2ECF6] bg-[#FDFBFE] p-4 transition hover:border-[#BFC9ED] sm:flex-row sm:items-center"><div><p className="font-black text-[#432A57]">{campaign?.name ?? t.campaignFallback}</p><p className="mt-1 text-xs font-bold text-[#9299AE]">{campaign?.brand ?? "—"} · {assignment.execution_type ?? "—"}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-xs font-black text-[#915FA9]">{assignmentLabels[assignment.status] ?? assignment.status}</span><span className="text-sm font-black text-[#455791]">{money.format(Number(assignment.agreed_amount ?? 0))}</span></div></Link>; })}{assignmentRows.length === 0 ? <Empty text={t.noCampaigns} /> : null}</div></Panel>
        </div>

        <aside className="space-y-6">
          <Panel title={t.campaignAvailability}><div className={`rounded-2xl p-4 ${availability === "available" ? "bg-emerald-50 text-emerald-800" : availability === "active" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}><p className="font-black">{availability === "available" ? t.availableLink : availability === "active" ? t.activeCampaign : t.cooldownState}</p>{activeAssignment ? <p className="mt-2 text-sm font-bold opacity-75">{campaignMap.get(activeAssignment.campaign_id)?.name}</p> : null}{restriction?.exclusivity_end_at ? <><p className="mt-2 text-sm font-black">{restriction.exclusivity_scope === "all" ? t.allCampaignsRestriction : t.selectedBrandsRestriction}</p>{restriction.exclusivity_scope === "brands" && restrictionBrandNames.length ? <p className="mt-1 text-sm font-bold opacity-80">{t.restrictedBrands}: {restrictionBrandNames.join("، ")}</p> : null}<p className="mt-2 text-sm font-bold opacity-75">{t.availableAfter} {date.format(new Date(restriction.exclusivity_end_at))}</p><p className="mt-1 text-sm font-black">{t.cooldownRemaining}: {restrictionRemainingDays} {t.days}</p></> : null}</div></Panel>
          <Panel title={t.dues}><div className="grid gap-3"><MoneyCard label={t.paid} value={money.format(totalPaid)} tone="green" /><MoneyCard label={t.pending} value={money.format(pendingAmount)} tone="amber" /><MoneyCard label={t.compensationItems} value={String((compensations ?? []).length)} tone="blue" /></div></Panel>
          {canViewFinance ? <Panel title={t.finance}><div className="space-y-3"><Info label={t.holder} value={financial?.account_holder_name} /><Info label={t.bank} value={financial?.bank_name} /><Info label={t.iban} value={financial?.iban ? maskValue(financial.iban) : null} ltr /><Info label={t.nationalId} value={financial?.national_id ? maskValue(financial.national_id) : null} ltr /><Info label={t.mawthooq} value={financial?.mawthooq_number} /></div><p className="mt-4 text-[11px] font-bold leading-6 text-[#9B8BA3]">{t.financeNote}</p></Panel> : null}
          <Panel title={t.system}><div className="space-y-3"><Info label={t.directory} value={t.directoryStatuses[directoryStatus]} /><Info label={t.fileStatus} value={influencer.account_status} /><Info label={t.owner} value={assignedCoordinator?.full_name ?? t.unassigned} /><Info label={t.archive} value={influencer.archive_match_status} /><Info label={t.source} value={influencer.registration_source} /><Info label={t.updated} value={new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(influencer.updated_at))} /></div></Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6"><h3 className="mb-5 text-lg font-black text-[#4A315C]">{title}</h3>{children}</section>; }
function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/15"><p className="text-[11px] font-bold text-white/65">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function ArchiveMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#F7F0FA] p-3 text-center"><p className="text-[10px] font-extrabold text-[#96859E]">{label}</p><p className="mt-1 text-lg font-black text-[#5364AA]">{value}</p></div>; }
function Info({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) { return <div><p className="text-xs font-extrabold text-[#96859E]">{label}</p><p dir={ltr ? "ltr" : undefined} className={`mt-1.5 min-h-6 text-sm font-black text-[#503863] ${ltr ? "text-start" : ""}`}>{value || "—"}</p></div>; }
function Tags({ title, values }: { title: string; values: string[] }) { return <div><p className="text-xs font-extrabold text-[#96859E]">{title}</p><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map((value) => <span key={value} className="rounded-full bg-[#F7F0FA] px-3 py-1 text-xs font-black text-[#5769BF]">{value}</span>) : <span className="text-sm font-bold text-[#A0A6B7]">—</span>}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-2"><p className="text-[10px] font-bold text-[#9B8BA3]">{label}</p><p className="mt-1 text-xs font-black text-[#485A94]">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full rounded-2xl border border-dashed border-[#ECE1F1] bg-[#FDFBFE] p-8 text-center text-sm font-bold text-[#95849D]">{text}</div>; }
function MoneyCard({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "blue" }) { const classes = { green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", blue: "bg-[#F7F0FA] text-[#8A5AA3]" }[tone]; return <div className={`rounded-2xl p-4 ${classes}`}><p className="text-xs font-extrabold opacity-70">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function maskValue(value: string) { const cleaned = value.replace(/\s/g, ""); return cleaned.length <= 6 ? "••••" : `${cleaned.slice(0, 3)}••••••${cleaned.slice(-3)}`; }
