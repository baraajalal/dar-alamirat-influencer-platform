import Link from "next/link";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { DashboardIcon } from "@/components/dashboard/icons";
import { importWorkHistory } from "./actions";

export const dynamic = "force-dynamic";

export default async function WorkArchivePage({ searchParams }: { searchParams?: Promise<{ batch?: string; imported?: string; error?: string }> }) {
  const params = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("influencers", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const c = dictionary.workHistory;
  const canImport = hasPermission(profile.role, "influencers", "update");
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA", { dateStyle: "medium", timeStyle: "short" });

  const { data: batches } = await supabase.from("work_history_import_batches")
    .select("id,file_name,total_rows,inserted_count,merged_count,unmatched_count,invalid_count,status,imported_by,created_at,completed_at")
    .order("created_at", { ascending: false }).limit(20);
  const importerIds = Array.from(new Set((batches ?? []).map((item) => item.imported_by).filter(Boolean) as string[]));
  const { data: profiles } = importerIds.length ? await supabase.from("profiles").select("id,full_name").in("id", importerIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item.full_name]));

  const selectedId = params.batch || batches?.[0]?.id;
  const { data: issues } = selectedId ? await supabase.from("work_history_import_issues")
    .select("id,row_number,mobile,campaign_name,issue_type,message")
    .eq("batch_id", selectedId).order("row_number", { ascending: true }).limit(200) : { data: [] };

  const errorMessage = params.error === "file_required" ? c.fileRequired : params.error ? c.importFailed : null;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link href="/dashboard/influencers" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#6071C3]"><DashboardIcon name="arrow" className="h-4 w-4" />{c.back}</Link>
          <h2 className="mt-3 text-2xl font-black text-[#3D274F] sm:text-3xl">{c.importTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-[#8B94AD]">{c.importSubtitle}</p>
          <p className="mt-2 text-xs font-black text-[#9A6AAE]">{c.staffOnly}</p>
        </div>
      </section>

      {params.imported ? <Notice tone="success" text={c.importCompleted} /> : null}
      {errorMessage ? <Notice tone="error" text={errorMessage} /> : null}

      {canImport ? (
        <section className="rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
          <form action={importWorkHistory} className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block"><span className="mb-2 block text-xs font-black text-[#66739D]">{c.chooseFile}</span><input name="file" type="file" accept=".xlsx,.xls,.csv" required className="block w-full rounded-2xl border border-[#E3E7F4] bg-[#FCFAFD] p-3 text-sm font-bold text-[#53618D]" /><span className="mt-2 block text-xs font-semibold leading-6 text-[#939BB1]">{c.importHint}</span></label>
            <button className="rounded-2xl bg-[#8C5BA5] px-6 py-3.5 text-sm font-black text-white shadow-lg">{c.importAction}</button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        <h3 className="text-lg font-black text-[#432A57]">{c.batches}</h3>
        {(batches ?? []).length ? <div className="mt-5 space-y-3">{(batches ?? []).map((batch) => (
          <Link key={batch.id} href={`/dashboard/influencers/archive?batch=${batch.id}`} className={`block rounded-2xl border p-4 transition ${selectedId === batch.id ? "border-[#B98BC8] bg-[#FCF8FD]" : "border-[#EEF0F6] bg-[#FDFBFE] hover:border-[#DCCBE4]"}`}>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div><p className="font-black text-[#432A57]">{batch.file_name}</p><p className="mt-1 text-xs font-bold text-[#9299AE]">{date.format(new Date(batch.created_at))} · {profileMap.get(batch.imported_by) ?? "—"}</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Metric label={c.rows} value={batch.total_rows} /><Metric label={c.inserted} value={batch.inserted_count} /><Metric label={c.merged} value={batch.merged_count} /><Metric label={c.unmatched} value={batch.unmatched_count} warn /><Metric label={c.invalid} value={batch.invalid_count} warn />
              </div>
            </div>
          </Link>
        ))}</div> : <p className="mt-5 text-sm font-bold text-[#9AA1B4]">{c.noBatches}</p>}
      </section>

      {selectedId ? <section className="rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_55px_rgba(69,83,151,.08)]">
        <h3 className="text-lg font-black text-[#432A57]">{c.issues}</h3>
        {(issues ?? []).length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-[#FAF6FC] text-[#66739D]"><th className="p-3 text-start">{c.row}</th><th className="p-3 text-start">{c.mobile}</th><th className="p-3 text-start">{c.fields.campaign}</th><th className="p-3 text-start">{c.issue}</th></tr></thead><tbody>{(issues ?? []).map((issue) => <tr key={issue.id} className="border-t border-[#EEF1F8]"><td className="p-3 font-bold">{issue.row_number ?? "—"}</td><td dir="ltr" className="p-3 text-start font-bold">{issue.mobile ?? "—"}</td><td className="p-3 font-bold">{issue.campaign_name ?? "—"}</td><td className="p-3 font-bold text-amber-700">{issue.issue_type === "unmatched_influencer" ? c.unmatchedInfluencer : c.invalidRow}</td></tr>)}</tbody></table></div> : <p className="mt-5 text-sm font-bold text-emerald-700">{c.noIssues}</p>}
      </section> : null}
    </main>
  );
}

function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) { return <div className={`rounded-xl px-3 py-2 text-center ${warn && value ? "bg-amber-50 text-amber-800" : "bg-[#F7F0FA] text-[#5A68A8]"}`}><p className="text-[10px] font-extrabold opacity-70">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-2xl border p-4 text-sm font-black ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{text}</div>; }
