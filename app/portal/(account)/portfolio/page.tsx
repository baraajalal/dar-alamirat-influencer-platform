import { cookies } from "next/headers";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app-dictionary";

type CampaignInfo = { name: string; brand: string | null; product: string | null };
type SocialInfo = { platform: string; username: string };
type AssignmentRow = {
  id: string;
  campaigns: CampaignInfo | CampaignInfo[] | null;
};
type Copy = AppDictionary["portfolio"];

export default async function InfluencerPortfolioPage() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).portfolio;
  const { admin, influencer } = await requireInfluencerAccount();

  const { data: assignments } = await admin
    .from("campaign_assignments")
    .select("id,campaigns(name,brand,product)")
    .eq("influencer_id", influencer.id)
    .order("created_at", { ascending: false });

  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const assignmentIds = assignmentRows.map((row) => row.id);
  const campaignByAssignment = new Map<string, CampaignInfo>();
  for (const assignment of assignmentRows) {
    const campaign = relation(assignment.campaigns) as CampaignInfo | null;
    if (campaign) campaignByAssignment.set(assignment.id, campaign);
  }

  let platforms: Array<{
    id: string;
    assignment_id: string;
    social_accounts: SocialInfo | SocialInfo[] | null;
  }> = [];

  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from("assignment_platforms")
      .select("id,assignment_id,social_accounts(platform,username)")
      .in("assignment_id", assignmentIds);
    platforms = (data ?? []) as typeof platforms;
  }

  const platformIds = platforms.map((row) => row.id);
  const platformById = new Map(platforms.map((row) => [row.id, row]));

  let contentRows: Array<{
    id: string;
    assignment_platform_id: string;
    content_type: string;
    status: string;
    approved_at: string | null;
  }> = [];

  if (platformIds.length > 0) {
    const { data } = await admin
      .from("content_items")
      .select("id,assignment_platform_id,content_type,status,approved_at")
      .in("assignment_platform_id", platformIds)
      .in("status", ["approved", "published"])
      .order("approved_at", { ascending: false });
    contentRows = (data ?? []) as typeof contentRows;
  }

  const contentIds = contentRows.map((row) => row.id);
  let publicationRows: Array<{
    id: string;
    content_item_id: string;
    platform: string;
    post_url: string;
    status: string;
    published_at: string | null;
  }> = [];

  if (contentIds.length > 0) {
    const { data } = await admin
      .from("publication_submissions")
      .select("id,content_item_id,platform,post_url,status,published_at")
      .in("content_item_id", contentIds)
      .order("submitted_at", { ascending: false });
    publicationRows = (data ?? []) as typeof publicationRows;
  }

  const publicationByContent = new Map<string, (typeof publicationRows)[number]>();
  for (const publication of publicationRows) {
    const existing = publicationByContent.get(publication.content_item_id);
    if (!existing || publication.status === "approved") {
      publicationByContent.set(publication.content_item_id, publication);
    }
  }

  const portfolioItems = contentRows.map((content) => {
    const platform = platformById.get(content.assignment_platform_id);
    const campaign = platform ? campaignByAssignment.get(platform.assignment_id) : undefined;
    const social = platform ? relation(platform.social_accounts) : null;
    return {
      content,
      campaign,
      social,
      publication: publicationByContent.get(content.id),
    };
  });

  return (
    <div className="space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
        <p className="text-sm font-black text-white/70">{copy.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
          {copy.description}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portfolioItems.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <Empty text={copy.empty} />
          </div>
        ) : (
          portfolioItems.map(({ content, campaign, social, publication }) => (
            <article
              key={content.id}
              className="rounded-[26px] border border-white bg-white/90 p-5 shadow-[0_15px_42px_rgba(68,82,140,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-black text-[#9362AD]">
                  {platformLabel(publication?.platform || social?.platform || "other", copy)}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                  {publication?.status === "approved" ? copy.publicationApproved : copy.contentApproved}
                </span>
              </div>

              <h2 className="mt-4 text-lg font-black text-[#4A315C]">
                {campaign?.name ?? copy.campaignFallback}
              </h2>
              <p className="mt-1 text-sm font-bold text-[#78829F]">
                {campaign?.brand ?? copy.brandFallback}
                {campaign?.product ? ` · ${campaign.product}` : ""}
              </p>

              <div className="mt-5 space-y-3 rounded-2xl bg-[#FCF9FD] p-4">
                <Info label={copy.contentType} value={content.content_type} />
                <Info label={copy.account} value={social?.username ? `@${social.username}` : copy.notSet} />
                <Info label={copy.approvalDate} value={formatDate(content.approved_at, locale, copy.notSet)} />
              </div>

              {publication?.post_url ? (
                <a
                  href={publication.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-[#9A68B5] text-sm font-black text-white"
                >
                  {copy.openPost} ↗
                </a>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-[#EADFF0] px-4 py-3 text-center text-xs font-bold text-[#8D7B95]">
                  {copy.publicationPending}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold text-[#94839C]">{label}</span>
      <span className="text-xs font-black text-[#4A5984]">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#EADFF0] bg-white/75 px-4 py-14 text-center text-sm text-[#8C7B94]">
      {text}
    </div>
  );
}

function formatDate(value: string | null, locale: AppLocale, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function platformLabel(value: string, copy: Copy) {
  return (copy.platforms as Record<string, string>)[value] ?? value;
}
