import Link from "next/link";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { DashboardEmpty, DashboardPanel, DashboardStatCard } from "@/components/dashboard/dashboard-widgets";

export const dynamic = "force-dynamic";

type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";
type CampaignRow = { id: string; name: string; brand: string | null; status: CampaignStatus; budget: number | null; start_date: string | null };
type InfluencerRow = { id: string; full_name: string; city: string | null; profile_completion: number | null; created_at: string };
type PaymentRow = { amount: number | null; status: string };

export default async function DashboardPage() {
  const { profile, supabase } = await requirePermission("dashboard", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const d = dictionary.dashboard;

  const [campaignsResult, influencerCountResult, recentInfluencersResult, contentCountResult, accessCountResult, paymentsResult] = await Promise.all([
    supabase.from("campaigns").select("id,name,brand,status,budget,start_date").order("created_at", { ascending: false }),
    supabase.from("influencers").select("id", { count: "exact", head: true }),
    supabase.from("influencers").select("id,full_name,city,profile_completion,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("content_items").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("portal_access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("amount,status").in("status", ["awaiting_approval", "ready_for_finance", "partially_paid"]),
  ]);

  const campaigns = (campaignsResult.data ?? []) as CampaignRow[];
  const recentCampaigns = campaigns.slice(0, 5);
  const recentInfluencers = (recentInfluencersResult.data ?? []) as InfluencerRow[];
  const pendingPayments = ((paymentsResult.data ?? []) as PaymentRow[]).reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
  const totalCampaigns = campaigns.filter((campaign) => campaign.status !== "archived").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const statusCounts = campaigns.reduce<Record<CampaignStatus, number>>((accumulator, campaign) => {
    accumulator[campaign.status] += 1;
    return accumulator;
  }, { draft: 0, active: 0, paused: 0, completed: 0, archived: 0 });
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts));
  const canCreateCampaign = hasPermission(profile.role, "campaigns", "create");

  return (
    <main className="mx-auto w-full max-w-[1540px] space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(125deg,#A978C3_0%,#566AC4_55%,#8795DF_100%)] px-5 py-6 text-white shadow-[0_24px_65px_rgba(72,88,170,0.25)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/12" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-white/6 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-white/88"><DashboardIcon name="sparkles" className="h-4 w-4" />{dictionary.header.welcome} {profile.full_name}</span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">{d.title}</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-white/72">{d.subtitle}</p>
          </div>
          {canCreateCampaign ? <Link href="/dashboard/campaigns/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#5265BA] shadow-[0_12px_30px_rgba(32,46,119,0.18)] transition hover:-translate-y-0.5 hover:bg-[#F9FAFF]"><DashboardIcon name="plus" className="h-5 w-5" />{d.newCampaign}</Link> : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label={d.totalCampaigns} value={totalCampaigns} helper={`${activeCampaigns} ${d.active}`} icon="campaigns" accent="blue" />
        <DashboardStatCard label={d.activeCampaigns} value={activeCampaigns} helper={`${statusCounts.draft} ${d.draft}`} icon="dashboard" accent="green" />
        <DashboardStatCard label={d.totalInfluencers} value={influencerCountResult.count ?? 0} icon="influencers" accent="violet" />
        <DashboardStatCard label={d.pendingPayments} value={formatMoney(pendingPayments, locale)} helper={`${(paymentsResult.data ?? []).length} ${d.financeQueue}`} icon="wallet" accent="gold" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <DashboardPanel title={d.campaignPerformance} actionHref="/dashboard/campaigns" actionLabel={dictionary.common.viewAll}>
          <div className="relative h-56 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#FDFBFE,#F6F8FE)] p-4">
            <div className="absolute inset-x-4 top-1/4 border-t border-dashed border-[#ECE1F1]"/><div className="absolute inset-x-4 top-1/2 border-t border-dashed border-[#ECE1F1]"/><div className="absolute inset-x-4 top-3/4 border-t border-dashed border-[#ECE1F1]"/>
            <svg viewBox="0 0 700 190" className="relative h-full w-full" preserveAspectRatio="none" aria-label={d.campaignsTrend}>
              <defs><linearGradient id="dashboardArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#A978C3" stopOpacity=".28"/><stop offset="100%" stopColor="#A978C3" stopOpacity="0"/></linearGradient></defs>
              <path d="M0 155 C65 150 85 128 145 136 C205 144 225 92 285 103 C345 114 376 68 435 75 C505 83 536 38 595 50 C645 60 665 30 700 24 L700 190 L0 190 Z" fill="url(#dashboardArea)"/>
              <path d="M0 155 C65 150 85 128 145 136 C205 144 225 92 285 103 C345 114 376 68 435 75 C505 83 536 38 595 50 C645 60 665 30 700 24" fill="none" stroke="#9566AF" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-bold text-[#A79AAA]"><span>{d.draft}</span><span>{d.active}</span><span>{d.completed}</span></div>
          </div>
        </DashboardPanel>

        <DashboardPanel title={d.campaignDistribution}>
          <div className="grid items-center gap-5 sm:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: buildConicGradient(statusCounts) }}>
              <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white shadow-inner"><strong className="text-2xl font-black text-[#4A315C]">{totalCampaigns}</strong><span className="text-[10px] font-bold text-[#95849D]">{d.totalCampaigns}</span></div>
            </div>
            <div className="space-y-3">
              {(["active", "draft", "paused", "completed"] as const).map((status) => <StatusRow key={status} label={d[status]} value={statusCounts[status]} max={maxStatusCount} status={status}/>) }
            </div>
          </div>
        </DashboardPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr_0.9fr]">
        <DashboardPanel title={d.recentCampaigns} actionHref="/dashboard/campaigns" actionLabel={dictionary.common.viewAll}>
          {recentCampaigns.length ? <div className="space-y-2.5">{recentCampaigns.map((campaign) => <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`} className="flex items-center gap-3 rounded-2xl border border-transparent bg-[#FCFAFD] p-3 transition hover:border-[#E8D9EE] hover:bg-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F0FA] text-[#8B56BD]"><DashboardIcon name="campaigns" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#3A4A7E]">{campaign.name}</p><p className="mt-1 truncate text-[11px] font-bold text-[#94889A]">{campaign.brand || "—"} · {formatDate(campaign.start_date, locale)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass(campaign.status)}`}>{d[campaign.status]}</span></Link>)}</div> : <DashboardEmpty text={d.noCampaigns}/>} 
        </DashboardPanel>

        <DashboardPanel title={d.recentInfluencers} actionHref="/dashboard/influencers" actionLabel={dictionary.common.viewAll}>
          {recentInfluencers.length ? <div className="space-y-3">{recentInfluencers.map((influencer) => { const percentage = Math.max(0, Math.min(100, Number(influencer.profile_completion ?? 0))); return <div key={influencer.id} className="rounded-2xl bg-[#FCFAFD] p-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#EBDDF2,#D8BDE3)] text-xs font-black text-[#7D4D98]">{initials(influencer.full_name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#3A4A7E]">{influencer.full_name}</p><p className="mt-0.5 text-[11px] font-bold text-[#94889A]">{influencer.city || "—"}</p></div><span className="text-xs font-black text-[#8D5AA8]">{percentage}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEE2F2]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#A978C3,#CAA1D5)]" style={{ width: `${percentage}%` }}/></div></div>;})}</div> : <DashboardEmpty text={d.noInfluencers}/>} 
        </DashboardPanel>

        <DashboardPanel title={d.workQueue}>
          <div className="space-y-3">
            <QueueItem href="/dashboard/content" disabled label={d.contentReviews} value={contentCountResult.count ?? 0} icon="content" color="blue" />
            <QueueItem href="/dashboard/access-requests" label={d.accessRequests} value={accessCountResult.count ?? 0} icon="access" color="gold" />
            <QueueItem href="/dashboard/payments" disabled label={d.financeQueue} value={(paymentsResult.data ?? []).length} icon="payments" color="green" />
          </div>
        </DashboardPanel>
      </section>
    </main>
  );
}

function QueueItem({ href, label, value, icon, color, disabled = false }: { href: string; label: string; value: number; icon: "content" | "access" | "payments"; color: "blue" | "gold" | "green"; disabled?: boolean }) {
  const tone = { blue: "bg-[#F7F0FA] text-[#8D5AA8]", gold: "bg-[#FFF3D5] text-[#A8750D]", green: "bg-[#E9F8EF] text-[#2E7B50]" }[color];
  const content = <><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><DashboardIcon name={icon} className="h-5 w-5" /></span><span className="min-w-0 flex-1 text-sm font-extrabold text-[#5F466C]">{label}</span><strong className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#F0F2FA] px-2 text-xs font-black text-[#8D5AA8]">{value}</strong></>;
  const classes = `flex items-center gap-3 rounded-2xl border border-[#F6EFF9] bg-[#FEFCFF] p-3 transition ${disabled ? "cursor-default opacity-72" : "hover:border-[#E7DDEF] hover:bg-white"}`;
  return disabled ? <div className={classes}>{content}</div> : <Link href={href} className={classes}>{content}</Link>;
}

function StatusRow({ label, value, max, status }: { label: string; value: number; max: number; status: CampaignStatus }) {
  const colors: Record<CampaignStatus, string> = { active: "bg-[#A978C3]", draft: "bg-[#D8BDE3]", paused: "bg-[#F4C55F]", completed: "bg-[#75C69B]", archived: "bg-[#C9CEDD]" };
  return <div><div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[#76809F]"><span>{label}</span><span>{value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#EBEEF7]"><div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${Math.max(value ? 8 : 0, value / max * 100)}%` }}/></div></div>;
}

function buildConicGradient(counts: Record<CampaignStatus, number>) {
  const values = [counts.active, counts.draft, counts.paused, counts.completed, counts.archived];
  const colors = ["#A978C3", "#D8BDE3", "#F4C55F", "#75C69B", "#C9CEDD"];
  const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
  let cursor = 0;
  const stops = values.map((value, index) => { const start = cursor; cursor += value / total * 100; return `${colors[index]} ${start}% ${cursor}%`; });
  return `conic-gradient(${stops.join(",")})`;
}
function formatMoney(value: number, locale: "ar" | "en") { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) + " " + (locale === "ar" ? "ر.س" : "SAR"); }
function formatDate(value: string | null, locale: "ar" | "en") { if (!value) return "—"; return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function statusClass(status: CampaignStatus) { return { draft: "bg-slate-100 text-slate-600", active: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", completed: "bg-[#F7F0FA] text-[#8D5AA8]", archived: "bg-[#F1F2F5] text-[#7E8495]" }[status]; }
