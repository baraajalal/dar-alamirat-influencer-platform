import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { saveWorkHistory } from "./work-history-actions";

type BrandOption = { id: string; name_ar: string; name_en: string };
type HistoryValue = {
  id?: string;
  brand_id?: string | null;
  brand_name?: string | null;
  campaign_name?: string;
  collaboration_type?: string;
  collaboration_status?: string;
  collaboration_date?: string | null;
  platform?: string | null;
  content_type?: string | null;
  content_url?: string | null;
  compensation_amount?: number | null;
  compensation_currency?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  engagement_rate?: number | null;
  outcome?: string | null;
  performance_note?: string | null;
  internal_notes?: string | null;
};

const inputClass = "h-11 w-full rounded-xl border border-[#E8E1EF] bg-[#FDFBFE] px-3 text-sm font-bold text-[#432A57] outline-none focus:border-[#A170BA] focus:bg-white";

export function WorkHistoryForm({ influencerId, locale, dictionary, brands, value }: {
  influencerId: string;
  locale: DashboardLocale;
  dictionary: DashboardDictionary;
  brands: BrandOption[];
  value?: HistoryValue | null;
}) {
  const c = dictionary.workHistory;
  return (
    <form action={saveWorkHistory} className="space-y-4 rounded-2xl border border-[#EEE4F2] bg-[#FCF9FD] p-4">
      <input type="hidden" name="influencer_id" value={influencerId} />
      <input type="hidden" name="history_id" value={value?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label={c.fields.brand}>
          <select name="brand_id" defaultValue={value?.brand_id ?? ""} className={inputClass}>
            <option value="">—</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{locale === "ar" ? brand.name_ar : brand.name_en}</option>)}
          </select>
        </Field>
        <Field label={c.fields.campaign} required><input name="campaign_name" defaultValue={value?.campaign_name ?? ""} className={inputClass} required /></Field>
        <Field label={c.fields.date}><input name="collaboration_date" type="date" defaultValue={value?.collaboration_date ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.type}><select name="collaboration_type" defaultValue={value?.collaboration_type ?? "other"} className={inputClass}>{Object.entries(c.types).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label={c.fields.status}><select name="collaboration_status" defaultValue={value?.collaboration_status ?? "completed"} className={inputClass}>{Object.entries(c.statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label={c.fields.outcome}><select name="outcome" defaultValue={value?.outcome ?? "unknown"} className={inputClass}>{Object.entries(c.outcomes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label={c.fields.platform}><select name="platform" defaultValue={value?.platform ?? ""} className={inputClass}><option value="">—</option>{["instagram","tiktok","snapchat","youtube","x","facebook","other"].map((p)=><option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label={c.fields.contentType}><input name="content_type" defaultValue={value?.content_type ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.contentUrl}><input name="content_url" type="url" dir="ltr" defaultValue={value?.content_url ?? ""} className={inputClass} placeholder="https://..." /></Field>
        <Field label={c.fields.amount}><input name="compensation_amount" type="number" min="0" step="0.01" defaultValue={value?.compensation_amount ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.currency}><input name="compensation_currency" dir="ltr" maxLength={3} defaultValue={value?.compensation_currency ?? "SAR"} className={inputClass} /></Field>
        <Field label={c.fields.engagement}><input name="engagement_rate" type="number" min="0" step="0.01" defaultValue={value?.engagement_rate ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.views}><input name="views" type="number" min="0" defaultValue={value?.views ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.likes}><input name="likes" type="number" min="0" defaultValue={value?.likes ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.comments}><input name="comments" type="number" min="0" defaultValue={value?.comments ?? ""} className={inputClass} /></Field>
        <Field label={c.fields.shares}><input name="shares" type="number" min="0" defaultValue={value?.shares ?? ""} className={inputClass} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={c.fields.performanceNote}><textarea name="performance_note" defaultValue={value?.performance_note ?? ""} className="min-h-24 w-full rounded-xl border border-[#E8E1EF] bg-white p-3 text-sm font-bold text-[#432A57] outline-none focus:border-[#A170BA]" /></Field>
        <Field label={c.fields.internalNotes}><textarea name="internal_notes" defaultValue={value?.internal_notes ?? ""} className="min-h-24 w-full rounded-xl border border-[#E8E1EF] bg-white p-3 text-sm font-bold text-[#432A57] outline-none focus:border-[#A170BA]" /></Field>
      </div>
      <div className="flex justify-end"><button className="rounded-xl bg-[#8C5BA5] px-5 py-2.5 text-sm font-black text-white">{c.save}</button></div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#66739D]">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>{children}</label>;
}
