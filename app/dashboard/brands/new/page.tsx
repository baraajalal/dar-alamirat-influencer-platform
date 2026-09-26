import { cookies } from "next/headers";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-user";
import { getDashboardDictionary, normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { BrandForm } from "../brand-form";

export const dynamic="force-dynamic";
export default async function NewBrandPage({searchParams}:{searchParams?:Promise<{error?:string}>}){
  const query=(await searchParams)??{};
  const [{supabase},cookieStore]=await Promise.all([requirePermission("brands","create"),cookies()]);
  const locale=normalizeDashboardLocale(cookieStore.get("app_locale")?.value??cookieStore.get("dashboard_locale")?.value);
  const dictionary=getDashboardDictionary(locale); const copy=dictionary.brands;
  const [staffResult,brandsResult]=await Promise.all([
    supabase.from("profiles").select("id,full_name,role").eq("is_active",true).neq("role","influencer").order("full_name"),
    supabase.from("brands").select("id,name_ar,name_en,is_active").order("name_en"),
  ]);
  if(staffResult.error) throw new Error(staffResult.error.message);
  if(brandsResult.error) throw new Error(brandsResult.error.message);
  return <main className="space-y-6"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-[#9A7FA4]">{copy.title}</p><h1 className="mt-1 text-2xl font-black text-[#432A57]">{copy.new}</h1></div><Link href="/dashboard/brands" className="rounded-2xl border border-[#E9DDEF] bg-white px-4 py-3 text-sm font-black text-[#6B4C79]">{copy.back}</Link></div>{query.error?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{query.error==="duplicate_slug"?copy.duplicateSlug:query.error==="validation"?copy.validation:copy.saveFailed}</div>:null}<BrandForm locale={locale} dictionary={dictionary} staff={staffResult.data??[]} brands={brandsResult.data??[]} /></main>;
}
