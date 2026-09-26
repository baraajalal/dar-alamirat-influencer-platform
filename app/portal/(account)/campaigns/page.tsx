import { cookies } from "next/headers";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app-dictionary";
import { applyToCampaign, withdrawApplication } from "./actions";

type CampaignRow = {
  name: string;
  brand: string | null;
  brand_id: string | null;
  product: string | null;
  brief: string | null;
  start_date: string | null;
  end_date: string | null;
};

type AssignmentRow = {
  id: string;
  status: string;
  execution_type: string | null;
  content_due_at: string | null;
  publishing_date: string | null;
  branch: string | null;
  order_number: string | null;
  created_at: string;
  accepted_at: string | null;
  brief_sent_at: string | null;
  assignment_brief_override: string | null;
  product_required: boolean;
  product_fulfillment_status: string;
  campaigns: CampaignRow | CampaignRow[] | null;
};

type OpportunityRow = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  campaign_type: string | null;
  opportunity_type: string | null;
  opportunity_summary: string | null;
  opportunity_goal: string | null;
  application_requirements: string | null;
  brief: string | null;
  hashtags: string[] | null;
  reference_links: string[] | null;
  brief_public_url: string | null;
  opportunity_image_urls: string[] | null;
  public_compensation_mode: string;
  public_compensation_amount: number | null;
  public_compensation_max_amount: number | null;
  public_compensation_currency: string;
  public_compensation_notes: string | null;
  require_campaign_terms_acceptance: boolean;
  start_date: string | null;
  end_date: string | null;
  applications_close_at: string | null;
  max_participants: number | null;
  application_status: string | null;
  application_id: string | null;
  application_rejection_reason: string | null;
  applied_at: string | null;
  can_apply: boolean;
  brand_name_ar: string | null;
  brand_name_en: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  eligibility_reason: string | null;
  eligibility_blocked_until: string | null;
};

type CampaignCopy = AppDictionary["campaigns"];

