import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { removeParticipantDraft, saveDirectParticipantDrafts } from "./actions";

export const dynamic = "force-dynamic";

type Social = { platform: string; username: string; followers_count: number | null; average_views: number | null };
type Influencer = { id: string; full_name: string; mobile_e164: string; city: string | null; directory_status: string; restriction_status: string | null; social_accounts?: Social[] };
type Draft = { id: string; influencer_id: string; application_id: string | null; source: string; coordinator_id: string | null; status: string; assignment_id: string | null; selected_at: string; influencers: Influencer | Influencer[] | null };

export default async function ParticipantDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ q?: string; saved?: string; removed?: string; error?: string }> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const store = await cookies();
  const locale = normalizeDashboardLocale(store.get("dashboard_locale")?.value ?? store.get("app_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const copy = dictionary.operations.draft;
  const { supabase } = await requirePermission("campaigns", "update");

  const [{ data: campaign, error: campaignError }, { data: draftData, error: draftError }] = await Promise.all([
    supabase.from("campaigns").select("id,name,brand").eq("id", id).maybeSingle(),
    supabase.from("campaign_participant_drafts").select("id,influencer_id,application_id,source,coordinator_id,status,assignment_id,selected_at,influencers(id,full_name,mobile_e164,city,directory_status,restriction_status,social_accounts(platform,username,followers_count,average_views))").eq("campaign_id", id).neq("status", "removed").order("selected_at", { ascending: false }),
  ]);
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();
  if (draftError) throw new Error(draftError.message);
  const drafts = (draftData ?? []) as unknown as Draft[];
  const draftInfluencerIds = new Set(drafts.map((row) => row.influencer_id));

  const search = String(query.q ?? "").trim();
  let candidates: Influencer[] = [];
  if (search) {
    const { data, error } = await supabase.rpc("search_campaign_influencers", { p_campaign_id: id, p_query: search, p_limit: 30 });
    if (error) throw new Error(error.message);
    candidates = ((data ?? []) as Array<{ influencer_id: string; full_name: string; mobile_e164: string; city: string | null; available: boolean; social_accounts: Array<{ platform: string; username: string; followersCount: number | null }> | null }>).filter((row) => row.available && !draftInfluencerIds.has(row.influencer_id)).map((row) => ({ id: row.influencer_id, full_name: row.full_name, mobile_e164: row.mobile_e164, city: row.city, directory_status: "active", restriction_status: "normal", social_accounts: (row.social_accounts ?? []).map((social) => ({ platform: social.platform, username: social.username, followers_count: social.followersCount, average_views: null })) }));
  }

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-gradient-to-br from-[#A775C0] to-[#6676C8] p-6 text-white shadow-lg">
        <p className="text-sm font-black text-white/70">{campaign.brand || dictionary.campaignOpportunity.brandFallback}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-black">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold text-white/80">{copy.subtitle}</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/campaigns/${id}/applications/review`} className="rounded-xl bg-white/15 px-4 py-2 text-xs font-black text-white">{copy.applications}</Link>
            <Link href={`/dashboard/campaigns/${id}`} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#6658A8]">{copy.back}</Link>
          </div>
        </div>
      </section>

      {query.saved === "1" ? <Notice>{copy.saved}</Notice> : null}
      {query.removed === "1" ? <Notice>{copy.removed}</Notice> : null}
      {query.error ? <ErrorNotice>{draftErrorText(query.error, copy)}</ErrorNotice> : null}

      <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <article className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#432A57]">{copy.draftCount}</h2><p className="mt-1 text-sm font-semibold text-[#8A92AA]">{drafts.length}</p></div></div>
          {drafts.length ? (
            <div className="mt-4 divide-y divide-[#F0E8F3]">
              {drafts.map((draft) => {
                const influencer = relation(draft.influencers);
                const social = influencer?.social_accounts?.[0];
                return (
                  <div key={draft.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-[#4C335F]">{influencer?.full_name ?? "—"}</p><span className="rounded-full bg-[#F4EEFA] px-2.5 py-1 text-[10px] font-black text-[#715387]">{draft.source === "application" ? copy.sourceApplication : copy.sourceDirect}</span></div>
                      <p dir="ltr" className="mt-1 text-start text-xs font-bold text-[#8A92AA]">{influencer?.mobile_e164 ?? "—"}</p>
                      <p className="mt-1 text-xs font-semibold text-[#9A8FA0]">{[influencer?.city, social ? `${social.platform} @${social.username}` : null].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">{draft.status === "assigned" ? copy.statusAssigned : copy.statusDraft}</span></div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {draft.status === "assigned" && draft.assignment_id ? <Link href={`/dashboard/campaigns/${id}/influencers/${draft.assignment_id}`} className="rounded-xl border border-[#DED2E5] px-3 py-2 text-xs font-black text-[#6658A8]">{copy.assignment}</Link> : (
                        <Link href={`/dashboard/campaigns/${id}/participants/draft/${draft.id}`} className="rounded-xl bg-[#6658A8] px-3 py-2 text-xs font-black text-white">{copy.createAssignment}</Link>
                      )}
                      {draft.status === "draft" ? <form action={removeParticipantDraft}><input type="hidden" name="campaign_id" value={id}/><input type="hidden" name="draft_id" value={draft.id}/><button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">{copy.remove}</button></form> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>{copy.empty}</Empty>}
        </article>

        <article className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#432A57]">{copy.addDirect}</h2>
          <form className="mt-4 flex gap-2" method="get"><input name="q" defaultValue={search} placeholder={copy.searchPlaceholder} className="h-11 min-w-0 flex-1 rounded-xl border border-[#E7DCEB] bg-[#FCFAFD] px-3 text-sm font-bold outline-none focus:border-[#A775C0]"/><button className="rounded-xl bg-[#6658A8] px-4 text-xs font-black text-white">{copy.search}</button></form>
          {search ? (
            candidates.length ? <form action={saveDirectParticipantDrafts} className="mt-4"><input type="hidden" name="campaign_id" value={id}/><div className="max-h-[430px] space-y-2 overflow-y-auto pe-1">{candidates.map((creator) => <label key={creator.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#EEE5F1] p-3 hover:bg-[#FCFAFD]"><input type="checkbox" name="influencer_ids" value={creator.id} className="mt-1 h-4 w-4"/><span className="min-w-0"><span className="block truncate text-sm font-black text-[#4C335F]">{creator.full_name}</span><span dir="ltr" className="mt-0.5 block text-start text-[11px] font-bold text-[#8A92AA]">{creator.mobile_e164}</span><span className="mt-1 block text-[11px] font-semibold text-[#9A8FA0]">{creator.city || "—"}</span></span></label>)}</div><button className="mt-4 w-full rounded-xl bg-[#8F62A7] px-4 py-3 text-xs font-black text-white">{copy.saveSelected}</button></form> : <Empty>{copy.noResults}</Empty>
          ) : <p className="mt-4 text-xs font-semibold leading-6 text-[#9A8FA0]">{copy.searchPlaceholder}</p>}
        </article>
      </section>
    </main>
  );
}

function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{children}</div>; }
function ErrorNotice({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">{children}</div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="mt-4 rounded-2xl border border-dashed border-[#E8DDEA] bg-[#FCFAFD] p-8 text-center text-sm font-bold text-[#8C7B94]">{children}</div>; }
function draftErrorText(code: string, copy: ReturnType<typeof getDashboardDictionary>["operations"]["draft"]) { if (code === "no_selection") return copy.noSelection; if (code === "portal_required") return copy.portalRequired; if (code === "blacklisted") return copy.blacklisted; if (code === "already_assigned") return copy.alreadyAssigned; return copy.notAvailable; }
