import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SocialPlatformLink from "@/components/social-platform-link";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale, type DashboardLocale } from "@/lib/i18n/dashboard";
import { reviewApplication } from "../actions";
import { CampaignQualificationSettingsPanel, type CampaignQualificationSettings, campaignQualificationMessage } from "./campaign-qualification-panel";
import { saveApplicationParticipantDrafts } from "../../participants/draft/actions";

export const dynamic = "force-dynamic";

type Social = { platform: string; platform_label: string | null; username: string; profile_url: string | null; followers_count: number | null; engagement_rate: number | null; average_views: number | null; average_likes: number | null };
type Influencer = { id: string; full_name: string; mobile_e164: string; city: string | null; country: string | null; restriction_status?: string | null; social_accounts: Social[] };
type Application = { id: string; status: string; message: string | null; rejection_reason: string | null; created_at: string; assignment_id: string | null; agreed_compensation_mode: string | null; agreed_compensation_amount: number | null; agreed_compensation_max_amount: number | null; agreed_compensation_currency: string | null; influencers: Influencer | Influencer[] | null };
type Rank = { application_id: string; score: number; blocked: boolean; metrics: { city?: string | null; platforms?: string[]; followers?: number; average_views?: number; engagement_rate?: number; same_brand_history_count?: number } | null };