export default async function InfluencerCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ applied?: string; withdrawn?: string; error?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const [{ admin, supabase, influencer }, cookieStore] = await Promise.all([requireInfluencerAccount(), cookies()]);
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const copy = getAppDictionary(locale).campaigns;

  const [assignmentResult, opportunityResult] = await Promise.all([
    admin
      .from("campaign_assignments")
      .select("id,status,execution_type,content_due_at,publishing_date,branch,order_number,created_at,accepted_at,brief_sent_at,assignment_brief_override,product_required,product_fulfillment_status,campaigns(name,brand,brand_id,product,brief,start_date,end_date)")
      .eq("influencer_id", influencer.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("list_campaign_opportunities"),
  ]);

  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  if (opportunityResult.error) throw new Error(opportunityResult.error.message);

  const campaignAssignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const activeBlacklist = influencer.restriction_status === "blacklisted" && (!influencer.restriction_expires_at || new Date(influencer.restriction_expires_at).getTime() > Date.now());
  const opportunities = activeBlacklist ? [] : (opportunityResult.data ?? []) as OpportunityRow[];
  const assignmentBrandIds = Array.from(new Set(campaignAssignments.map((assignment) => relation(assignment.campaigns)?.brand_id).filter((value): value is string => Boolean(value))));
  const { data: brandRows, error: brandError } = assignmentBrandIds.length
    ? await admin.from("brands").select("id,name_ar,name_en,logo_url,primary_color,whatsapp_number,contact_email,primary_contact_id").in("id", assignmentBrandIds)
    : { data: [], error: null };
  if (brandError) throw new Error(brandError.message);
  const contactIds = Array.from(new Set((brandRows ?? []).map((brand) => brand.primary_contact_id).filter((value): value is string => Boolean(value))));
  const { data: contactRows, error: contactError } = contactIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", contactIds)
    : { data: [], error: null };
  if (contactError) throw new Error(contactError.message);
  const contactMap = new Map((contactRows ?? []).map((contact) => [contact.id, contact.full_name]));
  const brandMap = new Map((brandRows ?? []).map((brand) => [brand.id, { ...brand, contact_name: brand.primary_contact_id ? contactMap.get(brand.primary_contact_id) ?? null : null }]));

  return (
    <div data-no-auto-translate className="space-y-7">
      <Header eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      {query.applied === "1" ? <Notice tone="success">{copy.applied}</Notice> : null}
      {query.withdrawn === "1" ? <Notice tone="neutral">{copy.withdrawn}</Notice> : null}
      {query.error ? <Notice tone="error">{errorMessage(query.error, copy)}</Notice> : null}

      <section className="space-y-4">
        <SectionTitle title={copy.opportunitiesTitle} description={copy.opportunitiesDescription} />
        {opportunities.length === 0 ? (
          <Empty text={copy.noOpportunities} />
        ) : (
          opportunities.map((campaign) => {
            const status = campaign.application_status;
            const hashtags = campaign.hashtags ?? [];
            const references = campaign.reference_links ?? [];
            const images = campaign.opportunity_image_urls ?? [];

            return (
              <article key={campaign.id} className="overflow-hidden rounded-[30px] border border-white bg-white/95 shadow-[0_18px_50px_rgba(68,82,140,0.10)]">
                {images.length ? (
                  <div className="grid max-h-[420px] grid-cols-2 gap-1 overflow-hidden bg-[#F8F4FA] md:grid-cols-4">
                    {images.slice(0, 4).map((url, index) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block min-h-40 overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${campaign.product || campaign.name} ${index + 1}`} className="h-full w-full object-cover transition hover:scale-[1.02]" />
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="p-6">
                  {campaign.brand_logo_url ? (
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#EEE4F2] bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={campaign.brand_logo_url} alt={(locale === "ar" ? campaign.brand_name_ar : campaign.brand_name_en) || campaign.brand || campaign.name} className="h-full w-full object-contain p-1.5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#94839C]">{copy.brandTeam}</p>
                        <p className="text-sm font-black text-[#5C456B]">{(locale === "ar" ? campaign.brand_name_ar : campaign.brand_name_en) || campaign.brand || copy.notSet}</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap gap-2">
                        {(locale === "ar" ? campaign.brand_name_ar : campaign.brand_name_en) || campaign.brand ? <Tag>{(locale === "ar" ? campaign.brand_name_ar : campaign.brand_name_en) || campaign.brand}</Tag> : null}
                        {campaign.product ? <Tag>{campaign.product}</Tag> : null}
                        {campaign.campaign_type ? <Tag>{campaign.campaign_type}</Tag> : null}
                        {campaign.opportunity_type ? <Tag>{opportunityTypeLabel(campaign.opportunity_type, copy)}</Tag> : null}
                      </div>
                      <h2 className="mt-3 text-2xl font-black text-[#3D274F]">{campaign.name}</h2>
                      {campaign.opportunity_summary ? <p className="mt-2 text-sm font-semibold leading-7 text-[#7C85A0]">{campaign.opportunity_summary}</p> : null}
                    </div>
                    {status ? <ApplicationBadge status={status} copy={copy} /> : null}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Info label={copy.collaborationType} value={opportunityTypeLabel(campaign.opportunity_type, copy)} />
                    <Info label={copy.compensation} value={compensationLabel(campaign, locale, copy)} />
                    <Info label={copy.campaignStart} value={formatDate(campaign.start_date, locale, copy)} />
                    <Info label={copy.applicationClose} value={formatDateTime(campaign.applications_close_at, locale, copy)} />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {campaign.opportunity_goal ? <DetailBlock title={copy.campaignGoal}>{campaign.opportunity_goal}</DetailBlock> : null}
                    {campaign.brief ? <DetailBlock title={copy.brief}>{campaign.brief}</DetailBlock> : null}
                    {campaign.application_requirements ? <DetailBlock title={copy.requirements}>{campaign.application_requirements}</DetailBlock> : null}
                    {campaign.public_compensation_notes ? <DetailBlock title={copy.compensationDetails}>{campaign.public_compensation_notes}</DetailBlock> : null}
                  </div>

                  {hashtags.length ? (
                    <div className="mt-5 rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4">
                      <p className="text-xs font-black text-[#6D5677]">{copy.hashtags}</p>
                      <div className="mt-3 flex flex-wrap gap-2">{hashtags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                    </div>
                  ) : null}

                  {campaign.brief_public_url || references.length ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {campaign.brief_public_url ? <ExternalLink href={campaign.brief_public_url}>{copy.openBrief}</ExternalLink> : null}
                      {references.map((url, index) => <ExternalLink key={`${url}-${index}`} href={url}>{copy.reference} {index + 1}</ExternalLink>)}
                    </div>
                  ) : null}

                  {status === "rejected" ? (
                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-700">
                      <span className="font-black">{copy.rejectionReason} </span>
                      {campaign.application_rejection_reason || copy.rejectionFallback}
                    </div>
                  ) : null}

                  {campaign.can_apply && (!status || status === "withdrawn") ? (
                    <form action={applyToCampaign} className="mt-6 space-y-4 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input name="message" maxLength={1200} placeholder={copy.optionalMessage} className="h-12 w-full rounded-2xl border border-[#E9DFF0] bg-white px-4 text-sm font-bold outline-none focus:border-[#A170BA]" />
                      {campaign.require_campaign_terms_acceptance ? (
                        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold leading-7 text-[#5C456B]">
                          <input name="accept_terms" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" />
                          <span>{copy.termsAcceptance}</span>
                        </label>
                      ) : null}
                      <button className="rounded-2xl bg-gradient-to-br from-[#A170BA] to-[#8C5BA5] px-6 py-3 text-sm font-black text-white">{copy.apply}</button>
                    </form>
                  ) : status === "pending" || status === "shortlisted" ? (
                    <form action={withdrawApplication} className="mt-5">
                      <input type="hidden" name="application_id" value={campaign.application_id ?? ""} />
                      <button className="rounded-2xl border border-[#E7DCEB] bg-white px-5 py-3 text-sm font-black text-[#7B5B88]">{copy.withdraw}</button>
                    </form>
                  ) : (!campaign.can_apply && (!status || status === "withdrawn")) ? (
                    campaign.eligibility_reason ? (
                      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-7 text-amber-800">
                        <p className="font-black">{copy.exclusivityBlocked}</p>
                        <p className="mt-1">{campaign.eligibility_reason === "all_campaigns_exclusivity"
                          ? interpolate(copy.exclusivityGlobal, { date: formatDateTime(campaign.eligibility_blocked_until, locale, copy) })
                          : interpolate(copy.exclusivityBrand, { date: formatDateTime(campaign.eligibility_blocked_until, locale, copy) })}</p>
                      </div>
                    ) : <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">{copy.applicationsClosed}</div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle title={copy.myCampaignsTitle} description={copy.myCampaignsDescription} />
        {campaignAssignments.length === 0 ? (
          <Empty text={copy.noCampaigns} />
        ) : (
          campaignAssignments.map((assignment) => {
            const campaign = relation(assignment.campaigns);
            return (
              <article key={assignment.id} className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap gap-2">{campaign?.brand ? <Tag>{campaign.brand}</Tag> : null}{campaign?.product ? <Tag>{campaign.product}</Tag> : null}</div>
                    <h2 className="mt-3 text-xl font-black text-[#3D274F]">{campaign?.name ?? copy.campaignFallback}</h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#7C85A0]">{campaign?.brief || copy.assignmentFallback}</p>
                  </div>
                  <span className="rounded-full bg-[#F7F0FA] px-4 py-2 text-xs font-black text-[#5E72CF]">{statusLabel(String(assignment.status), copy)}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label={copy.executionType} value={executionLabel(assignment.execution_type, copy)} />
                  <Info label={copy.locationOrOrder} value={assignment.branch || assignment.order_number || copy.notSet} />
                </div>
                <AssignmentExecutionSummary assignment={assignment} campaign={campaign} locale={locale} copy={copy} />
                {campaign?.brand_id && !["invited", "rejected", "cancelled"].includes(String(assignment.status)) && brandMap.get(campaign.brand_id) ? (() => {
                  const brand = brandMap.get(campaign.brand_id)!;
                  return (
                    <div className="mt-5 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4">
                      <p className="text-xs font-black text-[#6D5677]">{copy.campaignContact}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {brand.logo_url ? <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={brand.logo_url} alt={locale === "ar" ? brand.name_ar : brand.name_en} className="h-full w-full object-contain p-1" /></div> : null}
                        <div className="min-w-0">
                          <p className="font-black text-[#5C456B]">{locale === "ar" ? brand.name_ar : brand.name_en}</p>
                          {brand.contact_name ? <p className="text-xs font-bold text-[#8A92AA]">{copy.contactPerson}: {brand.contact_name}</p> : null}
                        </div>
                        <div className="ms-auto flex flex-wrap gap-2">
                          {brand.whatsapp_number ? <a href={`https://wa.me/${String(brand.whatsapp_number).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">{copy.contactWhatsApp}</a> : null}
                          {brand.contact_email ? <a href={`mailto:${brand.contact_email}`} className="rounded-xl border border-[#E2D6E8] bg-white px-4 py-2 text-xs font-black text-[#69547A]">{copy.contactEmail}</a> : null}
                        </div>
                      </div>
                    </div>
                  );
                })() : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}


function AssignmentExecutionSummary({ assignment, campaign, locale, copy }: { assignment: AssignmentRow; campaign: CampaignRow | null; locale: AppLocale; copy: CampaignCopy }) {
  const w = copy.executionWorkflow;
  const productLabels: Record<string, string> = {
    not_required: w.notRequired,
    pending: w.pending,
    dispatched: w.dispatched,
    received: w.received,
  };
  const productStatus = !assignment.product_required
    ? w.notRequired
    : productLabels[assignment.product_fulfillment_status] ?? assignment.product_fulfillment_status;
  return (
    <div className="mt-5 rounded-2xl border border-[#E9DFF0] bg-[#FBF8FD] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-[#5C456B]">{w.title}</p>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#6D5677]">{statusLabel(String(assignment.status), copy)}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label={w.accepted} value={assignment.accepted_at ? formatDateTime(assignment.accepted_at, locale, copy) : w.notSet} />
        <Info label={w.briefSent} value={assignment.brief_sent_at ? formatDateTime(assignment.brief_sent_at, locale, copy) : w.notSet} />
        <Info label={w.productStatus} value={productStatus} />
        <Info label={w.contentDue} value={formatDateTime(assignment.content_due_at, locale, copy)} />
      </div>
      {(assignment.assignment_brief_override || campaign?.brief) ? <div className="mt-4"><DetailBlock title={w.creatorBrief}>{assignment.assignment_brief_override || campaign?.brief}</DetailBlock></div> : null}
    </div>
  );
}

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]"><p className="text-sm font-black text-white/70">{eyebrow}</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">{description}</p></section>; }
function SectionTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-xl font-black text-[#432A57]">{title}</h2><p className="mt-1 text-sm font-semibold text-[#8A92AA]">{description}</p></div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-black text-[#9362AD]">{children}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#E8EBF7] bg-[#FDFBFE] p-4"><p className="text-xs font-bold text-[#94839C]">{label}</p><p className="mt-2 text-sm font-black text-[#5C456B]">{value}</p></div>; }
function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4"><p className="text-xs font-black text-[#6D5677]">{title}</p><div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#66536E]">{children}</div></div>; }
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#E2D6E8] bg-white px-4 py-2 text-xs font-black text-[#69547A] hover:bg-[#FBF8FD]">{children} ↗</a>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[28px] border border-dashed border-[#EADFF0] bg-white/75 px-4 py-14 text-center text-sm text-[#8C7B94]">{text}</div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "success" | "error" | "neutral" }) { const cls=tone==="success"?"border-emerald-200 bg-emerald-50 text-emerald-700":tone==="error"?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-slate-50 text-slate-700"; return <div className={`rounded-2xl border px-5 py-4 text-sm font-black ${cls}`}>{children}</div>; }
function ApplicationBadge({ status, copy }: { status: string; copy: CampaignCopy }) { const labels = copy.applicationStatuses as Record<string, string>; return <span className="rounded-full bg-[#F2F4FF] px-4 py-2 text-xs font-black text-[#5E72CF]">{labels[status]??status}</span>; }
function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function executionLabel(value: string | null, copy: CampaignCopy) { const labels = copy.executionTypes as Record<string, string>; return value ? labels[value]??value : copy.notSet; }
function statusLabel(value: string, copy: CampaignCopy) { const labels = copy.assignmentStatuses as Record<string, string>; return labels[value]??value; }
function opportunityTypeLabel(value: string | null, copy: CampaignCopy) { const labels = copy.opportunityTypes as Record<string, string>; return value ? labels[value]??value : copy.notSet; }
function compensationLabel(campaign: OpportunityRow, locale: AppLocale, copy: CampaignCopy) {
  const currency = campaign.public_compensation_currency || "SAR";
  const amount = (value: number | null) => value === null ? "" : new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(value);
  if (campaign.public_compensation_mode === "fixed" && campaign.public_compensation_amount !== null) return `${amount(campaign.public_compensation_amount)} ${currency}`;
  if (campaign.public_compensation_mode === "range" && campaign.public_compensation_amount !== null && campaign.public_compensation_max_amount !== null) return `${amount(campaign.public_compensation_amount)} - ${amount(campaign.public_compensation_max_amount)} ${currency}`;
  if (campaign.public_compensation_mode === "negotiable") return copy.compensationNegotiable;
  return campaign.opportunity_type === "pr" ? copy.prNoPayment : copy.notSet;
}
function formatDate(value: string | null, locale: AppLocale, copy: CampaignCopy) { return value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US",{dateStyle:"medium"}).format(new Date(`${value}T12:00:00`)) : copy.notSet; }
function formatDateTime(value: string | null, locale: AppLocale, copy: CampaignCopy) { return value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(value)) : copy.notSet; }
function interpolate(value: string, replacements: Record<string, string>) { return Object.entries(replacements).reduce((text,[key,replacement]) => text.replaceAll(`{${key}}`, replacement), value); }
function errorMessage(code: string, copy: CampaignCopy) { const labels = copy.errors as Record<string, string>; return labels[code] ?? copy.errors.default; }
