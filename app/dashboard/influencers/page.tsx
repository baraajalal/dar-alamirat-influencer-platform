import Link from "next/link";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { reviewInfluencerRegistration } from "./actions";

export const dynamic = "force-dynamic";

type InfluencerRow = {
  id: string;
  full_name: string;
  mobile_e164: string;
  email: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  mawthooq_status: boolean | null;
  account_status: string | null;
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
  followers_count: number | null;
  engagement_rate: number | null;
};

type AssignmentRow = {
  id: string;
  influencer_id: string;
  status: string;
  availability_blocked_until: string | null;
  settled_at: string | null;
  campaign_id: string;
};

type CampaignRow = { id: string; name: string };

type Availability = {
  state: "available" | "active" | "cooldown";
  campaignName?: string;
  blockedUntil?: string;
};

const CLOSED_STATUSES = new Set(["closed", "rejected", "cancelled"]);

const ar = {
  title: "قاعدة بيانات المؤثرين",
  subtitle: "ابحثي وفلّتي الملفات، راقبي اكتمالها وتوفر أصحابها للحملات.",
  add: "إضافة مؤثر للطوارئ",
  registration: "فتح نموذج المؤثر",
  search: "الاسم، الجوال أو اسم المستخدم",
  allCities: "كل المدن",
  allGenders: "كل الأجناس",
  allPlatforms: "كل المنصات",
  allAvailability: "كل حالات التوفر",
  allMawthooq: "كل حالات موثوق",
  female: "أنثى",
  male: "ذكر",
  verified: "موثوق",
  notVerified: "غير موثوق",
  available: "متاح",
  active: "مرتبط بحملة",
  cooldown: "فترة حظر",
  total: "إجمالي المؤثرين",
  complete: "ملفات 80% فأعلى",
  unavailable: "غير المتاحين",
  portal: "حسابات مفعلة",
  influencer: "المؤثر",
  social: "الحسابات الاجتماعية",
  location: "الموقع",
  completion: "اكتمال الملف",
  availability: "التوفر",
  account: "الحساب",
  actions: "الإجراء",
  details: "عرض الملف",
  noResults: "لا توجد نتائج مطابقة للفلاتر الحالية.",
  clear: "مسح الفلاتر",
  pending: "قيد المراجعة",
  unclaimed: "بدون حساب",
  approved: "نشط",
  rejected: "مرفوض",
  suspended: "موقوف",
  approve: "اعتماد",
  reject: "رفض",
};

