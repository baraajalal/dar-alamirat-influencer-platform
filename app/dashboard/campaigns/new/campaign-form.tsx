"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { DashboardIcon } from "@/components/dashboard/icons";
import { createCampaign, type CampaignActionState } from "../actions";
import { getCampaignCopy, type CampaignLocale } from "../campaign-copy";
import { CampaignPanel, CampaignSectionTitle } from "../campaign-ui";

type Manager = { id: string; full_name: string; role: string };
type Props = {
  locale: CampaignLocale;
  managers: Manager[];
  currentUserId: string;
  currentUserRole: string;
};

const initialState: CampaignActionState = { ok: false, message: "" };
const brands = ["Pastel", "Rom&nd", "ARMAF Beauté", "Show by Pastel", "دار الأميرات"];

export default function CampaignForm({ locale, managers, currentUserId, currentUserRole }: Props) {
  const copy = getCampaignCopy(locale);
  const [state, formAction, pending] = useActionState(createCampaign, initialState);
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [contentDueLocal, setContentDueLocal] = useState("");
  const [ownerType, setOwnerType] = useState<"internal" | "external_supplier" | "joint">("internal");
  const [autoComplete, setAutoComplete] = useState(false);
  const contentDueIsoRef = useRef<HTMLInputElement | null>(null);
  const currentManager = useMemo(() => managers.find((manager) => manager.id === currentUserId), [currentUserId, managers]);

  const statuses = [
    { value: "draft" as const, label: copy.statuses.draft, description: copy.form.statusDraftDescription },
    { value: "active" as const, label: copy.statuses.active, description: copy.form.statusActiveDescription },
    { value: "paused" as const, label: copy.statuses.paused, description: copy.form.statusPausedDescription },
  ];
  const campaignTypes = locale === "ar"
    ? ["إطلاق منتج", "توعية بالبراند", "مبيعات وتحويل", "زيارة فرع", "فعالية أو Pop-up", "تغطية موسمية", "محتوى دائم", "أخرى"]
    : ["Product launch", "Brand awareness", "Sales and conversion", "Branch visit", "Event or pop-up", "Seasonal coverage", "Evergreen content", "Other"];

  function prepareSubmission() {
    if (contentDueIsoRef.current) {
      contentDueIsoRef.current.value = contentDueLocal ? new Date(contentDueLocal).toISOString() : "";
    }
  }

  return (
    <form action={formAction} onSubmit={prepareSubmission} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="status" value={status} />
      <input ref={contentDueIsoRef} type="hidden" name="content_due_at_iso" />

      {state.message && !state.ok ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">{state.message}</div>
      ) : null}

      <CampaignPanel>
        <CampaignSectionTitle number="01" title={copy.form.section1} description={copy.form.section1Hint} />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label={copy.form.name} required error={state.fieldErrors?.name?.[0]}>
            <input name="name" className={inputClass} placeholder={copy.form.namePlaceholder} />
          </Field>
          <Field label={copy.form.brand} required error={state.fieldErrors?.brand?.[0]}>
            <input name="brand" list="campaign-brands" className={inputClass} placeholder={copy.form.brandPlaceholder} />
            <datalist id="campaign-brands">{brands.map((brand) => <option key={brand} value={brand} />)}</datalist>
          </Field>
          <Field label={copy.form.product}>
            <input name="product" className={inputClass} placeholder={copy.form.productPlaceholder} />
          </Field>
          <Field label={copy.form.type}>
            <select name="campaign_type" className={inputClass} defaultValue="">
              <option value="">{copy.form.typePlaceholder}</option>
              {campaignTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5">
          <Field label={copy.form.brief}>
            <textarea name="brief" className={textareaClass} placeholder={copy.form.briefPlaceholder} />
          </Field>
        </div>
      </CampaignPanel>


      <CampaignPanel>
        <CampaignSectionTitle number="02" title={locale === "ar" ? "ملكية الحملة والاستعداد للمشاريع" : "Campaign ownership and project readiness"} description={locale === "ar" ? "صنّف الحملة الآن لتصبح جاهزة للربط بمسار المشاريع التسويقية لاحقًا." : "Classify the campaign now so it can be linked to marketing projects later."} />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label={locale === "ar" ? "ملكية الحملة" : "Campaign ownership"}>
            <select name="campaign_owner_type" className={inputClass} value={ownerType} onChange={(event) => setOwnerType(event.target.value as typeof ownerType)}>
              <option value="internal">{locale === "ar" ? "حملة داخلية" : "Internal campaign"}</option>
              <option value="external_supplier">{locale === "ar" ? "حملة لمورد خارجي" : "External supplier campaign"}</option>
              <option value="joint">{locale === "ar" ? "حملة مشتركة" : "Joint campaign"}</option>
            </select>
          </Field>
          <Field label={locale === "ar" ? "تصنيف الحملة" : "Campaign category"}>
            <select name="campaign_category" className={inputClass} defaultValue="influencer_campaign">
              <option value="influencer_campaign">{locale === "ar" ? "حملة مؤثرين" : "Influencer campaign"}</option>
              <option value="product_launch">{locale === "ar" ? "إطلاق منتج" : "Product launch"}</option>
              <option value="brand_awareness">{locale === "ar" ? "وعي بالعلامة" : "Brand awareness"}</option>
              <option value="sales_activation">{locale === "ar" ? "تنشيط مبيعات" : "Sales activation"}</option>
              <option value="store_activation">{locale === "ar" ? "تنشيط فروع" : "Store activation"}</option>
              <option value="seasonal_campaign">{locale === "ar" ? "حملة موسمية" : "Seasonal campaign"}</option>
              <option value="event_support">{locale === "ar" ? "دعم فعالية" : "Event support"}</option>
              <option value="mixed">{locale === "ar" ? "مشروع مختلط" : "Mixed"}</option>
            </select>
          </Field>
        </div>
        {ownerType !== "internal" ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label={locale === "ar" ? "اسم الجهة أو المورد" : "Organization / supplier"}><input name="external_organization_name" className={inputClass} /></Field>
            <Field label={locale === "ar" ? "اسم مسؤول الجهة" : "Contact name"}><input name="external_contact_name" className={inputClass} /></Field>
            <Field label={locale === "ar" ? "رقم التواصل" : "Contact mobile"}><input name="external_contact_mobile" dir="ltr" className={inputClass} /></Field>
            <Field label={locale === "ar" ? "البريد الإلكتروني" : "Contact email"}><input name="external_contact_email" type="email" dir="ltr" className={inputClass} /></Field>
          </div>
        ) : null}
      </CampaignPanel>

      <CampaignPanel>
        <CampaignSectionTitle number="03" title={locale === "ar" ? "التقدم والإكمال التلقائي" : "Progress and automatic completion"} description={locale === "ar" ? "يمكن إضافة أهداف الحملة بعد الإنشاء، وسيُحدّث النظام التقدم تلقائيًا." : "Targets can be added after creation and progress will update automatically."} />
        <label className="mt-6 flex items-center gap-3 rounded-2xl border border-[#DDE2F3] bg-[#FAFBFF] p-4">
          <input name="auto_complete_enabled" type="checkbox" checked={autoComplete} onChange={(event) => setAutoComplete(event.target.checked)} className="h-5 w-5" />
          <span className="font-black text-[#405080]">{locale === "ar" ? "تفعيل الإكمال التلقائي للحملة" : "Enable automatic campaign completion"}</span>
        </label>
        <div className="mt-5">
          <Field label={locale === "ar" ? "قاعدة الإكمال" : "Completion rule"}>
            {!autoComplete ? <input type="hidden" name="completion_mode" value="manual" /> : null}
            <select name="completion_mode" className={inputClass} defaultValue="all_required_targets_and_assignments" disabled={!autoComplete}>
              <option value="manual">{locale === "ar" ? "يدوي" : "Manual"}</option>
              <option value="all_required_targets">{locale === "ar" ? "عند تحقيق جميع الأهداف المطلوبة" : "All required targets"}</option>
              <option value="any_primary_target">{locale === "ar" ? "عند تحقيق أي هدف رئيسي" : "Any primary target"}</option>
              <option value="all_required_targets_and_assignments">{locale === "ar" ? "تحقيق الأهداف وإغلاق جميع التكليفات" : "Targets achieved and assignments closed"}</option>
            </select>
          </Field>
        </div>
      </CampaignPanel>

      <CampaignPanel>
        <CampaignSectionTitle number="04" title={copy.form.section2} description={copy.form.section2Hint} />
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label={copy.form.startDate}><input name="start_date" type="date" className={inputClass} /></Field>
          <Field label={copy.form.endDate} error={state.fieldErrors?.endDate?.[0]}><input name="end_date" type="date" className={inputClass} /></Field>
          <Field label={copy.form.contentDue}>
            <input type="datetime-local" className={inputClass} value={contentDueLocal} onChange={(event) => setContentDueLocal(event.target.value)} />
          </Field>
          <Field label={copy.form.publishingDate}><input name="publishing_date" type="date" className={inputClass} /></Field>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label={copy.form.budget} error={state.fieldErrors?.budget?.[0]}>
            <div className="relative">
              <input name="budget" inputMode="decimal" className={`${inputClass} pe-20`} placeholder="0.00" />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#F2F4FF] px-3 py-1 text-xs font-black text-[#6171C7]">{copy.common.currency}</span>
            </div>
          </Field>
          <Field label={copy.form.manager}>
            {currentUserRole === "admin" ? (
              <select name="manager_id" className={inputClass} defaultValue={currentUserId}>
                {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name}</option>)}
              </select>
            ) : (
              <>
                <input type="hidden" name="manager_id" value={currentUserId} />
                <div className={`${inputClass} flex items-center bg-[#F8F9FF] text-[#68749B]`}>{currentManager?.full_name ?? copy.form.you}</div>
              </>
            )}
          </Field>
        </div>
      </CampaignPanel>

      <CampaignPanel>
        <CampaignSectionTitle number="05" title={copy.form.section3} description={copy.form.section3Hint} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {statuses.map((option) => {
            const active = status === option.value;
            return (
              <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`rounded-[22px] border p-5 text-start transition ${active ? "border-[#6877C8] bg-[#F0F2FF] shadow-[0_0_0_4px_rgba(104,119,200,0.10)]" : "border-[#E1E5F5] bg-[#FAFBFF] hover:border-[#A9B9E6] hover:bg-white"}`}>
                <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[#6877C8] text-white" : "bg-white text-[#7B86B5]"}`}>{active ? "✓" : "○"}</span>
                <span className="block font-black text-[#33447F]">{option.label}</span>
                <span className="mt-1 block text-xs leading-6 text-[#7C86A8]">{option.description}</span>
              </button>
            );
          })}
        </div>
      </CampaignPanel>

      <CampaignPanel>
        <CampaignSectionTitle number="06" title={copy.form.section4} description={copy.form.section4Hint} />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Field label={copy.form.hashtags}><textarea name="hashtags" className={textareaClass} placeholder={copy.form.hashtagsPlaceholder} /></Field>
          <Field label={copy.form.references}><textarea name="reference_links" dir="ltr" className={`${textareaClass} text-left`} placeholder={copy.form.referencesPlaceholder} /></Field>
        </div>
        <div className="mt-5"><Field label={copy.form.notes}><textarea name="internal_notes" className={textareaClass} placeholder={copy.form.notesPlaceholder} /></Field></div>
      </CampaignPanel>

      <div className="sticky bottom-4 z-20 rounded-[24px] border border-white/90 bg-white/94 p-4 shadow-[0_20px_55px_rgba(62,72,130,0.16)] backdrop-blur-xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-black text-[#33447F]">{copy.form.createButton}</p>
            <p className="mt-1 text-xs font-semibold text-[#8A92AA]">{copy.form.nextStep}</p>
          </div>
          <button disabled={pending} className="inline-flex min-h-13 min-w-52 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#6877C8] to-[#5265BC] px-6 font-black text-white shadow-[0_14px_30px_rgba(79,98,185,0.22)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-65">
            <DashboardIcon name={pending ? "sparkles" : "plus"} className="h-5 w-5" />
            {pending ? copy.form.creating : copy.form.createButton}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputClass = "h-14 w-full rounded-2xl border border-[#DDE2F3] bg-[#FAFBFF] px-4 text-sm font-bold text-[#33447F] outline-none transition placeholder:text-[#A4ABC3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.10)]";
const textareaClass = `${inputClass} min-h-32 resize-y py-4 leading-7`;

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>{children}{error ? <span className="mt-2 block text-xs font-bold text-rose-600">{error}</span> : null}</label>;
}
