"use client";

import { useState } from "react";
import { DashboardIcon } from "@/components/dashboard/icons";
import type { CampaignLocale } from "../../../campaign-copy";

type CreatedInfluencer = {
  influencer_id: string;
  full_name: string;
  mobile_e164: string;
  city: string | null;
  country: string | null;
  profile_completion: number;
  social_accounts: Array<{
    id: string;
    platform: string;
    username: string;
    profileUrl: string | null;
    followersCount: number | null;
  }>;
  available: boolean;
  availability_reason: string | null;
  blocking_campaign_id: string | null;
  blocking_campaign_name: string | null;
  blocked_until: string | null;
  days_remaining: number | null;
};

type Props = {
  open: boolean;
  campaignId: string;
  locale: CampaignLocale;
  initialQuery: string;
  onClose: () => void;
  onCreated: (influencer: CreatedInfluencer) => void;
  onDuplicate: (mobile: string) => void;
};

const platforms = ["instagram", "tiktok", "snapchat", "youtube", "x", "facebook", "other"] as const;

export default function QuickInfluencerModal({ open, campaignId, locale, initialQuery, onClose, onCreated, onDuplicate }: Props) {
  const ar = locale === "ar";
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState(() => (/\d/.test(initialQuery) ? initialQuery : ""));
  const [gender, setGender] = useState<"female" | "male">("female");
  const [city, setCity] = useState("");
  const [platform, setPlatform] = useState<(typeof platforms)[number]>("instagram");
  const [username, setUsername] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/influencers/quick-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, mobile, gender, city, platform, username, profileUrl }),
      });
      const payload = (await response.json()) as {
        influencer?: CreatedInfluencer;
        message?: string;
        code?: string;
        mobile?: string;
      };
      if (!response.ok) {
        if (response.status === 409 && payload.mobile) {
          onDuplicate(payload.mobile);
          onClose();
          return;
        }
        throw new Error(payload.message || (ar ? "تعذر إنشاء المؤثر." : "Could not create influencer."));
      }
      if (!payload.influencer) throw new Error(ar ? "لم يُعد النظام بيانات المؤثر." : "Influencer data was not returned.");
      onCreated(payload.influencer);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ar ? "تعذر إنشاء المؤثر." : "Could not create influencer.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = fullName.trim().length >= 2 && mobile.trim().length >= 8 && username.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#24325A]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div dir={ar ? "rtl" : "ltr"} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-[0_28px_90px_rgba(25,36,77,0.32)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-[#F7F0FA] px-3 py-1.5 text-[11px] font-black text-[#9362AD]">{ar ? "ملف أولي" : "Initial profile"}</span>
            <h2 className="mt-3 text-2xl font-black text-[#4A315C]">{ar ? "إضافة مؤثر جديد" : "Add a new influencer"}</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-[#8C7B94]">{ar ? "أدخلي الحد الأدنى للربط بالحملة. يستكمل المؤثر بقية ملفه لاحقًا." : "Enter the minimum details needed for assignment. The influencer can complete the profile later."}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-[#F0E8F4] text-[#6D789D]" aria-label={ar ? "إغلاق" : "Close"}>×</button>
        </div>

        {message ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</div> : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label={ar ? "اسم المؤثر" : "Influencer name"} required><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} /></Field>
          <Field label={ar ? "رقم الجوال" : "Mobile number"} required><input dir="ltr" value={mobile} onChange={(e) => setMobile(e.target.value)} className={`${inputClass} text-left`} placeholder="05xxxxxxxx" /></Field>
          <Field label={ar ? "الجنس" : "Gender"} required><select value={gender} onChange={(e) => setGender(e.target.value as "female" | "male")} className={inputClass}><option value="female">{ar ? "أنثى" : "Female"}</option><option value="male">{ar ? "ذكر" : "Male"}</option></select></Field>
          <Field label={ar ? "المدينة" : "City"}><input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder={ar ? "الرياض" : "Riyadh"} /></Field>
          <Field label={ar ? "المنصة" : "Platform"} required><select value={platform} onChange={(e) => setPlatform(e.target.value as (typeof platforms)[number])} className={inputClass}>{platforms.map((item) => <option key={item} value={item}>{platformLabel(item)}</option>)}</select></Field>
          <Field label={ar ? "اسم المستخدم" : "Username"} required><input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} text-left`} placeholder="@username" /></Field>
          <div className="sm:col-span-2"><Field label={ar ? "رابط الحساب — اختياري" : "Profile link — optional"}><input dir="ltr" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} className={`${inputClass} text-left`} placeholder="https://..." /></Field></div>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-bold leading-6 text-amber-800">
          {ar ? "لن تُطلب الهوية أو البيانات البنكية الآن. سيظهر الملف بحالة «أولي — يحتاج استكمال»، وتُطلب البيانات المالية قبل اعتماد الدفع." : "Identity and banking details are not required now. The profile remains initial and must be completed before payment approval."}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-12 rounded-2xl border border-[#ECE1F1] px-6 text-sm font-black text-[#68749B]">{ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" disabled={!canSave || saving} onClick={submit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#A170BA] to-[#8C5BA5] px-6 text-sm font-black text-white disabled:opacity-50">
            <DashboardIcon name="plus" className="h-4 w-4" />{saving ? (ar ? "جاري الإنشاء..." : "Creating...") : (ar ? "إنشاء واختيار المؤثر" : "Create and select influencer")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>{children}</label>;
}

function platformLabel(value: string) {
  const labels: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", youtube: "YouTube", x: "X", facebook: "Facebook", other: "Other" };
  return labels[value] ?? value;
}

const inputClass = "h-14 w-full rounded-2xl border border-[#ECE1F1] bg-[#FDFBFE] px-4 text-sm font-bold text-[#432A57] outline-none transition focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.10)]";
