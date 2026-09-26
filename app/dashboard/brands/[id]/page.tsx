import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { BrandForm } from "../brand-form";

export const dynamic="force-dynamic";
export default async function BrandDetailsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;saved?:string}>}){
  const {id}=await params; const query=(await searchParams)??{};
  const [{supabase},cookieStore]=await Promise.all([requirePermission("brands","view"),cookies()]);
  const locale=normalizeDashboardLocale(cookieStore.get("app_locale")?.value??cookieStore.get("dashboard_locale")?.value);
  const dictionary=getDashboardDictionary(locale); const copy=dictionary.brands;
  const [brandResult,staffResult,brandsResult,teamResult,blockedResult,campaignResult]=await Promise.all([
    supabase.from("brands").select("id,name_ar,name_en,slug,logo_url,primary_color,secondary_color,whatsapp_number,contact_email,primary_contact_id,default_exclusivity_scope,default_exclusivity_days,default_exclusivity_start_basis,is_active").eq("id",id).maybeSingle(),
    supabase.from("profiles").select("id,full_name,role").eq("is_active",true).neq("role","influencer").order("full_name"),
    supabase.from("brands").select("id,name_ar,name_en,is_active").order("name_en"),
    supabase.from("brand_team_members").select("profile_id").eq("brand_id",id),
    supabase.from("brand_exclusivity_targets").select("blocked_brand_id").eq("brand_id",id),
    supabase.from("campaigns").select("id,name,status,start_date").eq("brand_id",id).order("created_at",{ascending:false}).limit(8),
  ]);
  for (const result of [brandResult,staffResult,brandsResult,teamResult,blockedResult,campaignResult]) { if(result.error) throw new Error(result.error.message); }
  if(!brandResult.data) notFound();
  return <main className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-[#9A7FA4]">{copy.title}</p><h1 className="mt-1 text-2xl font-black text-[#432A57]">{locale==="ar"?brandResult.data.name_ar:brandResult.data.name_en}</h1></div><Link href="/dashboard/brands" className="rounded-2xl border border-[#E9DDEF] bg-white px-4 py-3 text-sm font-black text-[#6B4C79]">{copy.back}</Link></div>{query.saved?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">{copy.updated}</div>:null}{query.error?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{query.error==="duplicate_slug"?copy.duplicateSlug:query.error==="validation"?copy.validation:copy.saveFailed}</div>:null}<BrandForm locale={locale} dictionary={dictionary} staff={staffResult.data??[]} brands={brandsResult.data??[]} value={brandResult.data} selectedTeam={(teamResult.data??[]).map(x=>x.profile_id)} selectedBlocked={(blockedResult.data??[]).map(x=>x.blocked_brand_id)} />
  <section className="rounded-[28px] border border-[#EEE4F2] bg-white p-6"><h2 className="text-lg font-black text-[#432A57]">{copy.campaigns}</h2><div className="mt-4 space-y-2">{(campaignResult.data??[]).length?(campaignResult.data??[]).map(c=><Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="flex items-center justify-between rounded-2xl bg-[#FCF9FD] p-4"><span className="font-black text-[#513865]">{c.name}</span><span className="text-xs font-bold text-[#93869A]">{copy.campaignStatuses[c.status as keyof typeof copy.campaignStatuses] ?? c.status}</span></Link>):<p className="text-sm font-semibold text-[#93869A]">{dictionary.common.noData}</p>}</div></section></main>;
}
