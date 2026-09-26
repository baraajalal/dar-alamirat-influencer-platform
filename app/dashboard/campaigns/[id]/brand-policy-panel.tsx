import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { updateCampaignBrandPolicy } from "./brand-policy-actions";

type Brand = { id:string; name_ar:string; name_en:string; logo_url:string|null; primary_color:string|null; whatsapp_number:string|null; contact_email:string|null; default_exclusivity_scope:string; default_exclusivity_days:number; default_exclusivity_start_basis:string; primary_contact_name?:string|null };

type CampaignPolicy = { brand_id:string|null; exclusivity_scope:string|null; exclusivity_days:number|null; exclusivity_start_basis:string|null };

export function CampaignBrandPolicyPanel({locale,dictionary,campaignId,campaign,brands,blockedBrandIds,canManage}:{locale:DashboardLocale;dictionary:DashboardDictionary;campaignId:string;campaign:CampaignPolicy;brands:Brand[];blockedBrandIds:string[];canManage:boolean}){
  const ex=dictionary.exclusivity; const bm=dictionary.brands;
  const current=brands.find(b=>b.id===campaign.brand_id)??null;
  const scope=campaign.exclusivity_scope??"inherit";
  const resolvedScope=campaign.exclusivity_scope??current?.default_exclusivity_scope??"none";
  const resolvedDays=resolvedScope==="none"?0:(campaign.exclusivity_days??current?.default_exclusivity_days??45);
  const resolvedStart=campaign.exclusivity_start_basis??current?.default_exclusivity_start_basis??"publishing_date";
  const blockedSet=new Set(blockedBrandIds);
  return <section className="rounded-[28px] border border-[#EEE4F2] bg-white p-6 shadow-[0_14px_40px_rgba(69,48,83,.05)]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[#432A57]">{ex.campaignPolicy}</h2><p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-[#8A92AA]">{ex.campaignPolicyHint}</p></div>{current?<div className="flex items-center gap-3 rounded-2xl bg-[#FCF9FD] p-3">{current.logo_url?<img src={current.logo_url} alt="" className="h-10 w-10 rounded-xl object-contain"/>:<span className="h-10 w-10 rounded-xl" style={{background:current.primary_color||"#C7A9D0"}}/>}<div><p className="text-sm font-black text-[#513865]">{locale==="ar"?current.name_ar:current.name_en}</p><p className="text-[11px] font-bold text-[#95849D]">{current.whatsapp_number||current.contact_email||"—"}</p></div></div>:null}</div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label={ex.scope} value={bm.scopes[resolvedScope as keyof typeof bm.scopes]??resolvedScope}/><Mini label={ex.days} value={`${resolvedDays} ${ex.day}`}/><Mini label={ex.starts} value={bm.startBasis[resolvedStart as keyof typeof bm.startBasis]??resolvedStart}/></div>
    {canManage?<form action={updateCampaignBrandPolicy} className="mt-6 space-y-5 rounded-[24px] border border-[#EEE4F2] bg-[#FCF9FD] p-5">
      <input type="hidden" name="campaign_id" value={campaignId}/><input type="hidden" name="locale" value={locale}/>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={locale==="ar"?"البراند":"Brand"}><select name="brand_id" defaultValue={campaign.brand_id??""} required className={inputClass}><option value="">—</option>{brands.map(b=><option key={b.id} value={b.id}>{locale==="ar"?b.name_ar:b.name_en}</option>)}</select></Field>
        <Field label={ex.overrideScope}><select name="exclusivity_scope" defaultValue={scope} className={inputClass}><option value="inherit">{bm.inherit}</option><option value="none">{bm.scopes.none}</option><option value="brands">{bm.scopes.brands}</option><option value="all">{bm.scopes.all}</option></select></Field>
        <Field label={ex.overrideDays}><input name="exclusivity_days" type="number" min="1" max="365" defaultValue={campaign.exclusivity_days??current?.default_exclusivity_days??45} className={inputClass}/></Field>
        <Field label={ex.overrideStart}><select name="exclusivity_start_basis" defaultValue={campaign.exclusivity_start_basis??"inherit"} className={inputClass}><option value="inherit">{bm.inherit}</option><option value="publishing_date">{bm.startBasis.publishing_date}</option><option value="accepted_at">{bm.startBasis.accepted_at}</option></select></Field>
      </div>
      <div><p className="mb-3 text-xs font-black text-[#5B668E]">{ex.blockedBrands}</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{brands.filter(b=>b.id!==campaign.brand_id).map(b=><label key={b.id} className="flex items-center gap-3 rounded-xl border border-[#EADFF0] bg-white p-3"><input type="checkbox" name="blocked_brand_ids" value={b.id} defaultChecked={blockedSet.has(b.id)} className="h-4 w-4"/><span className="text-xs font-black text-[#60496D]">{locale==="ar"?b.name_ar:b.name_en}</span></label>)}</div></div>
      <button className="rounded-2xl bg-[#6B4C79] px-5 py-3 text-sm font-black text-white">{ex.savePolicy}</button>
    </form>:null}
  </section>
}
const inputClass="h-12 w-full rounded-xl border border-[#E6DAEB] bg-white px-3 text-sm font-bold text-[#513865] outline-none focus:border-[#A170BA]";
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-[11px] font-black text-[#75667C]">{label}</span>{children}</label>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-[#F9F5FB] p-4"><p className="text-[10px] font-bold text-[#9C8CA4]">{label}</p><p className="mt-1 text-sm font-black text-[#5B4168]">{value}</p></div>}
