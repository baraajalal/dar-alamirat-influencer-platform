import { cookies } from "next/headers";
import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/icons";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const [{ profile, supabase }, cookieStore] = await Promise.all([requirePermission("brands", "view"), cookies()]);
  const locale = normalizeDashboardLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const dictionary = getDashboardDictionary(locale);
  const copy = dictionary.brands;
  const canManage = hasPermission(profile.role, "brands", "manage");

  const [brandsResult, campaignsResult, teamsResult] = await Promise.all([
    supabase.from("brands").select("id,name_ar,name_en,slug,logo_url,primary_color,secondary_color,whatsapp_number,contact_email,default_exclusivity_scope,default_exclusivity_days,default_exclusivity_start_basis,is_active,primary_contact_id").order("is_active",{ascending:false}).order("name_en"),
    supabase.from("campaigns").select("brand_id").not("brand_id","is",null),
    supabase.from("brand_team_members").select("brand_id,profile_id"),
  ]);
  if (brandsResult.error) throw new Error(brandsResult.error.message);
  if (campaignsResult.error) throw new Error(campaignsResult.error.message);
  if (teamsResult.error) throw new Error(teamsResult.error.message);
  const campaignCounts = new Map<string, number>();
  for (const row of campaignsResult.data ?? []) if (row.brand_id) campaignCounts.set(row.brand_id,(campaignCounts.get(row.brand_id)??0)+1);
  const teamCounts = new Map<string, number>();
  for (const row of teamsResult.data ?? []) teamCounts.set(row.brand_id,(teamCounts.get(row.brand_id)??0)+1);

  return <main className="space-y-6">
    <section className="flex flex-col gap-4 rounded-[30px] bg-[linear-gradient(135deg,#6F4B82,#A170BA)] p-6 text-white shadow-[0_20px_60px_rgba(89,55,105,.18)] md:flex-row md:items-center md:justify-between">
      <div><p className="text-sm font-black text-white/70">{dictionary.brand.system}</p><h1 className="mt-2 text-2xl font-black">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">{copy.subtitle}</p></div>
      {canManage ? <Link href="/dashboard/brands/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#624070]"><DashboardIcon name="plus" className="h-4 w-4"/>{copy.new}</Link> : null}
    </section>

    {(brandsResult.data ?? []).length ? <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {(brandsResult.data ?? []).map((brand) => <article key={brand.id} className="overflow-hidden rounded-[28px] border border-[#EEE4F2] bg-white shadow-[0_14px_40px_rgba(69,48,83,.06)]">
        <div className="h-2" style={{background: brand.primary_color || "#C7A9D0"}} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#EEE4F2] bg-[#FCF9FD]">
              {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-full w-full object-contain p-2"/> : <span className="text-xl font-black text-[#9467AA]">{(locale === "ar" ? brand.name_ar : brand.name_en).slice(0,2)}</span>}
            </div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-black text-[#432A57]">{locale === "ar" ? brand.name_ar : brand.name_en}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${brand.is_active?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{brand.is_active?copy.active:copy.inactive}</span></div><p dir="ltr" className="mt-1 text-start text-xs font-bold text-[#9B8DA1]">{brand.slug}</p></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label={copy.campaigns} value={String(campaignCounts.get(brand.id)??0)}/><Metric label={copy.team} value={String(teamCounts.get(brand.id)??0)}/><Metric label={copy.exclusivity} value={brand.default_exclusivity_scope === "none" ? copy.scopes.none : `${brand.default_exclusivity_days} ${locale === "ar" ? "يوم" : "days"}`}/>
          </div>
          <div className="mt-4 rounded-2xl bg-[#FCF9FD] p-4 text-xs font-bold leading-6 text-[#75667C]"><p>{brand.whatsapp_number || brand.contact_email || "—"}</p><p className="mt-1">{copy.scopes[brand.default_exclusivity_scope as keyof typeof copy.scopes] ?? brand.default_exclusivity_scope}</p></div>
          <Link href={`/dashboard/brands/${brand.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[#E9DDEF] bg-white px-4 py-3 text-sm font-black text-[#6B4C79] hover:bg-[#FCF9FD]">{copy.view}</Link>
        </div>
      </article>)}
    </section> : <div className="rounded-[28px] border border-dashed border-[#EADFF0] bg-white/75 px-4 py-16 text-center text-sm font-bold text-[#8C7B94]">{copy.noBrands}</div>}
  </main>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-[#F9F5FB] p-3 text-center"><p className="text-[10px] font-bold text-[#9C8CA4]">{label}</p><p className="mt-1 text-sm font-black text-[#5B4168]">{value}</p></div>}
