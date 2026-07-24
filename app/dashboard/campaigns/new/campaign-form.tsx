"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  createCampaign,
  type CampaignActionState,
} from "../actions";

type Manager = {
  id: string;
  full_name: string;
  role: string;
};

type Props = {
  managers: Manager[];
  currentUserId: string;
  currentUserRole: string;
};

const initialState: CampaignActionState = {
  ok: false,
  message: "",
};

const statuses = [
  { value: "draft", label: "مسودة", description: "تجهيز داخلي قبل بدء العمل" },
  { value: "active", label: "نشطة", description: "الحملة جاهزة للتنفيذ" },
  { value: "paused", label: "موقوفة مؤقتًا", description: "توقف مؤقت مع حفظ البيانات" },
] as const;

const campaignTypes = [
  "إطلاق منتج",
  "توعية بالبراند",
  "مبيعات وتحويل",
  "زيارة فرع",
  "فعالية أو Pop-up",
  "تغطية موسمية",
  "محتوى دائم",
  "أخرى",
];

const brands = [
  "Pastel",
  "Rom&nd",
  "ARMAF Beauté",
  "Show by Pastel",
  "دار الأميرات",
];

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-2 text-xs font-bold text-rose-600">{errors[0]}</p>;
}

export default function CampaignForm({
  managers,
  currentUserId,
  currentUserRole,
}: Props) {
  const [state, formAction, pending] = useActionState(createCampaign, initialState);
  const [status, setStatus] = useState<(typeof statuses)[number]["value"]>("draft");
  const [contentDueLocal, setContentDueLocal] = useState("");
  const contentDueIsoRef = useRef<HTMLInputElement>(null);

  const currentManager = useMemo(
    () => managers.find((manager) => manager.id === currentUserId),
    [currentUserId, managers],
  );

  function prepareSubmission() {
    if (contentDueIsoRef.current) {
      contentDueIsoRef.current.value = contentDueLocal
        ? new Date(contentDueLocal).toISOString()
        : "";
    }
  }

  const inputClass =
    "h-14 w-full rounded-2xl border border-[#D8DDF7] bg-white px-4 text-sm font-bold text-[#33447F] outline-none transition placeholder:text-[#A4ABC3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:shadow-[0_0_0_4px_rgba(104,119,200,0.11)]";
  const textareaClass = `${inputClass} min-h-32 resize-y py-4 leading-7`;

  return (
    <form action={formAction} onSubmit={prepareSubmission} className="space-y-6">
      {state.message && !state.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
          {state.message}
        </div>
      )}

      <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl sm:p-7">
        <SectionTitle number="01" title="البيانات الأساسية" subtitle="عرّفي الحملة والبراند والمنتج بشكل واضح" />

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="اسم الحملة" required>
            <input name="name" className={inputClass} placeholder="مثال: صيف روماند 2026" />
            <FieldError errors={state.fieldErrors?.name} />
          </Field>

          <Field label="البراند" required>
            <input name="brand" list="campaign-brands" className={inputClass} placeholder="اختاري أو اكتبي البراند" />
            <datalist id="campaign-brands">
              {brands.map((brand) => <option key={brand} value={brand} />)}
            </datalist>
            <FieldError errors={state.fieldErrors?.brand} />
          </Field>

          <Field label="المنتج أو المجموعة">
            <input name="product" className={inputClass} placeholder="مثال: Juicy Lasting Tint" />
          </Field>

          <Field label="نوع الحملة">
            <select name="campaign_type" className={inputClass} defaultValue="">
              <option value="">اختاري نوع الحملة</option>
              {campaignTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <Field label="وصف وبريف الحملة">
            <textarea
              name="brief"
              className={textareaClass}
              placeholder="الهدف، الرسالة الرئيسية، الجمهور، المطلوب من المؤثر وأي تعليمات مهمة..."
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl sm:p-7">
        <SectionTitle number="02" title="المواعيد والميزانية" subtitle="حددي الإطار الزمني الافتراضي للحملة" />

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="تاريخ البداية">
            <input name="start_date" type="date" className={inputClass} />
          </Field>
          <Field label="تاريخ النهاية">
            <input name="end_date" type="date" className={inputClass} />
            <FieldError errors={state.fieldErrors?.endDate} />
          </Field>
          <Field label="موعد تسليم المحتوى">
            <input
              type="datetime-local"
              className={inputClass}
              value={contentDueLocal}
              onChange={(event) => setContentDueLocal(event.target.value)}
            />
            <input ref={contentDueIsoRef} type="hidden" name="content_due_at_iso" />
          </Field>
          <Field label="موعد النشر">
            <input name="publishing_date" type="date" className={inputClass} />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="الميزانية التقديرية">
            <div className="relative">
              <input
                name="budget"
                inputMode="decimal"
                className={`${inputClass} pl-20`}
                placeholder="0.00"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#F2F4FF] px-3 py-1 text-xs font-black text-[#6171C7]">ر.س</span>
            </div>
            <FieldError errors={state.fieldErrors?.budget} />
          </Field>

          <Field label="مدير الحملة">
            {currentUserRole === "admin" ? (
              <select name="manager_id" className={inputClass} defaultValue={currentUserId}>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name} — {manager.role === "admin" ? "مدير" : "منسق"}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="manager_id" value={currentUserId} />
                <div className={`${inputClass} flex items-center bg-[#F8F9FF] text-[#68749B]`}>
                  {currentManager?.full_name ?? "أنتِ"}
                </div>
              </>
            )}
          </Field>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl sm:p-7">
        <SectionTitle number="03" title="حالة الحملة" subtitle="اختاري المرحلة التي تبدأ منها الحملة" />

        <input type="hidden" name="status" value={status} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {statuses.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`rounded-2xl border p-5 text-right transition ${
                  active
                    ? "border-[#6877C8] bg-[#F0F2FF] shadow-[0_0_0_4px_rgba(104,119,200,0.10)]"
                    : "border-[#E1E5F5] bg-white hover:border-[#A9B9E6] hover:bg-[#FAFBFF]"
                }`}
              >
                <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${active ? "bg-[#6877C8] text-white" : "bg-[#F0F2FA] text-[#7B86B5]"}`}>
                  {active ? "✓" : "○"}
                </span>
                <span className="block font-black text-[#33447F]">{option.label}</span>
                <span className="mt-1 block text-xs leading-6 text-[#7C86A8]">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] backdrop-blur-xl sm:p-7">
        <SectionTitle number="04" title="التفاصيل المساندة" subtitle="معلومات تساعد الفريق والمؤثرين أثناء التنفيذ" />

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Field label="الهاشتاقات">
            <textarea name="hashtags" className={textareaClass} placeholder="#romand، #تنت&#10;يمكن الفصل بفاصلة أو سطر جديد" />
          </Field>
          <Field label="الروابط المرجعية">
            <textarea name="reference_links" dir="ltr" className={`${textareaClass} text-left`} placeholder="https://...&#10;https://..." />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="ملاحظات داخلية للفريق">
            <textarea name="internal_notes" className={textareaClass} placeholder="لا تظهر هذه الملاحظات للمؤثر، وتستخدم للتنسيق الداخلي فقط." />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-4 z-20 rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_55px_rgba(62,72,130,0.18)] backdrop-blur-xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-black text-[#33447F]">الخطوة التالية بعد الحفظ</p>
            <p className="mt-1 text-xs text-[#7D86A4]">إضافة المؤثرين وتحديد المنصات والمحتوى والمقابل.</p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-8 font-black text-white shadow-[0_14px_30px_rgba(82,99,185,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {pending ? <Spinner /> : <PlusIcon />}
            {pending ? "جاري إنشاء الحملة..." : "إنشاء الحملة"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#455487]">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6877C8,#8C99E8)] text-sm font-black text-white shadow-[0_10px_24px_rgba(104,119,200,0.25)]">
        {number}
      </div>
      <div>
        <h2 className="text-xl font-black text-[#33447F]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#7D86A4]">{subtitle}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