const en = {
  title: "Influencer Database",
  subtitle: "Search and filter profiles, track completion and campaign availability.",
  add: "Emergency Add",
  registration: "Open influencer form",
  search: "Name, mobile or username",
  allCities: "All cities",
  allGenders: "All genders",
  allPlatforms: "All platforms",
  allAvailability: "All availability",
  allMawthooq: "All Mawthooq states",
  female: "Female",
  male: "Male",
  verified: "Mawthooq",
  notVerified: "Not Mawthooq",
  available: "Available",
  active: "Active campaign",
  cooldown: "Cooldown",
  total: "Total influencers",
  complete: "80%+ profiles",
  unavailable: "Unavailable",
  portal: "Portal accounts",
  influencer: "Influencer",
  social: "Social accounts",
  location: "Location",
  completion: "Completion",
  availability: "Availability",
  account: "Account",
  actions: "Action",
  details: "View profile",
  noResults: "No results match the current filters.",
  clear: "Clear filters",
  pending: "Pending review",
  unclaimed: "No account",
  approved: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
  approve: "Approve",
  reject: "Reject",
};

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    city?: string;
    gender?: string;
    platform?: string;
    availability?: string;
    mawthooq?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("influencers", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  getDashboardDictionary(locale);
  const t = locale === "en" ? en : ar;

  const { data, error } = await supabase
    .from("influencers")
    .select(
      "id,full_name,mobile_e164,email,city,country,gender,mawthooq_status,account_status,archive_match_status,registration_source,user_id,profile_completion,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  const influencers = (data ?? []) as InfluencerRow[];
  const ids = influencers.map((item) => item.id);

  const [{ data: socialData }, { data: assignmentData }] = await Promise.all([
    ids.length
      ? supabase
          .from("social_accounts")
          .select("id,influencer_id,platform,username,followers_count,engagement_rate")
          .in("influencer_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("campaign_assignments")
          .select("id,influencer_id,status,availability_blocked_until,settled_at,campaign_id")
          .in("influencer_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const social = (socialData ?? []) as SocialRow[];
  const assignments = (assignmentData ?? []) as AssignmentRow[];
  const campaignIds = Array.from(new Set(assignments.map((item) => item.campaign_id)));
  const { data: campaignData } = campaignIds.length
    ? await supabase.from("campaigns").select("id,name").in("id", campaignIds)
    : { data: [] };
  const campaignMap = new Map(((campaignData ?? []) as CampaignRow[]).map((item) => [item.id, item.name]));

  const socialMap = new Map<string, SocialRow[]>();
  for (const account of social) {
    socialMap.set(account.influencer_id, [...(socialMap.get(account.influencer_id) ?? []), account]);
  }

  const availabilityMap = new Map<string, Availability>();
  const now = Date.now();
  for (const influencer of influencers) {
    const rows = assignments.filter((assignment) => assignment.influencer_id === influencer.id);
    const activeAssignment = rows.find((assignment) => !CLOSED_STATUSES.has(assignment.status));
    if (activeAssignment) {
      availabilityMap.set(influencer.id, {
        state: "active",
        campaignName: campaignMap.get(activeAssignment.campaign_id),
      });
      continue;
    }
    const cooldown = rows.find(
      (assignment) => assignment.availability_blocked_until && new Date(assignment.availability_blocked_until).getTime() > now,
    );
    if (cooldown) {
      availabilityMap.set(influencer.id, {
        state: "cooldown",
        campaignName: campaignMap.get(cooldown.campaign_id),
        blockedUntil: cooldown.availability_blocked_until ?? undefined,
      });
      continue;
    }
    availabilityMap.set(influencer.id, { state: "available" });
  }

  const query = (params.q ?? "").trim().toLowerCase();
  const filtered = influencers.filter((influencer) => {
    const accounts = socialMap.get(influencer.id) ?? [];
    const availability = availabilityMap.get(influencer.id)?.state ?? "available";
    const matchesQuery =
      !query ||
      [influencer.full_name, influencer.mobile_e164, influencer.email, ...accounts.map((account) => account.username)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    return (
      matchesQuery &&
      (!params.city || influencer.city === params.city) &&
      (!params.gender || influencer.gender === params.gender) &&
      (!params.platform || accounts.some((account) => account.platform === params.platform)) &&
      (!params.availability || availability === params.availability) &&
      (!params.mawthooq || String(Boolean(influencer.mawthooq_status)) === params.mawthooq)
    );
  });

  const cities = Array.from(new Set(influencers.map((item) => item.city).filter(Boolean) as string[])).sort();
  const platforms = Array.from(new Set(social.map((item) => item.platform))).sort();
  const canCreate = hasPermission(profile.role, "influencers", "create");
  const canApprove = hasPermission(profile.role, "influencers", "approve");
  const completeProfiles = influencers.filter((item) => Number(item.profile_completion ?? 0) >= 80).length;
  const unavailable = influencers.filter((item) => availabilityMap.get(item.id)?.state !== "available").length;
  const portalAccounts = influencers.filter((item) => Boolean(item.user_id)).length;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-extrabold text-[#7984A8]">DA / INFLUENCERS</p>
          <h2 className="mt-1 text-2xl font-black text-[#304176] sm:text-3xl">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-[#8B94AD]">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-[#DDE2F4] bg-white px-4 py-3 text-sm font-extrabold text-[#5365B8] shadow-sm">
            <DashboardIcon name="arrow" className="h-4 w-4" /> {t.registration}
          </Link>
          {canCreate ? (
            <Link href="/dashboard/influencers/new" className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6679D1,#4F63BC)] px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(79,99,188,.25)]">
              <DashboardIcon name="plus" className="h-4 w-4" /> {t.add}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.total} value={influencers.length} icon="influencers" />
        <Stat label={t.complete} value={completeProfiles} icon="sparkles" />
        <Stat label={t.unavailable} value={unavailable} icon="campaigns" />
        <Stat label={t.portal} value={portalAccounts} icon="access" />
      </section>

      <section className="rounded-[28px] border border-white/90 bg-white/94 p-4 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <DashboardIcon name="influencers" className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7785C9]" />
            <input name="q" defaultValue={params.q} placeholder={t.search} className="h-12 w-full rounded-2xl border border-[#E0E5F5] bg-[#FAFBFF] ps-11 pe-4 text-sm font-bold text-[#35467F] outline-none transition focus:border-[#7A8AD7] focus:ring-4 focus:ring-[#D8DDF7]/55" />
          </label>
          <FilterSelect name="city" value={params.city} label={t.allCities} options={cities.map((value) => [value, value])} />
          <FilterSelect name="gender" value={params.gender} label={t.allGenders} options={[["female", t.female], ["male", t.male]]} />
          <FilterSelect name="platform" value={params.platform} label={t.allPlatforms} options={platforms.map((value) => [value, value])} />
          <FilterSelect name="availability" value={params.availability} label={t.allAvailability} options={[["available", t.available], ["active", t.active], ["cooldown", t.cooldown]]} />
          <FilterSelect name="mawthooq" value={params.mawthooq} label={t.allMawthooq} options={[["true", t.verified], ["false", t.notVerified]]} />
          <button className="h-12 rounded-2xl bg-[#5669C4] px-5 text-sm font-extrabold text-white shadow-sm xl:col-start-6">{locale === "en" ? "Apply" : "تطبيق"}</button>
        </form>
        {(params.q || params.city || params.gender || params.platform || params.availability || params.mawthooq) ? (
          <div className="mt-3 flex justify-end"><Link href="/dashboard/influencers" className="text-xs font-extrabold text-[#6A79C8]">{t.clear}</Link></div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/90 bg-white/94 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="bg-[#F4F6FD] text-[#66739D]">
              <tr>
                {[t.influencer, t.social, t.location, t.completion, t.availability, t.account, t.actions].map((label) => <th key={label} className="p-4 text-start text-xs font-black">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((influencer) => {
                const accounts = socialMap.get(influencer.id) ?? [];
                const availability = availabilityMap.get(influencer.id) ?? { state: "available" as const };
                return (
                  <tr key={influencer.id} className="border-t border-[#EEF1F8] transition hover:bg-[#FAFBFF]">
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-3">
                        <Avatar name={influencer.full_name} />
                        <div className="min-w-0">
                          <Link href={`/dashboard/influencers/${influencer.id}`} className="font-black text-[#33447F] hover:text-[#5669C4]">{influencer.full_name}</Link>
                          <p dir="ltr" className="mt-1 text-start text-xs font-bold text-[#8E96AC]">{influencer.mobile_e164}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {influencer.mawthooq_status ? <Pill tone="green">{t.verified}</Pill> : null}
                            {influencer.gender ? <Pill tone="blue">{influencer.gender === "female" ? t.female : t.male}</Pill> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex max-w-[290px] flex-wrap gap-2">
                        {accounts.slice(0, 4).map((account) => (
                          <span key={account.id} className="rounded-xl border border-[#E5E8F5] bg-[#FAFBFF] px-2.5 py-1.5 text-xs font-bold text-[#536297]">{account.platform} · @{account.username}</span>
                        ))}
                        {accounts.length === 0 ? <span className="text-[#A1A7B8]">—</span> : null}
                      </div>
                    </td>
                    <td className="p-4 align-top font-bold text-[#657092]">{[influencer.city, influencer.country].filter(Boolean).join("، ") || "—"}</td>
                    <td className="p-4 align-top"><Completion value={Number(influencer.profile_completion ?? 0)} /></td>
                    <td className="p-4 align-top"><AvailabilityBadge availability={availability} locale={locale} labels={t} /></td>
                    <td className="p-4 align-top"><AccountBadge status={influencer.account_status} hasUser={Boolean(influencer.user_id)} labels={t} /></td>
                    <td className="p-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/influencers/${influencer.id}`} className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#5265BC]">{t.details}</Link>
                        {canApprove && influencer.account_status === "pending_review" ? (
                          <>
                            <DecisionForm id={influencer.id} decision="approve" label={t.approve} className="bg-emerald-50 text-emerald-700" />
                            <DecisionForm id={influencer.id} decision="reject" label={t.reject} className="bg-rose-50 text-rose-700" />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="p-14 text-center text-sm font-bold text-[#929AB1]">{t.noResults}</div> : null}
      </section>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: "influencers" | "sparkles" | "campaigns" | "access" }) {
  return <article className="rounded-[24px] border border-white/90 bg-white/94 p-5 shadow-[0_16px_45px_rgba(69,83,151,.08)]"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold text-[#8E96AE]">{label}</p><p className="mt-2 text-3xl font-black text-[#304176]">{value}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#DDE3FB,#AAB9E8)] text-[#4F62BA]"><DashboardIcon name={icon} className="h-5 w-5" /></span></div></article>;
}

function FilterSelect({ name, value, label, options }: { name: string; value?: string; label: string; options: string[][] }) {
  return <select name={name} defaultValue={value ?? ""} className="h-12 rounded-2xl border border-[#E0E5F5] bg-[#FAFBFF] px-4 text-sm font-bold text-[#53608A] outline-none focus:border-[#7A8AD7]"><option value="">{label}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6578CF,#A9B9E6)] text-sm font-black text-white shadow-sm">{initials || "DA"}</span>;
}

function Completion({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="w-36"><div className="mb-1.5 flex justify-between text-xs font-black"><span className="text-[#40528E]">{safe}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#E9ECF7]"><div className={`h-full rounded-full ${safe >= 80 ? "bg-emerald-500" : safe >= 50 ? "bg-[#6578CF]" : "bg-amber-400"}`} style={{ width: `${safe}%` }} /></div></div>;
}

function AvailabilityBadge({ availability, locale, labels }: { availability: Availability; locale: string; labels: typeof ar }) {
  if (availability.state === "available") return <Pill tone="green">{labels.available}</Pill>;
  if (availability.state === "active") return <div><Pill tone="red">{labels.active}</Pill>{availability.campaignName ? <p className="mt-1.5 max-w-40 text-xs font-bold text-[#8F96AA]">{availability.campaignName}</p> : null}</div>;
  const date = availability.blockedUntil ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" }).format(new Date(availability.blockedUntil)) : null;
  return <div><Pill tone="amber">{labels.cooldown}</Pill>{date ? <p className="mt-1.5 text-xs font-bold text-[#8F96AA]">{date}</p> : null}</div>;
}

function AccountBadge({ status, hasUser, labels }: { status: string | null; hasUser: boolean; labels: typeof ar }) {
  const key = status === "active" ? "approved" : status === "rejected" ? "rejected" : status === "suspended" ? "suspended" : status === "pending_review" ? "pending" : "unclaimed";
  const tones = { approved: "green", rejected: "red", suspended: "red", pending: "amber", unclaimed: "blue" } as const;
  return <div><Pill tone={tones[key]}>{labels[key]}</Pill><p className="mt-1.5 text-xs font-bold text-[#9AA1B4]">{hasUser ? (labels === en ? "Portal enabled" : "بوابة مفعلة") : (labels === en ? "Profile only" : "ملف فقط")}</p></div>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "red" | "amber" | "blue" }) {
  const classes = { green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700", blue: "bg-[#EEF1FF] text-[#5568C0]" }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${classes}`}>{children}</span>;
}

function DecisionForm({ id, decision, label, className }: { id: string; decision: "approve" | "reject"; label: string; className: string }) {
  return <form action={reviewInfluencerRegistration}><input type="hidden" name="influencer_id" value={id} /><input type="hidden" name="decision" value={decision} /><button className={`rounded-xl px-3 py-2 text-xs font-black ${className}`}>{label}</button></form>;
}
