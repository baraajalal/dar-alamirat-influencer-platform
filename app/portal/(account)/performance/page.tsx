import { calculateInfluencerPerformance } from "@/lib/influencer-portal/performance";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

const completedStatuses = new Set(["paid", "closed"]);

type SocialMetricRow = {
  followers_count: number | string | null;
  average_views: number | string | null;
  engagement_rate: number | string | null;
};
type AssignmentRow = { id: string; status: string };
type PlatformIdRow = { id: string };

export default async function InfluencerPerformancePage() {
  const { admin, influencer } = await requireInfluencerAccount();

  const [{ data: socialRows }, { data: assignmentRows }] = await Promise.all([
    admin
      .from("social_accounts")
      .select("followers_count,average_views,engagement_rate")
      .eq("influencer_id", influencer.id),
    admin
      .from("campaign_assignments")
      .select("id,status")
      .eq("influencer_id", influencer.id),
  ]);

  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const socials = (socialRows ?? []) as SocialMetricRow[];
  const assignmentIds = assignments.map((row) => row.id as string);
  let platformIds: string[] = [];
  let contentRows: Array<{ id: string; status: string }> = [];
  let reviewRows: Array<{ decision: string }> = [];
  let publicationRows: Array<{ status: string }> = [];

  if (assignmentIds.length > 0) {
    const { data: platformRows } = await admin
      .from("assignment_platforms")
      .select("id")
      .in("assignment_id", assignmentIds);
    platformIds = ((platformRows ?? []) as PlatformIdRow[]).map((row) => row.id);
  }

  if (platformIds.length > 0) {
    const { data } = await admin
      .from("content_items")
      .select("id,status")
      .in("assignment_platform_id", platformIds);
    contentRows = (data ?? []) as typeof contentRows;
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
  const averageViews = average(
    socials.map((row) => Number(row.average_views ?? 0)),
  );
  const averageEngagement = average(
    socials.map((row) => Number(row.engagement_rate ?? 0)),
  );
  const approvedContent = contentRows.filter((row) =>
    ["approved", "published"].includes(row.status),
  ).length;
  const revisionRequests = reviewRows.filter(
    (row) => row.decision === "needs_changes",
  ).length;
  const completedAssignments = assignments.filter((row) =>
    completedStatuses.has(String(row.status)),
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

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#432A57,#9A68B5)] p-6 text-white shadow-[0_22px_70px_rgba(51,68,127,0.24)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-black text-white/65">الأداء والتصنيف</p>
            <h1 className="mt-2 text-3xl font-black">
              {performance.level} · {performance.classification}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/76">
              الدرجة تعكس اكتمال الملف، إتمام الحملات، جودة المحتوى، الاستجابة
              للتعديلات، واعتماد روابط النشر.
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs font-black text-white/60">الدرجة الحالية</p>
            <p className="mt-1 text-6xl font-black">{performance.score}</p>
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between text-xs font-black text-white/70">
            <span>{performance.level}</span>
            <span>
              {performance.nextLevel
                ? `المستوى التالي: ${performance.nextLevel}`
                : "أعلى مستوى"}
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${performance.progressToNext}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ScoreCard label="اكتمال الملف" value={performance.metrics.completion} weight="15%" />
        <ScoreCard label="إتمام الحملات" value={performance.metrics.delivery} weight="25%" />
        <ScoreCard label="جودة المحتوى" value={performance.metrics.contentQuality} weight="25%" />
        <ScoreCard label="الاستجابة للتعديلات" value={performance.metrics.revisionResponse} weight="15%" />
        <ScoreCard label="دقة روابط النشر" value={performance.metrics.publicationAccuracy} weight="20%" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <p className="text-sm font-bold text-[#9F6EB8]">ملخص الأرقام</p>
          <h2 className="mt-1 text-xl font-black">مؤشرات الحساب</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="إجمالي المتابعين" value={number(followers)} />
            <Stat label="متوسط المشاهدات" value={number(averageViews)} />
            <Stat label="متوسط التفاعل" value={`${averageEngagement.toFixed(2)}%`} />
            <Stat label="الحملات المكتملة" value={`${completedAssignments}/${assignments.length}`} />
            <Stat label="المحتوى المعتمد" value={`${approvedContent}/${contentRows.length}`} />
            <Stat label="روابط النشر المعتمدة" value={`${approvedPublications}/${publicationRows.length}`} />
          </div>
        </div>

        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <p className="text-sm font-bold text-[#9F6EB8]">كيف يتحسن المستوى؟</p>
          <h2 className="mt-1 text-xl font-black">خطوات عملية</h2>
          <div className="mt-5 space-y-3">
            <Tip done={(influencer.profile_completion ?? 0) >= 90} text="إكمال الملف إلى 90% أو أكثر" />
            <Tip done={performance.metrics.delivery >= 80} text="إتمام الحملات المفتوحة دون تأخير" />
            <Tip done={performance.metrics.contentQuality >= 80} text="رفع محتوى ينجح من المراجعة الأولى" />
            <Tip done={performance.metrics.publicationAccuracy >= 90} text="إضافة روابط نشر صحيحة وفي الموعد" />
          </div>
        </div>
      </section>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  return (
    <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_14px_40px_rgba(68,82,140,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#65708F]">{label}</p>
        <span className="text-xs font-black text-[#9AA2BB]">{weight}</span>
      </div>
      <p className="mt-3 text-3xl font-black text-[#3D274F]">{value}%</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EEF1F8]">
        <div className="h-full rounded-full bg-[#A170BA]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FCF9FD] p-4">
      <p className="text-xs font-bold text-[#929AB4]">{label}</p>
      <p className="mt-2 text-lg font-black text-[#5C456B]">{value}</p>
    </div>
  );
}

function Tip({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FCF9FD] p-4">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
          done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <span className="text-sm font-bold text-[#5F6A8C]">{text}</span>
    </div>
  );
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function number(value: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(value);
}
