import Link from "next/link";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { PORTAL_ACCESS_OPEN_STATUSES } from "@/lib/domain/portal-access";
import { normalizeSaudiMobile } from "@/lib/influencers/mobile";

export const dynamic = "force-dynamic";

type InfluencerRow = {
  id: string;
  full_name: string;
  mobile_e164: string;
  normalized_mobile: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  mawthooq_status: boolean | null;
  account_status: string | null;
  directory_status: "archived" | "activation_pending" | "active" | "managed" | "suspended";
  profile_bio: string | null;
  primary_category: string | null;
  preferred_ad_categories: string[] | null;
  assigned_coordinator_id: string | null;
  archive_match_status: string | null;
  registration_source: string | null;
  user_id: string | null;
  profile_completion: number | null;
  created_at: string;
  updated_at: string;
};

type SocialRow = {
  id: string;
  influencer_id: string;
  platform: string;
  username: string;
  profile_url: string | null;
  followers_count: number | null;
  average_views: number | null;
  engagement_rate: number | null;
};

type AssignmentRow = {
  id: string;
  influencer_id: string;
  status: string;
  availability_blocked_until: string | null;
  settled_at: string | null;
  campaign_id: string;
  exclusivity_scope: string | null;
  exclusivity_end_at: string | null;
  exclusivity_lifted_at: string | null;
};

type HistoryRow = {
  influencer_id: string;
  brand_name: string | null;
  campaign_name: string;
  compensation_amount: number | null;
  views: number | null;
  collaboration_date: string | null;
};

type CampaignRow = { id: string; name: string };
type StaffRow = { id: string; full_name: string; role: string };

type Availability = {
  state: "available" | "active" | "restricted";
  campaignName?: string;
  blockedUntil?: string;
  remainingDays?: number;
  scope?: "brands" | "all";
};

const CLOSED_STATUSES = new Set(["paid", "closed", "rejected", "cancelled"]);

const ar = {
  title: "المؤثرون",
  subtitle: "قاعدة واحدة للمؤرشفين والمفعّلين وVIP. ابحث بالاسم أو الجوال أو الحساب أو البايو أو التصنيف أو البراند السابق.",
  add: "إضافة مؤثر للطوارئ",
  registration: "فتح نموذج المؤثر",
  importArchive: "استيراد الأرشيف",
  matchRequests: "طلبات المطابقة", mustRegister: "بانتظار تسجيل المؤثر",
  search: "الاسم، الجوال، الحساب، البايو، البراند أو الحملة",
  allCities: "كل المدن", allGenders: "كل الأجناس", allPlatforms: "كل المنصات", allAvailability: "كل حالات التوفر", allMawthooq: "كل حالات موثوق",
  allStatuses: "كل حالات المؤثر", allCategories: "كل التصنيفات", allBrands: "كل البراندات السابقة", allCoordinators: "كل المنسقين",
  female: "أنثى", male: "ذكر", verified: "موثوق", notVerified: "غير موثوق",
  available: "متاح", activeCampaign: "مرتبط بحملة", cooldown: "حظر فعّال",
  total: "إجمالي المؤثرين", archivedCount: "مؤرشف", activeCount: "مفعّل", managedCount: "VIP / Managed", pendingCount: "بانتظار التفعيل",
  influencer: "المؤثر", social: "الحسابات", category: "التصنيف والموقع", history: "الأعمال السابقة", availability: "التوفر", status: "الحالة", owner: "المتابع", actions: "الإجراء",
  details: "عرض الملف", activate: "تفعيل", noResults: "لا توجد نتائج مطابقة للفلاتر الحالية.", clear: "مسح الفلاتر", apply: "تطبيق", filters: "البحث والتصفية", results: "النتائج",
  work: "عمل", brands: "براند", avgViews: "متوسط المشاهدات", totalBudget: "إجمالي المقابل", unassigned: "غير مسند",
  statuses: { archived: "مؤرشف", activation_pending: "بانتظار التفعيل", active: "مفعّل", managed: "VIP / Managed", suspended: "موقوف" },
};

