import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardIcon } from "@/components/dashboard/icons";
import { requirePermission } from "@/lib/auth/require-user";
import {
  getDashboardDictionary,
  normalizeDashboardLocale,
  type DashboardDictionary,
} from "@/lib/i18n/dashboard";
import { updateOpportunitySettings } from "./actions";

export const dynamic = "force-dynamic";

type Copy = DashboardDictionary["campaignOpportunity"];

export default async function CampaignOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const store = await cookies();
  const locale = normalizeDashboardLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getDashboardDictionary(locale).campaignOpportunity;
  const { supabase } = await requirePermission("campaigns", "update");

  const [
    { data: campaign, error: campaignError },
    { count: pendingApplicationCount, error: countError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id,name,brand,status,brief,hashtags,reference_links,brief_public_url,portal_visibility,opportunity_type,opportunity_summary,opportunity_goal,application_requirements,opportunity_image_urls,public_compensation_mode,public_compensation_amount,public_compensation_max_amount,public_compensation_currency,public_compensation_notes,require_campaign_terms_acceptance,applications_open_at,applications_close_at,max_applications,max_participants",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["pending", "shortlisted"]),
  ]);

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();
  if (countError) throw new Error(countError.message);

  return (
    <div className="space-y-6" data-no-auto-translate>
      <section className="rounded-[28px] bg-gradient-to-br from-[#A775C0] to-[#6676C8] p-6 text-white shadow-lg">
        <p className="text-sm font-black text-white/70">{campaign.brand || copy.brandFallback}</p>
        <h1 className="mt-2 text-2xl font-black">
          {replace(copy.opportunityTitle, { campaign: campaign.name })}
        </h1>
        <p className="mt-3 text-sm font-semibold text-white/80">{copy.opportunityDescription}</p>
        <Link
          href={`/dashboard/campaigns/${id}`}
          className="mt-5 inline-flex rounded-xl bg-white/15 px-4 py-2 text-xs font-black text-white"
        >
          {copy.backToCampaign}
        </Link>
      </section>

      <CampaignOpportunityNav
        campaignId={id}
        pendingCount={pendingApplicationCount ?? 0}
        active="opportunity"
        copy={copy}
      />

      {query.saved === "1" ? <Notice>{copy.saved}</Notice> : null}
      {query.error ? <ErrorNotice>{errorText(query.error, copy)}</ErrorNotice> : null}

      <section className="rounded-[26px] border border-[#ECE1F1] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-[#4C335F]">{copy.settingsTitle}</h2>
        <p className="mt-2 text-sm font-semibold text-[#8A92AA]">{copy.settingsDescription}</p>

        <form action={updateOpportunitySettings} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="campaign_id" value={id} />
          <Field label={copy.fields.visibility}>
            <select name="portal_visibility" defaultValue={campaign.portal_visibility} className={input}>
              <option value="hidden">{copy.visibility.hidden}</option>
              <option value="invite_only">{copy.visibility.invite_only}</option>
              <option value="community">{copy.visibility.community}</option>
            </select>
          </Field>
          <Field label={copy.fields.type}>
            <select name="opportunity_type" defaultValue={campaign.opportunity_type ?? ""} className={input}>
              <option value="">{copy.types.unset}</option>
              <option value="pr">{copy.types.pr}</option>
              <option value="paid">{copy.types.paid}</option>
              <option value="product">{copy.types.product}</option>
              <option value="voucher">{copy.types.voucher}</option>
              <option value="hybrid">{copy.types.hybrid}</option>
              <option value="other">{copy.types.other}</option>
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label={copy.fields.summary}>
              <textarea name="opportunity_summary" defaultValue={campaign.opportunity_summary ?? ""} className={textarea} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={copy.fields.goal}>
              <textarea name="opportunity_goal" defaultValue={campaign.opportunity_goal ?? ""} className={textarea} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={copy.fields.requirements}>
              <textarea name="application_requirements" defaultValue={campaign.application_requirements ?? ""} className={textarea} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={copy.fields.images}>
              <textarea
                name="opportunity_image_urls"
                dir="ltr"
                defaultValue={(campaign.opportunity_image_urls ?? []).join("\n")}
                className={`${textarea} text-left`}
              />
            </Field>
          </div>

          <Field label={copy.fields.compensationMode}>
            <select name="public_compensation_mode" defaultValue={campaign.public_compensation_mode ?? "none"} className={input}>
              <option value="none">{copy.compensationModes.none}</option>
              <option value="fixed">{copy.compensationModes.fixed}</option>
              <option value="range">{copy.compensationModes.range}</option>
              <option value="negotiable">{copy.compensationModes.negotiable}</option>
            </select>
          </Field>
          <Field label={copy.fields.currency}>
            <input name="public_compensation_currency" defaultValue={campaign.public_compensation_currency ?? "SAR"} className={input} dir="ltr" />
          </Field>
          <Field label={copy.fields.amount}>
            <input name="public_compensation_amount" type="number" min="0" step="0.01" defaultValue={campaign.public_compensation_amount ?? ""} className={input} />
          </Field>
          <Field label={copy.fields.maxAmount}>
            <input name="public_compensation_max_amount" type="number" min="0" step="0.01" defaultValue={campaign.public_compensation_max_amount ?? ""} className={input} />
          </Field>
          <div className="md:col-span-2">
            <Field label={copy.fields.compensationNotes}>
              <textarea name="public_compensation_notes" defaultValue={campaign.public_compensation_notes ?? ""} className={textarea} placeholder={copy.compensationPlaceholder} />
            </Field>
          </div>

          <Field label={copy.fields.openAt}>
            <input name="applications_open_at" type="datetime-local" defaultValue={toLocal(campaign.applications_open_at)} className={input} />
          </Field>
          <Field label={copy.fields.closeAt}>
            <input name="applications_close_at" type="datetime-local" defaultValue={toLocal(campaign.applications_close_at)} className={input} />
          </Field>
          <Field label={copy.fields.maxApplications}>
            <input name="max_applications" type="number" min="1" defaultValue={campaign.max_applications ?? ""} className={input} />
          </Field>
          <Field label={copy.fields.maxParticipants}>
            <input name="max_participants" type="number" min="1" defaultValue={campaign.max_participants ?? ""} className={input} />
          </Field>

          <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4 text-sm font-bold text-[#5C456B]">
            <input name="require_campaign_terms_acceptance" type="checkbox" defaultChecked={campaign.require_campaign_terms_acceptance ?? true} className="mt-1 h-5 w-5" />
            <span>{copy.requireAcceptance}</span>
          </label>

          <button className="rounded-2xl bg-[#8F62A7] px-6 py-3 text-sm font-black text-white md:col-span-2">
            {copy.save}
          </button>
        </form>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <Preview title={copy.currentBrief} value={campaign.brief || copy.notSet} />
          <Preview title={copy.currentHashtags} value={(campaign.hashtags ?? []).join(" ") || copy.notSetPlural} />
          <Preview title={copy.currentReferences} value={replace(copy.linksCount, { count: (campaign.reference_links ?? []).length })} />
        </div>
      </section>
    </div>
  );
}

