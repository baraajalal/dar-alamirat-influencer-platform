import Link from "next/link";
import { cookies } from "next/headers";
import { calculateInfluencerPerformance } from "@/lib/influencer-portal/performance";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app-dictionary";

const activeStatuses = new Set([
  "invited",
  "accepted",
  "product_pending",
  "brief_pending",
  "content_pending",
  "under_review",
  "needs_changes",
  "approved",
  "payment_pending",
]);

const completedStatuses = new Set(["paid", "closed"]);

type SocialRow = { id: string; followers_count: number | string | null };
type CampaignRow = { name: string; brand: string | null };
type AssignmentRow = {
  id: string;
  status: string;
  content_due_at: string | null;
  publishing_date: string | null;
  campaigns: CampaignRow | CampaignRow[] | null;
};
type PlatformIdRow = { id: string };
type Copy = AppDictionary["portalDashboard"];

export default async function InfluencerPortalDashboard() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).portalDashboard;
  const { admin, influencer } = await requireInfluencerAccount();

  const [{ data: socialRows }, { data: assignmentRows }, { data: financial }] =
    await Promise.all([
      admin
        .from("social_accounts")
        .select("id,followers_count")
        .eq("influencer_id", influencer.id),
      admin
        .from("campaign_assignments")
        .select("id,status,content_due_at,publishing_date,campaigns(name,brand)")
        .eq("influencer_id", influencer.id)
        .order("created_at", { ascending: false }),
      admin
        .from("influencer_financial_profiles")
        .select("bank_profile_status,influencer_confirmed_at")
        .eq("influencer_id", influencer.id)
        .maybeSingle(),
    ]);

  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const socials = (socialRows ?? []) as SocialRow[];
  const assignmentIds = assignments.map((row) => row.id as string);

  let platformIds: string[] = [];
  let contentRows: Array<{ id: string; status: string }> = [];
  let reviewRows: Array<{ decision: string }> = [];
  let publicationRows: Array<{ status: string }> = [];
  let paymentRows: Array<{
    id: string;
    amount: number | string | null;
    expected_amount?: number | string | null;
    paid_amount?: number | string | null;
    status: string;
  }> = [];

  if (assignmentIds.length > 0) {
    const [{ data: platforms }, { data: payments }] = await Promise.all([
      admin
        .from("assignment_platforms")
        .select("id")
        .in("assignment_id", assignmentIds),
      admin
        .from("payments")
        .select("id,amount,expected_amount,paid_amount,status")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false }),
    ]);

    platformIds = ((platforms ?? []) as PlatformIdRow[]).map((row) => row.id);
    paymentRows = (payments ?? []) as typeof paymentRows;
  }

  if (platformIds.length > 0) {
    const { data: contents } = await admin
      .from("content_items")
      .select("id,status")
      .in("assignment_platform_id", platformIds);
    contentRows = (contents ?? []) as typeof contentRows;
  }

  const contentIds = contentRows.map((row) => row.id);
  if (contentIds.length > 0) {
    const [{ data: reviews }, { data: publications }] = await Promise.all([
      admin
        .from("content_reviews")
        .select("decision")
        .in("content_item_id", contentIds),
      admin
        .from("publication_submissions")
        .select("status")
        .in("content_item_id", contentIds),
    ]);
    reviewRows = (reviews ?? []) as typeof reviewRows;
    publicationRows = (publications ?? []) as typeof publicationRows;
  }

  const followers = socials.reduce(
    (sum, row) => sum + Number(row.followers_count ?? 0),
    0,
  );
  const completedAssignments = assignments.filter((row) =>
    completedStatuses.has(String(row.status)),
  ).length;
  const approvedContent = contentRows.filter((row) =>
    ["approved", "published"].includes(row.status),
  ).length;
  const revisionRequests = reviewRows.filter(
    (row) => row.decision === "needs_changes",
  ).length;
  const approvedPublications = publicationRows.filter(
    (row) => row.status === "approved",
  ).length;

  const performance = calculateInfluencerPerformance({
    followers,
    profileCompletion: influencer.profile_completion ?? 0,
    assignmentCount: assignments.length,
    completedAssignments,
    contentCount: contentRows.length,
    approvedContent,
    revisionRequests,
    publicationCount: publicationRows.length,
    approvedPublications,
  });

  const activeAssignments = assignments.filter((row) =>
    activeStatuses.has(String(row.status)),
  );
  const pendingContent = contentRows.filter((row) =>
    ["draft", "needs_changes", "submitted", "under_review"].includes(row.status),
  ).length;
  const totalPending = paymentRows
    .filter((row) => !["paid", "cancelled"].includes(row.status))
    .reduce(
      (sum, row) =>
        sum +
        Number(row.expected_amount ?? row.amount ?? 0) -
        Number(row.paid_amount ?? 0),
      0,
    );

  const bankStatus = financial?.bank_profile_status ?? "incomplete";
  const currentLevel = copy.levels[performance.level];
  const currentClassification = copy.classifications[performance.classification];

  return (
    <div className="space-y-5" data-no-auto-translate>
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6074D3,#8E9BEA)] p-6 text-white shadow-[0_22px_70px_rgba(70,90,175,0.24)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-white/75">{copy.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black">
              {replace(copy.welcome, { name: influencer.full_name })}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/80">
              {copy.description}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/20 bg-white/12 p-5 text-center backdrop-blur">
            <p className="text-xs font-black text-white/70">{copy.performanceScore}</p>
            <p className="mt-1 text-4xl font-black">{performance.score}</p>
            <p className="mt-1 text-xs font-bold">{currentLevel}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={copy.profileCompletion} value={`${influencer.profile_completion ?? 0}%`} />
        <Metric label={copy.classification} value={currentClassification} />
        <Metric label={copy.activeCampaigns} value={String(activeAssignments.length)} />
        <Metric label={copy.pendingPayments} value={`${money(totalPending, locale)} ${copy.currency}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#9F6EB8]">{copy.currentCampaigns}</p>
              <h2 className="mt-1 text-xl font-black">{copy.openTasks}</h2>
            </div>
            <Link href="/portal/campaigns" className="text-sm font-black text-[#9A68B5]">
              {copy.viewAllCampaigns}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {activeAssignments.length === 0 ? (
              <Empty text={copy.noActiveCampaigns} />
            ) : (
              activeAssignments.slice(0, 5).map((assignment) => {
                const campaign = relation(assignment.campaigns);
                return (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#F3EDF7] bg-[#FEFCFF] p-4"
                  >
                    <div>
                      <p className="font-black text-[#4A315C]">
                        {campaign?.name ?? copy.campaignFallback}
                      </p>
                      <p className="mt-1 text-xs text-[#8D7C94]">
                        {campaign?.brand ?? copy.brandFallback}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-bold text-[#5E72CF]">
                      {statusLabel(String(assignment.status), copy)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
            <p className="text-sm font-bold text-[#9F6EB8]">{copy.requiredSteps}</p>
            <h2 className="mt-1 text-xl font-black">{copy.accountReadiness}</h2>
            <div className="mt-5 space-y-3">
              <Readiness
                done={(influencer.profile_completion ?? 0) >= 80}
                label={copy.readinessProfile}
              />
              <Readiness done={pendingContent === 0} label={copy.readinessContent} />
              <Readiness done={bankStatus === "approved"} label={copy.readinessBank} />
            </div>
            {bankStatus !== "approved" ? (
              <Link
                href="/portal/profile/payment-details"
                className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[#9A68B5] text-sm font-black text-white"
              >
                {copy.reviewBank}
              </Link>
            ) : null}
          </div>

          <div className="rounded-[28px] bg-[linear-gradient(145deg,#432A57,#8959A2)] p-6 text-white shadow-[0_20px_55px_rgba(51,68,127,0.22)]">
            <p className="text-xs font-black text-white/65">{copy.currentLevel}</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-black">{currentLevel}</p>
                <p className="mt-1 text-xs font-bold text-white/70">
                  {performance.nextLevel
                    ? replace(copy.towardNext, {
                        progress: performance.progressToNext,
                        level: copy.levels[performance.nextLevel],
                      })
                    : copy.highestLevel}
                </p>
              </div>
              <Link href="/portal/performance" className="text-xs font-black text-white">
                {copy.performanceDetails} {locale === "ar" ? "←" : "→"}
              </Link>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${performance.progressToNext}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_14px_40px_rgba(68,82,140,0.08)]">
      <p className="text-sm text-[#7D86A1]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#3D274F]">{value}</p>
    </div>
  );
}

function Readiness({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FBF8FD] p-3">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {done ? "✓" : "!"}
      </span>
      <span className="text-sm font-bold text-[#5F6A8C]">{label}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#EADFF0] bg-[#FDFBFE] px-4 py-8 text-center text-sm text-[#8C7B94]">
      {text}
    </div>
  );
}

function money(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function statusLabel(value: string, copy: Copy) {
  return (copy.statuses as Record<string, string>)[value] ?? value;
}

function replace(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