const en = {
  title: "Influencers",
  subtitle: "One directory for archived, active, and VIP creators. Search by name, mobile, account, bio, category, past brand, or campaign.",
  add: "Emergency Add",
  registration: "Open influencer form",
  importArchive: "Import archive",
  matchRequests: "Match requests", mustRegister: "Awaiting creator registration",
  search: "Name, mobile, account, bio, brand, or campaign",
  allCities: "All cities", allGenders: "All genders", allPlatforms: "All platforms", allAvailability: "All availability", allMawthooq: "All Mawthooq states",
  allStatuses: "All creator statuses", allCategories: "All categories", allBrands: "All past brands", allCoordinators: "All coordinators",
  female: "Female", male: "Male", verified: "Mawthooq", notVerified: "Not Mawthooq",
  available: "Available", activeCampaign: "Active campaign", cooldown: "Active restriction",
  total: "Total influencers", archivedCount: "Archived", activeCount: "Active", managedCount: "VIP / Managed", pendingCount: "Awaiting activation",
  influencer: "Influencer", social: "Accounts", category: "Category & location", history: "Past work", availability: "Availability", status: "Status", owner: "Owner", actions: "Action",
  details: "View profile", activate: "Activate", noResults: "No results match the current filters.", clear: "Clear filters", apply: "Apply", filters: "Search & filters", results: "Results",
  work: "works", brands: "brands", avgViews: "Avg. views", totalBudget: "Historical compensation", unassigned: "Unassigned",
  statuses: { archived: "Archived", activation_pending: "Awaiting activation", active: "Active", managed: "VIP / Managed", suspended: "Suspended" },
};

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string; city?: string; gender?: string; platform?: string; availability?: string; mawthooq?: string;
    status?: string; category?: string; brand?: string; coordinator?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("influencers", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const t = locale === "en" ? en : ar;

  const { data, error } = await supabase
    .from("influencers")
    .select("id,full_name,mobile_e164,normalized_mobile,email,city,country,gender,mawthooq_status,account_status,directory_status,profile_bio,primary_category,preferred_ad_categories,assigned_coordinator_id,archive_match_status,registration_source,user_id,profile_completion,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const influencers = (data ?? []) as InfluencerRow[];
  const ids = influencers.map((item) => item.id);

  const [{ data: socialData }, { data: assignmentData }, { data: accessRequestData }, { data: historyData }, { data: staffData }] = await Promise.all([
    ids.length ? supabase.from("social_accounts").select("id,influencer_id,platform,username,profile_url,followers_count,average_views,engagement_rate").in("influencer_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("campaign_assignments").select("id,influencer_id,status,availability_blocked_until,settled_at,campaign_id,exclusivity_scope,exclusivity_end_at,exclusivity_lifted_at").in("influencer_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("portal_access_requests").select("id,influencer_id,status").in("influencer_id", ids).in("status", PORTAL_ACCESS_OPEN_STATUSES) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("influencer_work_history").select("influencer_id,brand_name,campaign_name,compensation_amount,views,collaboration_date").in("influencer_id", ids).order("collaboration_date", { ascending: false, nullsFirst: false }).limit(5000) : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id,full_name,role").in("role", ["admin", "coordinator"]).eq("is_active", true).order("full_name"),
  ]);

  const social = (socialData ?? []) as SocialRow[];
  const assignments = (assignmentData ?? []) as AssignmentRow[];
  const history = (historyData ?? []) as HistoryRow[];
  const staff = (staffData ?? []) as StaffRow[];
  const accessRequestMap = new Map<string, string>();
  for (const request of (accessRequestData ?? []) as Array<{ id: string; influencer_id: string }>) accessRequestMap.set(request.influencer_id, request.id);

  const campaignIds = Array.from(new Set(assignments.map((item) => item.campaign_id)));
  const { data: campaignData } = campaignIds.length ? await supabase.from("campaigns").select("id,name").in("id", campaignIds) : { data: [] };
  const campaignMap = new Map(((campaignData ?? []) as CampaignRow[]).map((item) => [item.id, item.name]));
  const staffMap = new Map(staff.map((item) => [item.id, item.full_name]));

  const socialMap = new Map<string, SocialRow[]>();
  for (const account of social) socialMap.set(account.influencer_id, [...(socialMap.get(account.influencer_id) ?? []), account]);
  const historyMap = new Map<string, HistoryRow[]>();
  for (const row of history) historyMap.set(row.influencer_id, [...(historyMap.get(row.influencer_id) ?? []), row]);

  const availabilityMap = new Map<string, Availability>();
  const now = Date.now();
  for (const influencer of influencers) {
    const rows = assignments.filter((assignment) => assignment.influencer_id === influencer.id);
    const activeAssignment = rows.find((assignment) => !CLOSED_STATUSES.has(assignment.status));
    if (activeAssignment) {
      availabilityMap.set(influencer.id, { state: "active", campaignName: campaignMap.get(activeAssignment.campaign_id) });
      continue;
    }
    const restriction = rows.find((assignment) => !assignment.exclusivity_lifted_at && ["brands", "all"].includes(String(assignment.exclusivity_scope)) && assignment.exclusivity_end_at && new Date(assignment.exclusivity_end_at).getTime() > now);
    if (restriction) {
      availabilityMap.set(influencer.id, {
        state: "restricted",
        scope: restriction.exclusivity_scope === "all" ? "all" : "brands",
        campaignName: campaignMap.get(restriction.campaign_id),
        blockedUntil: restriction.exclusivity_end_at ?? undefined,
        remainingDays: Math.max(1, Math.ceil((new Date(restriction.exclusivity_end_at as string).getTime() - now) / 86_400_000)),
      });
      continue;
    }
    availabilityMap.set(influencer.id, { state: "available" });
  }

  const rawQuery = (params.q ?? "").trim();
  const query = rawQuery.toLowerCase();
  const normalizedQueryMobile = normalizeSaudiMobile(rawQuery);
  const filtered = influencers.filter((influencer) => {
    const accounts = socialMap.get(influencer.id) ?? [];
    const work = historyMap.get(influencer.id) ?? [];
    const availability = availabilityMap.get(influencer.id)?.state ?? "available";
    const categories = [influencer.primary_category, ...(influencer.preferred_ad_categories ?? [])].filter(Boolean) as string[];
    const searchValues = [
      influencer.full_name, influencer.mobile_e164, influencer.email, influencer.profile_bio, influencer.city,
      ...categories,
      ...accounts.flatMap((account) => [account.username, account.profile_url, account.platform]),
      ...work.flatMap((item) => [item.brand_name, item.campaign_name]),
    ].filter(Boolean).map((value) => String(value).toLowerCase());
    const matchesQuery = !query || (normalizedQueryMobile
      ? influencer.normalized_mobile === normalizedQueryMobile
      : searchValues.some((value) => value.includes(query)));
    const brands = work.map((item) => item.brand_name).filter(Boolean) as string[];
    return matchesQuery
      && (!params.city || influencer.city === params.city)
      && (!params.gender || influencer.gender === params.gender)
      && (!params.platform || accounts.some((account) => account.platform === params.platform))
      && (!params.availability || availability === params.availability)
      && (!params.mawthooq || String(Boolean(influencer.mawthooq_status)) === params.mawthooq)
      && (!params.status || influencer.directory_status === params.status)
      && (!params.category || categories.includes(params.category))
      && (!params.brand || brands.includes(params.brand))
      && (!params.coordinator || (params.coordinator === "unassigned" ? !influencer.assigned_coordinator_id : influencer.assigned_coordinator_id === params.coordinator));
  });

  const cities = Array.from(new Set(influencers.map((item) => item.city).filter(Boolean) as string[])).sort();
  const platforms = Array.from(new Set(social.map((item) => item.platform))).sort();
  const categories = Array.from(new Set(influencers.flatMap((item) => [item.primary_category, ...(item.preferred_ad_categories ?? [])]).filter(Boolean) as string[])).sort();
  const brands = Array.from(new Set(history.map((item) => item.brand_name).filter(Boolean) as string[])).sort();
  const canCreate = hasPermission(profile.role, "influencers", "create");
  const { count: pendingMatchCount } = profile.role === "admin"
    ? await supabase.from("influencer_registration_submissions").select("id", { count: "exact", head: true }).eq("status", "awaiting_admin_review")
    : { count: 0 };

  const statusCounts = influencers.reduce<Record<string, number>>((acc, item) => {
    acc[item.directory_status] = (acc[item.directory_status] ?? 0) + 1;
    return acc;
  }, {});
  const fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { maximumFractionDigits: 0 });
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

  return (
    <main className="space-y-4 pb-4">
      <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white/92 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.08em] text-[#7E89AC]">
              <span className="h-2 w-2 rounded-full bg-[#9D68B5]" />
              <span>DA / INFLUENCERS</span>
            </div>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#342442] sm:text-[30px]">{t.title}</h2>
            <p className="mt-1.5 max-w-3xl text-[13px] font-semibold leading-6 text-[#8B94AD] sm:text-sm">{t.subtitle}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {canCreate ? (
              <Link href="/dashboard/influencers/new" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#A170BA,#7F568E)] px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(127,86,142,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(127,86,142,.28)]">
                <DashboardIcon name="plus" className="h-4 w-4" /> {t.add}
              </Link>
            ) : null}
            {profile.role === "admin" ? (
              <Link href="/dashboard/match-requests" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 text-sm font-extrabold text-amber-800 transition hover:bg-amber-100/80">
                <DashboardIcon name="access" className="h-4 w-4" /> {t.matchRequests}
                <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] leading-4 ${pendingMatchCount ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-700"}`}>{pendingMatchCount ?? 0}</span>
              </Link>
            ) : null}
            <Link href="/dashboard/influencers/archive" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E6DDEA] bg-[#FCF9FD] px-4 text-sm font-extrabold text-[#875A9D] transition hover:bg-[#F7F0FA]">
              <DashboardIcon name="influencers" className="h-4 w-4" /> {t.importArchive}
            </Link>
            <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E1E5F2] bg-white px-4 text-sm font-extrabold text-[#6E79A1] transition hover:bg-[#FAFBFF]">
              <DashboardIcon name="arrow" className="h-4 w-4" /> {t.registration}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={t.total} value={influencers.length} icon="influencers" emphasis />
        <Stat label={t.archivedCount} value={statusCounts.archived ?? 0} icon="sparkles" />
        <Stat label={t.pendingCount} value={statusCounts.activation_pending ?? 0} icon="access" />
        <Stat label={t.activeCount} value={statusCounts.active ?? 0} icon="campaigns" />
        <Stat label={t.managedCount} value={statusCounts.managed ?? 0} icon="influencers" />
      </section>

      <section className="rounded-[26px] border border-white/90 bg-white/94 p-4 shadow-[0_16px_45px_rgba(69,83,151,.07)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#44517A]">{t.filters}</p>
            <p className="mt-0.5 text-xs font-bold text-[#9AA1B3]">{t.results}: <span className="text-[#5969B7]">{fmt.format(filtered.length)}</span> / {fmt.format(influencers.length)}</p>
          </div>
          {Object.values(params).some(Boolean) ? (
            <Link href="/dashboard/influencers" className="inline-flex h-9 items-center rounded-xl border border-[#E5E8F3] bg-[#FBFCFF] px-3 text-xs font-extrabold text-[#6D78A0] transition hover:bg-[#F4F6FC]">{t.clear}</Link>
          ) : null}
        </div>

        <form className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-12">
          <label className="relative md:col-span-2 xl:col-span-5">
            <DashboardIcon name="influencers" className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B88C7]" />
            <input name="q" defaultValue={params.q} placeholder={t.search} className="h-11 w-full rounded-2xl border border-[#E1E5F2] bg-[#FCFCFE] ps-11 pe-4 text-sm font-bold text-[#35467F] outline-none transition placeholder:text-[#A9AFC0] focus:border-[#8B94D4] focus:bg-white focus:ring-4 focus:ring-[#E9E0F1]/45" />
          </label>
          <div className="xl:col-span-2"><FilterSelect name="status" value={params.status} label={t.allStatuses} options={Object.entries(t.statuses)} /></div>
          <div className="xl:col-span-2"><FilterSelect name="platform" value={params.platform} label={t.allPlatforms} options={platforms.map((value) => [value, value])} /></div>
          <div className="xl:col-span-2"><FilterSelect name="category" value={params.category} label={t.allCategories} options={categories.map((value) => [value, value])} /></div>
          <button className="h-11 rounded-2xl bg-[#596CC6] px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(86,105,196,.18)] transition hover:bg-[#4D60BA] xl:col-span-1">{t.apply}</button>

          <div className="xl:col-span-3"><FilterSelect name="city" value={params.city} label={t.allCities} options={cities.map((value) => [value, value])} /></div>
          <div className="xl:col-span-3"><FilterSelect name="brand" value={params.brand} label={t.allBrands} options={brands.map((value) => [value, value])} /></div>
          <div className="xl:col-span-2"><FilterSelect name="availability" value={params.availability} label={t.allAvailability} options={[["available", t.available], ["active", t.activeCampaign], ["restricted", t.cooldown]]} /></div>
          <div className="xl:col-span-2"><FilterSelect name="mawthooq" value={params.mawthooq} label={t.allMawthooq} options={[["true", t.verified], ["false", t.notVerified]]} /></div>
          <div className="xl:col-span-2"><FilterSelect name="coordinator" value={params.coordinator} label={t.allCoordinators} options={[["unassigned", t.unassigned], ...staff.map((item) => [item.id, item.full_name] as [string, string])]} /></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-white/90 bg-white/95 shadow-[0_16px_45px_rgba(69,83,151,.07)]">
        <div className="border-b border-[#EEF0F6] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#44517A]">{t.title}</p>
            <span className="rounded-full bg-[#F4F1FA] px-3 py-1 text-xs font-black text-[#6977B7]">{fmt.format(filtered.length)} {t.results}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[#FAF8FC] text-[#69759C]">
              <tr>{[t.influencer, t.social, t.category, t.availability, t.status, t.owner, t.actions].map((label) => <th key={label} className="px-4 py-3 text-start text-[11px] font-black tracking-wide">{label}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((influencer) => {
                const accounts = socialMap.get(influencer.id) ?? [];
                const availability = availabilityMap.get(influencer.id) ?? { state: "available" as const };
                return <tr key={influencer.id} className="border-t border-[#F0F1F6] transition hover:bg-[#FCFAFD]">
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-start gap-3">
                      <Avatar name={influencer.full_name} />
                      <div className="min-w-0">
                        <Link href={`/dashboard/influencers/${influencer.id}`} className="block max-w-[250px] truncate font-black text-[#3F2C4C] transition hover:text-[#5969B7]">{influencer.full_name}</Link>
                        <p dir="ltr" className="mt-1 text-start text-[11px] font-bold text-[#9198AC]">{influencer.mobile_e164}</p>
                        {influencer.profile_bio ? <p className="mt-1.5 max-w-[250px] line-clamp-1 text-[11px] font-semibold leading-5 text-[#A0A5B5]">{influencer.profile_bio}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex max-w-[300px] flex-wrap gap-1.5">
                      {accounts.slice(0, 3).map((account) => <a key={account.id} href={account.profile_url || undefined} target={account.profile_url ? "_blank" : undefined} rel="noreferrer" className="rounded-xl border border-[#EEEAF3] bg-[#FCFAFD] px-2.5 py-1.5 text-[11px] font-bold text-[#56649A] transition hover:border-[#DCD5E5] hover:bg-white">{account.platform} · @{account.username}{account.followers_count ? ` · ${fmt.format(account.followers_count)}` : ""}</a>)}
                      {accounts.length > 3 ? <span className="rounded-xl bg-[#F2F4FA] px-2 py-1.5 text-[11px] font-black text-[#747FA5]">+{accounts.length - 3}</span> : null}
                      {accounts.length === 0 ? <span className="text-[#A1A7B8]">—</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top"><p className="font-black text-[#53618D]">{influencer.primary_category || influencer.preferred_ad_categories?.[0] || "—"}</p><p className="mt-1 text-[11px] font-bold text-[#989FB1]">{[influencer.city, influencer.country].filter(Boolean).join("، ") || "—"}</p></td>
                  <td className="px-4 py-3.5 align-top"><AvailabilityBadge availability={availability} locale={locale} labels={t} /></td>
                  <td className="px-4 py-3.5 align-top"><DirectoryStatusBadge status={influencer.directory_status} labels={t} hasUser={Boolean(influencer.user_id)} /></td>
                  <td className="px-4 py-3.5 align-top text-xs font-bold text-[#667092]">{influencer.assigned_coordinator_id ? staffMap.get(influencer.assigned_coordinator_id) ?? "—" : t.unassigned}</td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex max-w-[240px] flex-wrap gap-1.5">
                      <Link href={`/dashboard/influencers/${influencer.id}`} className="rounded-xl bg-[#F4EDF8] px-3 py-2 text-[11px] font-black text-[#84579A] transition hover:bg-[#EEE3F3]">{t.details}</Link>
                      {influencer.directory_status === "archived" ? <span className="rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] font-black text-amber-800">{t.mustRegister}</span> : null}
                      {accessRequestMap.get(influencer.id) && influencer.account_status === "pending_review" ? <Link href={`/dashboard/access-requests/${accessRequestMap.get(influencer.id)}`} className="rounded-xl bg-[#EEF1FB] px-3 py-2 text-[11px] font-black text-[#5669C4] transition hover:bg-[#E5E9F8]">{locale === "en" ? "Review" : "مراجعة"}</Link> : null}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="p-12 text-center text-sm font-bold text-[#95849D]">{t.noResults}</div> : null}
      </section>
    </main>
  );
}

function Stat({ label, value, icon, emphasis = false }: { label: string; value: number; icon: "influencers" | "sparkles" | "campaigns" | "access"; emphasis?: boolean }) {
  return <article className={`rounded-[22px] border p-4 shadow-[0_12px_34px_rgba(69,83,151,.065)] ${emphasis ? "border-[#DDD6EC] bg-[linear-gradient(135deg,#FFFFFF,#FBF7FD)]" : "border-white/90 bg-white/94"}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-[#939AAF]">{label}</p><p className={`mt-1.5 font-black tracking-tight text-[#445690] ${emphasis ? "text-[30px]" : "text-[28px]"}`}>{value}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${emphasis ? "bg-[#EEE6F3] text-[#80549A]" : "bg-[#F6F0F9] text-[#8B56BD]"}`}><DashboardIcon name={icon} className="h-[18px] w-[18px]" /></span></div></article>;
}
function FilterSelect({ name, value, label, options }: { name: string; value?: string; label: string; options: [string, string][] }) { return <select name={name} defaultValue={value ?? ""} className="h-11 w-full rounded-2xl border border-[#E1E5F2] bg-[#FCFCFE] px-3 text-[13px] font-bold text-[#53618D] outline-none transition focus:border-[#8B94D4] focus:bg-white focus:ring-4 focus:ring-[#E9E0F1]/35"><option value="">{label}</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>; }
function Avatar({ name }: { name: string }) { return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#F1D9EA,#DCE1F7)] text-sm font-black text-[#76508B]">{String(name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join("") || "DA"}</span>; }
function AvailabilityBadge({ availability, locale, labels }: { availability: Availability; locale: string; labels: typeof ar }) {
  if (availability.state === "available") return <Pill tone="green">{labels.available}</Pill>;
  if (availability.state === "active") return <div><Pill tone="red">{labels.activeCampaign}</Pill>{availability.campaignName ? <p className="mt-1.5 max-w-[180px] text-xs font-bold text-[#8F96AA]">{availability.campaignName}</p> : null}</div>;
  const date = availability.blockedUntil ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" }).format(new Date(availability.blockedUntil)) : null;
  return <div><Pill tone="amber">{labels.cooldown}</Pill>{availability.remainingDays ? <p className="mt-1 text-xs font-bold text-amber-700">{locale === "en" ? `${availability.remainingDays} days` : `${availability.remainingDays} يوم`}</p> : null}{date ? <p className="mt-1 text-xs font-bold text-[#8F96AA]">{locale === "en" ? `Until ${date}` : `حتى ${date}`}</p> : null}</div>;
}
function DirectoryStatusBadge({ status, labels, hasUser }: { status: keyof typeof ar.statuses; labels: typeof ar; hasUser: boolean }) {
  const tone = status === "active" ? "green" : status === "managed" ? "blue" : status === "activation_pending" ? "amber" : status === "suspended" ? "red" : "blue";
  return <div><Pill tone={tone}>{labels.statuses[status]}</Pill><p className="mt-1.5 text-xs font-bold text-[#9B8BA3]">{hasUser ? (labels === en ? "Portal enabled" : "بوابة مفعلة") : (status === "managed" ? (labels === en ? "Staff managed" : "بإدارة الفريق") : (labels === en ? "Profile only" : "ملف فقط"))}</p></div>;
}
function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "red" | "amber" | "blue" }) { const classes = { green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700", blue: "bg-[#F7F0FA] text-[#5568C0]" }[tone]; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${classes}`}>{children}</span>; }
