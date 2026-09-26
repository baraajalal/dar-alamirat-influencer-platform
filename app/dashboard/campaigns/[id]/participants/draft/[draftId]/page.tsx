import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { SimplifiedAssignmentForm } from "./simplified-assignment-form";

export const dynamic = "force-dynamic";

type Influencer = { id: string; full_name: string; mobile_e164: string; city: string | null; social_accounts: { id: string; platform: string; username: string; followers_count: number | null }[] };
type Campaign = { id: string; name: string; brand: string | null; brief: string | null; public_compensation_amount: number | null; public_compensation_currency: string | null; content_due_at: string | null; publishing_date: string | null };
type Draft = { id: string; status: string; source: string; influencers: Influencer | Influencer[] | null; campaigns: Campaign | Campaign[] | null };

export default async function SimplifiedAssignmentPage({ params, searchParams }: { params: Promise<{ id: string; draftId: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { id, draftId } = await params;
  const query = (await searchParams) ?? {};
  const store = await cookies();
  const locale = normalizeDashboardLocale(store.get("dashboard_locale")?.value ?? store.get("app_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const copy = dictionary.operations.assignmentSimple;
  const { supabase } = await requirePermission("campaigns", "update");
  const { data, error } = await supabase.from("campaign_participant_drafts").select("id,status,source,influencers(id,full_name,mobile_e164,city,social_accounts(id,platform,username,followers_count)),campaigns(id,name,brand,brief,public_compensation_amount,public_compensation_currency,content_due_at,publishing_date)").eq("id", draftId).eq("campaign_id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const draft = data as unknown as Draft;
  if (draft.status !== "draft") notFound();
  const influencer = relation(draft.influencers);
  const campaign = relation(draft.campaigns);
  if (!influencer || !campaign) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-gradient-to-br from-[#A775C0] to-[#6676C8] p-6 text-white shadow-lg">
        <p className="text-sm font-black text-white/70">{campaign.brand || dictionary.campaignOpportunity.brandFallback}</p><h1 className="mt-2 text-2xl font-black">{copy.title}</h1><p className="mt-2 text-sm font-semibold text-white/80">{copy.subtitle}</p>
      </section>
      {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">{assignmentError(query.error, copy)}</div> : null}
      <section className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2"><Info label={copy.creator} value={influencer.full_name}/><Info label={copy.campaign} value={campaign.name}/></div>
        {campaign.brief ? <details className="mt-4 rounded-2xl bg-[#FCFAFD] p-4"><summary className="cursor-pointer text-xs font-black text-[#6658A8]">{copy.inherit}</summary><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#6D5A75]">{campaign.brief}</p></details> : null}
      </section>
      <section className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm"><SimplifiedAssignmentForm campaignId={id} draftId={draftId} socials={influencer.social_accounts ?? []} campaignDefaultAmount={campaign.public_compensation_amount} copy={copy}/></section>
      <Link href={`/dashboard/campaigns/${id}/participants/draft`} className="inline-flex rounded-xl border border-[#E6DAEB] bg-white px-4 py-2 text-xs font-black text-[#6658A8]">{copy.cancel}</Link>
    </main>
  );
}
function relation<T>(value:T|T[]|null):T|null { return Array.isArray(value)?value[0]??null:value; }
function Info({label,value}:{label:string;value:string}) { return <div className="rounded-2xl bg-[#FCFAFD] p-4"><p className="text-[11px] font-black text-[#9A8FA0]">{label}</p><p className="mt-1 text-sm font-black text-[#4C335F]">{value}</p></div>; }
function assignmentError(code:string, copy: ReturnType<typeof getDashboardDictionary>["operations"]["assignmentSimple"]) { if(code==="order_required")return copy.orderRequired;if(code==="amount_required")return copy.amountRequired;if(code==="branch_required")return copy.branchRequired;if(code==="social_required")return copy.socialRequired;return copy.subtitle; }