function CampaignOpportunityNav({
  campaignId,
  pendingCount,
  active,
  copy,
}: {
  campaignId: string;
  pendingCount: number;
  active: "opportunity" | "participants" | "applications";
  copy: Copy;
}) {
  const items = [
    { key: "opportunity" as const, href: `/dashboard/campaigns/${campaignId}/applications`, label: copy.nav.opportunity, icon: "campaigns" as const },
    { key: "participants" as const, href: `/dashboard/campaigns/${campaignId}#campaign-participants`, label: copy.nav.participants, icon: "users" as const },
    { key: "applications" as const, href: `/dashboard/campaigns/${campaignId}/applications/review`, label: copy.nav.applications, icon: "bell" as const },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-3">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`relative inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black shadow-sm transition ${
              isActive
                ? "border-[#8F62A7] bg-[#8F62A7] text-white"
                : "border-[#E5D8EB] bg-white text-[#6D4E82] hover:-translate-y-0.5 hover:bg-[#FBF8FD] hover:shadow-md"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? "bg-white/15" : "bg-[#F4EEFA] text-[#79588F]"}`}>
              <DashboardIcon name={item.icon} className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
            {item.key === "applications" && pendingCount > 0 ? <CountBadge count={pendingCount} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function CountBadge({ count }: { count: number }) {
  const label = count > 5 ? "5+" : String(count);
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-5 text-white shadow-sm">
      {label}
    </span>
  );
}

const input = "h-12 w-full rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] px-4 text-sm font-bold outline-none focus:border-[#A170BA]";
const textarea = `${input} min-h-28 py-3`;
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}</span>{children}</label>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">{children}</div>; }
function ErrorNotice({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">{children}</div>; }
function Preview({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4"><p className="text-xs font-black text-[#705B7A]">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#66536E]">{value}</p></div>; }
function toLocal(value: string | null) { if (!value) return ""; const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""; return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`; }
function errorText(code: string, copy: Copy) { return (copy.errors as Record<string, string>)[code] ?? copy.errors.default; }
function replace(template: string, values: Record<string, string | number>) { return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`)); }