export default async function CampaignApplicationReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ reviewed?: string; error?: string; qualification_settings_saved?: string; saved?: string }> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const store = await cookies();
  const locale = normalizeDashboardLocale(store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const copy = dictionary.operations.applicationsCompact;
  const legacy = dictionary.campaignOpportunity;
  const { supabase } = await requirePermission("campaigns", "update");

  const [{ data: campaign, error: campaignError }, { data: applications, error: applicationsError }, { data: ranksData }, { data: settingsData, error: settingsError }, { count: draftCount }] = await Promise.all([
    supabase.from("campaigns").select("id,name,brand").eq("id", id).maybeSingle(),
    supabase.from("campaign_applications").select("id,status,message,rejection_reason,created_at,assignment_id,agreed_compensation_mode,agreed_compensation_amount,agreed_compensation_max_amount,agreed_compensation_currency,influencers(id,full_name,mobile_e164,city,country,restriction_status,social_accounts(platform,platform_label,username,profile_url,followers_count,engagement_rate,average_views,average_likes))").eq("campaign_id", id).order("created_at", { ascending: false }),
    supabase.rpc("list_campaign_application_auto_rankings", { p_campaign_id: id }),
    supabase.from("campaign_qualification_settings").select("target_cities,target_platforms,min_followers,min_average_views,min_engagement_rate,prefer_previous_brand_experience").eq("campaign_id", id).maybeSingle(),
    supabase.from("campaign_participant_drafts").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "draft"),
  ]);

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();
  if (applicationsError) throw new Error(applicationsError.message);
  const rows = (applications ?? []) as unknown as Application[];
  const ranks = (ranksData ?? []) as unknown as Rank[];
  const rankMap = new Map(ranks.map((rank) => [rank.application_id, rank]));
  const sorted = [...rows].sort((a, b) => (rankMap.get(b.id)?.score ?? 0) - (rankMap.get(a.id)?.score ?? 0));
  const qualificationSettings = settingsError ? null : (settingsData as CampaignQualificationSettings | null);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-gradient-to-br from-[#A775C0] to-[#6676C8] p-6 text-white shadow-lg">
        <p className="text-sm font-black text-white/70">{campaign.brand || legacy.brandFallback}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold text-white/80">{copy.subtitle}</p></div><div className="flex flex-wrap gap-2"><Link href={`/dashboard/campaigns/${id}/participants/draft`} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#6658A8]">{copy.openDraft} · {draftCount ?? 0}</Link><Link href={`/dashboard/campaigns/${id}`} className="rounded-xl bg-white/15 px-4 py-2 text-xs font-black text-white">{legacy.backToCampaign}</Link></div></div>
      </section>

      {query.saved === "1" ? <Notice>{copy.saved}</Notice> : null}
      {query.reviewed === "1" ? <Notice>{legacy.review.updated}</Notice> : null}
      {query.qualification_settings_saved === "1" ? <Notice>{campaignQualificationMessage(locale, "settings_saved")}</Notice> : null}
      {query.error ? <ErrorNotice>{applicationError(query.error, dictionary)}</ErrorNotice> : null}

      <details className="rounded-[24px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-[#432A57]">{copy.settings}</h2><p className="mt-1 text-xs font-semibold leading-6 text-[#8A92AA]">{copy.settingsHint}</p></div><span className="rounded-full bg-[#F4EEFA] px-3 py-1.5 text-xs font-black text-[#6658A8]">{dictionary.operations.common.showMore}</span></div></summary>
        <div className="mt-5"><CampaignQualificationSettingsPanel campaignId={id} locale={locale} settings={qualificationSettings} setupAvailable={!settingsError}/></div>
      </details>

      {sorted.length === 0 ? <Empty>{copy.noRequests}</Empty> : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] border border-[#ECE1F1] bg-white shadow-sm">
            <div className="hidden grid-cols-[42px_minmax(180px,1.4fr)_90px_130px_110px_120px_110px] gap-3 border-b border-[#EEE5F1] bg-[#FCFAFD] px-4 py-3 text-[11px] font-black text-[#8A7892] md:grid">
              <span>{copy.select}</span><span>{copy.creator}</span><span>{copy.score}</span><span>{copy.platform}</span><span>{copy.city}</span><span>{copy.views}</span><span>{copy.status}</span>
            </div>
            <div className="divide-y divide-[#F0E8F3]">
              {sorted.map((row) => {
                const influencer = relation(row.influencers);
                const rank = rankMap.get(row.id);
                const socials = influencer?.social_accounts ?? [];
                const top = [...socials].sort((a,b)=>(b.followers_count??0)-(a.followers_count??0))[0];
                const selectable = (row.status === "pending" || row.status === "shortlisted") && !rank?.blocked && !row.assignment_id;
                return (
                  <article key={row.id} className="p-4">
                    <div className="grid gap-3 md:grid-cols-[42px_minmax(180px,1.4fr)_90px_130px_110px_120px_110px] md:items-center">
                      <div>{selectable ? <input form="application-draft-form" type="checkbox" name="application_ids" value={row.id} className="h-5 w-5 rounded border-[#D8CBE0]" aria-label={copy.select}/> : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F3EDF6] text-[10px] font-black text-[#9A8FA0]">—</span>}</div>
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-[#4C335F]">{influencer?.full_name ?? "—"}</p>{rank?.blocked ? <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700">{copy.blocked}</span>:null}</div><p dir="ltr" className="mt-1 truncate text-start text-[11px] font-bold text-[#8A92AA]">{influencer?.mobile_e164 ?? "—"}</p></div>
                      <div><span className="inline-flex min-w-14 justify-center rounded-full bg-[#F2F0FB] px-3 py-1.5 text-xs font-black text-[#5E72CF]">{rank?.score ?? 0}%</span></div>
                      <div className="text-xs font-bold text-[#685572]">{top ? <SocialPlatformLink platform={top.platform} platformLabel={top.platform_label} url={top.profile_url || fallbackSocialUrl(top.platform,top.username)} compact/> : "—"}</div>
                      <div className="text-xs font-bold text-[#685572]">{influencer?.city || "—"}</div>
                      <div className="text-xs font-black text-[#685572]">{formatCompact(rank?.metrics?.average_views ?? top?.average_views ?? null,locale)}</div>
                      <div><Status status={row.status} labels={legacy.review.statuses as Record<string,string>}/></div>
                    </div>
                    <details className="mt-3 rounded-2xl bg-[#FCFAFD] px-4 py-3"><summary className="cursor-pointer text-xs font-black text-[#6658A8]">{copy.details}</summary><div className="mt-4 grid gap-4 lg:grid-cols-3"><Info label={copy.followers} value={formatCompact(rank?.metrics?.followers ?? top?.followers_count ?? null,locale)}/><Info label={legacy.review.engagement} value={formatPercent(rank?.metrics?.engagement_rate ?? top?.engagement_rate ?? null,locale)}/><Info label={copy.city} value={influencer?.city||"—"}/></div>{socials.length ? <div className="mt-4 flex flex-wrap gap-2">{socials.map((social)=><SocialPlatformLink key={`${social.platform}-${social.username}`} platform={social.platform} platformLabel={social.platform_label} url={social.profile_url||fallbackSocialUrl(social.platform,social.username)} compact/>)}</div>:null}{row.message ? <div className="mt-4 rounded-xl bg-white p-3"><p className="text-[11px] font-black text-[#8A7892]">{copy.creatorMessage}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-[#65536E]">{row.message}</p></div>:null}<div className="mt-4 flex flex-wrap items-end gap-2">{influencer?.id ? <Link href={`/dashboard/influencers/${influencer.id}`} className="rounded-xl border border-[#E6DAEB] px-3 py-2 text-xs font-black text-[#6658A8]">{legacy.review.openCreator}</Link>:null}{row.assignment_id ? <Link href={`/dashboard/campaigns/${id}/influencers/${row.assignment_id}`} className="rounded-xl border border-[#E6DAEB] px-3 py-2 text-xs font-black text-[#6658A8]">{legacy.review.openAssignment}</Link>:null}{row.status==="pending"||row.status==="shortlisted" ? <form action={reviewApplication} className="ms-auto flex flex-wrap gap-2"><input type="hidden" name="campaign_id" value={id}/><input type="hidden" name="application_id" value={row.id}/><input name="reason" required placeholder={copy.rejectReason} className="h-10 rounded-xl border border-[#E7DCEB] px-3 text-xs font-bold outline-none focus:border-rose-300"/><button name="decision" value="rejected" className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white">{copy.reject}</button></form>:null}</div></details>
                  </article>
                );
              })}
            </div>
          </div>
          <form id="application-draft-form" action={saveApplicationParticipantDrafts} className="sticky bottom-4 flex justify-end">
            <input type="hidden" name="campaign_id" value={id}/>
            <button className="rounded-2xl bg-gradient-to-br from-[#A775C0] to-[#6676C8] px-6 py-3 text-sm font-black text-white shadow-xl">{copy.saveDraft}</button>
          </form>
        </div>
      )}
    </main>
  );
}
function relation<T>(value:T|T[]|null):T|null{return Array.isArray(value)?value[0]??null:value;}
function Status({status,labels}:{status:string;labels:Record<string,string>}){return <span className="rounded-full bg-[#F4EEFA] px-2.5 py-1.5 text-[10px] font-black text-[#6658A8]">{labels[status]??status}</span>}
function Info({label,value}:{label:string;value:string}){return <div><p className="text-[10px] font-black text-[#9A8FA0]">{label}</p><p className="mt-1 text-xs font-black text-[#5B4667]">{value}</p></div>}
function Notice({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{children}</div>}
function ErrorNotice({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">{children}</div>}
function Empty({children}:{children:React.ReactNode}){return <div className="rounded-[24px] border border-dashed border-[#E8DDEA] bg-white p-12 text-center text-sm font-bold text-[#8C7B94]">{children}</div>}
function formatCompact(value:number|null|undefined,locale:DashboardLocale){if(value==null)return "—";return new Intl.NumberFormat(locale==="ar"?"ar-SA":"en-US",{notation:"compact",maximumFractionDigits:1}).format(value)}
function formatPercent(value:number|null|undefined,locale:DashboardLocale){if(value==null)return "—";return `${new Intl.NumberFormat(locale==="ar"?"ar-SA":"en-US",{maximumFractionDigits:2}).format(value)}%`}
function fallbackSocialUrl(platform:string,username:string){const u=encodeURIComponent(username.replace(/^@/,""));const key=platform.toLowerCase();if(key==="instagram")return `https://www.instagram.com/${u}`;if(key==="tiktok")return `https://www.tiktok.com/@${u}`;if(key==="snapchat")return `https://www.snapchat.com/add/${u}`;if(key==="youtube")return `https://www.youtube.com/@${u}`;if(key==="x"||key==="twitter")return `https://x.com/${u}`;return null;}
function applicationError(code:string,dictionary:ReturnType<typeof getDashboardDictionary>){const copy=dictionary.operations.draft;if(code==="no_selection")return copy.noSelection;if(code==="blacklisted")return copy.blacklisted;if(code==="portal_required")return copy.portalRequired;return (dictionary.campaignOpportunity.errors as Record<string,string>)[code]??dictionary.campaignOpportunity.errors.default;}
