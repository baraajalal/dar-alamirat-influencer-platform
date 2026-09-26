import type { DashboardDictionary, DashboardLocale } from "@/lib/i18n/dashboard";
import { saveBrand } from "./actions";

type Staff = { id: string; full_name: string; role: string };
type BrandOption = { id: string; name_ar: string; name_en: string; is_active: boolean };
type BrandValue = {
  id?: string;
  name_ar?: string;
  name_en?: string;
  slug?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  whatsapp_number?: string | null;
  contact_email?: string | null;
  primary_contact_id?: string | null;
  default_exclusivity_scope?: string;
  default_exclusivity_days?: number;
  default_exclusivity_start_basis?: string;
  is_active?: boolean;
};

export function BrandForm({
  locale,
  dictionary,
  staff,
  brands,
  value,
  selectedTeam,
  selectedBlocked,
}: {
  locale: DashboardLocale;
  dictionary: DashboardDictionary;
  staff: Staff[];
  brands: BrandOption[];
  value?: BrandValue | null;
  selectedTeam?: string[];
  selectedBlocked?: string[];
}) {
  const copy = dictionary.brands;
  const currentId = value?.id ?? "";
  const selectedTeamSet = new Set(selectedTeam ?? []);
  const selectedBlockedSet = new Set(selectedBlocked ?? []);
  const scope = value?.default_exclusivity_scope ?? "none";

  return (
    <form action={saveBrand} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="brand_id" value={currentId} />

      <Panel title={locale === "ar" ? "هوية البراند" : "Brand identity"}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={copy.fields.nameAr} required><input name="name_ar" defaultValue={value?.name_ar ?? ""} className={inputClass} /></Field>
          <Field label={copy.fields.nameEn} required><input name="name_en" defaultValue={value?.name_en ?? ""} className={inputClass} /></Field>
          <Field label={copy.fields.slug} required><input name="slug" dir="ltr" defaultValue={value?.slug ?? ""} className={inputClass} placeholder="romand" /></Field>
          <Field label={copy.fields.logoUrl}><input name="logo_url" dir="ltr" defaultValue={value?.logo_url ?? ""} className={inputClass} placeholder="https://..." /></Field>
          <Field label={copy.fields.primaryColor}><input name="primary_color" dir="ltr" defaultValue={value?.primary_color ?? ""} className={inputClass} placeholder="#C7A9D0" /></Field>
          <Field label={copy.fields.secondaryColor}><input name="secondary_color" dir="ltr" defaultValue={value?.secondary_color ?? ""} className={inputClass} placeholder="#FFFFFF" /></Field>
        </div>
        <label className="mt-5 flex items-center gap-3 rounded-2xl border border-[#ECE1F1] bg-[#FCF9FD] p-4">
          <input name="is_active" type="checkbox" defaultChecked={value?.is_active ?? true} className="h-5 w-5" />
          <span className="text-sm font-black text-[#513865]">{copy.fields.status}: {copy.active}</span>
        </label>
      </Panel>

      <Panel title={copy.contact} description={copy.contactHint}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={copy.fields.whatsapp}><input name="whatsapp_number" dir="ltr" defaultValue={value?.whatsapp_number ?? ""} className={inputClass} placeholder="+9665..." /></Field>
          <Field label={copy.fields.email}><input name="contact_email" type="email" dir="ltr" defaultValue={value?.contact_email ?? ""} className={inputClass} /></Field>
          <Field label={copy.fields.primaryContact}>
            <select name="primary_contact_id" defaultValue={value?.primary_contact_id ?? ""} className={inputClass}>
              <option value="">—</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {dictionary.roles[member.role as keyof typeof dictionary.roles] ?? member.role}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={copy.team} description={copy.teamHint}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => (
            <label key={member.id} className="flex items-center gap-3 rounded-2xl border border-[#ECE1F1] bg-[#FCF9FD] p-4">
              <input name="team_member_ids" value={member.id} type="checkbox" defaultChecked={selectedTeamSet.has(member.id)} className="h-5 w-5" />
              <span className="min-w-0"><span className="block truncate text-sm font-black text-[#513865]">{member.full_name}</span><span className="mt-1 block text-xs font-bold text-[#95849D]">{dictionary.roles[member.role as keyof typeof dictionary.roles] ?? member.role}</span></span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title={copy.exclusivity} description={copy.policyHint}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label={copy.fields.scope}>
            <select name="default_exclusivity_scope" defaultValue={scope} className={inputClass}>
              <option value="none">{copy.scopes.none}</option><option value="brands">{copy.scopes.brands}</option><option value="all">{copy.scopes.all}</option>
            </select>
          </Field>
          <Field label={copy.fields.days}><input name="default_exclusivity_days" type="number" min="0" max="365" defaultValue={value?.default_exclusivity_days ?? 45} className={inputClass} /></Field>
          <Field label={copy.fields.startBasis}>
            <select name="default_exclusivity_start_basis" defaultValue={value?.default_exclusivity_start_basis ?? "publishing_date"} className={inputClass}>
              <option value="publishing_date">{copy.startBasis.publishing_date}</option><option value="accepted_at">{copy.startBasis.accepted_at}</option>
            </select>
          </Field>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-xs font-black text-[#5B668E]">{copy.fields.blockedBrands}</p>
          <p className="mb-3 text-xs font-semibold text-[#95849D]">{copy.blockedBrandsHint}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brands.filter((brand) => brand.id !== currentId).map((brand) => (
              <label key={brand.id} className="flex items-center gap-3 rounded-2xl border border-[#ECE1F1] bg-[#FCF9FD] p-3">
                <input name="blocked_brand_ids" value={brand.id} type="checkbox" defaultChecked={selectedBlockedSet.has(brand.id)} className="h-5 w-5" />
                <span className="text-sm font-black text-[#513865]">{locale === "ar" ? brand.name_ar : brand.name_en}</span>
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <div className="flex justify-end"><button className="rounded-2xl bg-gradient-to-br from-[#A170BA] to-[#8C5BA5] px-7 py-3.5 text-sm font-black text-white shadow-lg">{copy.save}</button></div>
    </form>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-[#EEE4F2] bg-white p-6 shadow-[0_14px_40px_rgba(69,48,83,0.05)]"><h2 className="text-lg font-black text-[#432A57]">{title}</h2>{description ? <p className="mt-1 text-sm font-semibold leading-7 text-[#8A92AA]">{description}</p> : null}<div className="mt-5">{children}</div></section>;
}
const inputClass="h-13 w-full rounded-2xl border border-[#ECE1F1] bg-[#FDFBFE] px-4 text-sm font-bold text-[#432A57] outline-none transition focus:border-[#A170BA] focus:bg-white";
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>{children}</label>; }
