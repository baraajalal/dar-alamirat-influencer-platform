import { cookies } from "next/headers";
import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/icons";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-user";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { getCampaignCopy, type CampaignLocale } from "./campaign-copy";
import {
  CampaignPageHeader,
  CampaignPanel,
  EmptyCampaignState,
  MetricCard,
  StatusBadge,
} from "./campaign-ui";

export const dynamic = "force-dynamic";

type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

type CampaignRow = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  campaign_type: string | null;
  start_date: string | null;
  end_date: string | null;
  publishing_date: string | null;
  budget: number | null;
  status: CampaignStatus;
  manager_id: string | null;
  created_at: string;
};

type AssignmentRow = {
  campaign_id: string;
  status: string;
  agreed_amount: number | null;
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; created?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("campaigns", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value) as CampaignLocale;
  const copy = getCampaignCopy(locale);

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id,name,brand,product,campaign_type,start_date,end_date,publishing_date,budget,status,manager_id,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const managerIds = Array.from(
    new Set(campaignRows.map((campaign) => campaign.manager_id).filter(Boolean)),
  ) as string[];

  const [{ data: assignments }, { data: managers }] = await Promise.all([
    campaignIds.length
      ? supabase
          .from("campaign_assignments")
          .select("campaign_id,status,agreed_amount")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as AssignmentRow[] }),
    managerIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", managerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const managerMap = new Map<string, string>(
    ((managers ?? []) as Array<{ id: string; full_name: string }>).map((manager) => [manager.id, manager.full_name]),
  );
  const assignmentCounts = new Map<string, number>();
  const completedAssignmentCounts = new Map<string, number>();
  const committedByCampaign = new Map<string, number>();

  for (const assignment of (assignments ?? []) as AssignmentRow[]) {
    assignmentCounts.set(assignment.campaign_id, (assignmentCounts.get(assignment.campaign_id) ?? 0) + 1);
    if (["paid", "closed"].includes(assignment.status)) {
      completedAssignmentCounts.set(
        assignment.campaign_id,
        (completedAssignmentCounts.get(assignment.campaign_id) ?? 0) + 1,
      );
    }
    if (!["rejected", "cancelled"].includes(assignment.status)) {
      committedByCampaign.set(
        assignment.campaign_id,
        (committedByCampaign.get(assignment.campaign_id) ?? 0) + Number(assignment.agreed_amount ?? 0),
      );
    }
  }

  const searchQuery = (params.q ?? "").trim().toLowerCase();
  const requestedStatus = params.status as CampaignStatus | undefined;
  const filtered = campaignRows.filter((campaign) => {
    const matchesQuery =
      !searchQuery ||
      [campaign.name, campaign.brand, campaign.product, campaign.campaign_type]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(searchQuery));
    const matchesStatus = !requestedStatus || campaign.status === requestedStatus;
    return matchesQuery && matchesStatus;
  });

  const totalBudget = campaignRows.reduce((sum, campaign) => sum + Number(campaign.budget ?? 0), 0);
  const canCreate = hasPermission(profile.role, "campaigns", "create");
  const statusLabel = (status: CampaignStatus) => copy.statuses[status];

  return (
    <div dir={copy.direction} className="space-y-6">
      <CampaignPageHeader
        eyebrow={copy.common.campaigns}
        title={copy.list.title}
        description={copy.list.subtitle}
        actionHref={canCreate ? "/dashboard/campaigns/new" : undefined}
        actionLabel={canCreate ? copy.list.newCampaign : undefined}
      />

      {params.created === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">
          {copy.list.createdSuccess}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={copy.list.total} value={campaignRows.length} icon="campaigns" />
        <MetricCard label={copy.list.active} value={campaignRows.filter((item) => item.status === "active").length} icon="sparkles" accent="green" />
        <MetricCard label={copy.list.draft} value={campaignRows.filter((item) => item.status === "draft").length} icon="content" accent="violet" />
        <MetricCard label={copy.list.completed} value={campaignRows.filter((item) => item.status === "completed").length} icon="reports" accent="gold" />
        <MetricCard label={copy.list.totalBudget} value={formatMoney(totalBudget, locale)} icon="wallet" />
      </section>

      <CampaignPanel>
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
          <label className="relative">
            <DashboardIcon name="campaigns" className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8792BF]" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={copy.list.searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-[#DDE2F3] bg-[#FAFBFF] px-12 text-sm font-bold text-[#405080] outline-none transition placeholder:text-[#A1A8BC] focus:border-[#6877C8] focus:bg-white focus:ring-4 focus:ring-[#6877C8]/10"
            />
          </label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            aria-label={copy.list.filterStatus}
            className="h-12 rounded-2xl border border-[#DDE2F3] bg-[#FAFBFF] px-4 text-sm font-bold text-[#56628D] outline-none focus:border-[#6877C8] focus:bg-white focus:ring-4 focus:ring-[#6877C8]/10"
          >
            <option value="">{copy.list.allStatuses}</option>
            {(Object.keys(copy.statuses) as CampaignStatus[]).map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
          <button className="h-12 rounded-2xl bg-[#6877C8] px-6 text-sm font-black text-white transition hover:bg-[#586AC1]">
            {copy.common.search}
          </button>
        </form>
      </CampaignPanel>

      <CampaignPanel title={`${copy.list.campaign} (${filtered.length})`}>
        {filtered.length === 0 ? (
          <EmptyCampaignState text={copy.list.noCampaigns} />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1050px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-xs font-black text-[#929AAF]">
                    <Th>{copy.list.campaign}</Th>
                    <Th>{copy.list.manager}</Th>
                    <Th>{copy.list.dates}</Th>
                    <Th>{copy.list.influencers}</Th>
                    <Th>{copy.list.progress}</Th>
                    <Th>{copy.list.budget}</Th>
                    <Th>{copy.list.status}</Th>
                    <Th>{copy.list.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((campaign) => {
                    const count = assignmentCounts.get(campaign.id) ?? 0;
                    const completed = completedAssignmentCounts.get(campaign.id) ?? 0;
                    const progress = count ? Math.round((completed / count) * 100) : 0;
                    const committed = committedByCampaign.get(campaign.id) ?? 0;
                    return (
                      <tr key={campaign.id} className="group bg-[#FAFBFF] transition hover:bg-[#F6F8FF]">
                        <Td first>
                          <div className="min-w-52">
                            <Link href={`/dashboard/campaigns/${campaign.id}`} className="font-black text-[#34457E] hover:text-[#586AC1]">
                              {campaign.name}
                            </Link>
                            <p className="mt-1 text-xs font-semibold text-[#929AAF]">
                              {[campaign.brand, campaign.product].filter(Boolean).join(" · ") || copy.common.unspecified}
                            </p>
                          </div>
                        </Td>
                        <Td>{campaign.manager_id ? managerMap.get(campaign.manager_id) ?? copy.common.unspecified : copy.common.unspecified}</Td>
                        <Td>
                          <p className="font-bold text-[#5F6B90]">{formatDate(campaign.start_date, locale)}</p>
                          <p className="mt-1 text-xs text-[#9AA1B5]">{formatDate(campaign.end_date, locale)}</p>
                        </Td>
                        <Td><span className="font-black text-[#465483]">{count}</span></Td>
                        <Td>
                          <div className="min-w-28">
                            <div className="mb-1 flex items-center justify-between text-[11px] font-black text-[#7781A0]"><span>{progress}%</span><span>{completed}/{count}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#E8EBF5]"><div className="h-full rounded-full bg-gradient-to-r from-[#6877C8] to-[#9CAAE4]" style={{ width: `${progress}%` }} /></div>
                          </div>
                        </Td>
                        <Td>
                          <p className="font-black text-[#465483]">{formatMoney(campaign.budget, locale)}</p>
                          <p className="mt-1 text-[11px] text-[#9AA1B5]">{formatMoney(committed, locale)}</p>
                        </Td>
                        <Td><StatusBadge status={campaign.status} label={statusLabel(campaign.status)} /></Td>
                        <Td last>
                          <Link href={`/dashboard/campaigns/${campaign.id}`} className="inline-flex rounded-xl border border-[#DDE2F3] bg-white px-3 py-2 text-xs font-black text-[#5D6EC3] transition hover:border-[#A9B9E6] hover:bg-[#F4F6FF]">
                            {copy.common.view}
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 xl:hidden">
              {filtered.map((campaign) => {
                const count = assignmentCounts.get(campaign.id) ?? 0;
                const completed = completedAssignmentCounts.get(campaign.id) ?? 0;
                const progress = count ? Math.round((completed / count) * 100) : 0;
                return (
                  <article key={campaign.id} className="rounded-[22px] border border-[#E5E8F3] bg-[#FAFBFF] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/dashboard/campaigns/${campaign.id}`} className="font-black text-[#34457E]">{campaign.name}</Link>
                        <p className="mt-1 text-xs font-semibold text-[#929AAF]">{campaign.brand || copy.common.unspecified}</p>
                      </div>
                      <StatusBadge status={campaign.status} label={statusLabel(campaign.status)} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <Mini label={copy.list.influencers} value={`${count}`} />
                      <Mini label={copy.list.budget} value={formatMoney(campaign.budget, locale)} />
                      <Mini label={copy.list.manager} value={campaign.manager_id ? managerMap.get(campaign.manager_id) ?? copy.common.unspecified : copy.common.unspecified} />
                      <Mini label={copy.list.dates} value={formatDate(campaign.start_date, locale)} />
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-[11px] font-black text-[#7C86A4]"><span>{copy.list.progress}</span><span>{progress}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E7EAF4]"><div className="h-full rounded-full bg-[#6877C8]" style={{ width: `${progress}%` }} /></div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </CampaignPanel>
    </div>
  );
}

function formatDate(value: string | null, locale: CampaignLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function formatMoney(value: number | null | undefined, locale: CampaignLocale) {
  if (value === null || value === undefined) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start">{children}</th>;
}

function Td({ children, first = false, last = false }: { children: React.ReactNode; first?: boolean; last?: boolean }) {
  return <td className={`px-4 py-4 align-middle text-[#66708F] ${first ? "rounded-s-2xl" : ""} ${last ? "rounded-e-2xl" : ""}`}>{children}</td>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold text-[#99A0B4]">{label}</p><p className="mt-1 truncate font-black text-[#4D5A86]">{value}</p></div>;
}
