"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackModal from "@/components/feedback-modal";

type Gender = "" | "female" | "male" | "other";
type LocationKind = "city" | "country";
type SocialRow = {
  platform: string;
  otherPlatformName: string;
  username: string;
  profileUrl: string;
  followersCount: string;
  averageViews: string;
  averageLikes: string;
  averageComments: string;
  engagementRate: string;
  femaleAudience: string;
  maleAudience: string;
  audienceMainCity: string;
  audienceMainCountry: string;
  advanced: boolean;
};

type FormState = {
  fullName: string;
  mobile: string;
  email: string;
  gender: Gender;
  birthYear: string;
  city: string;
  country: string;
  hasMawthooq: "" | "yes" | "no";
  mawthooqNumber: string;
  mawthooqExpiryDate: string;
  preferredAdCategories: string[];
  contentStylePreference: string[];
  shootingStylePreferences: string[];
};

const initialForm: FormState = {
  fullName: "", mobile: "", email: "", gender: "", birthYear: "", city: "", country: "Saudi Arabia",
  hasMawthooq: "", mawthooqNumber: "", mawthooqExpiryDate: "", preferredAdCategories: [], contentStylePreference: [], shootingStylePreferences: [],
};
const platforms = ["TikTok", "Instagram", "Snapchat", "YouTube", "X", "Facebook"];
const makeRow = (platform: string): SocialRow => ({ platform, otherPlatformName: "", username: "", profileUrl: "", followersCount: "", averageViews: "", averageLikes: "", averageComments: "", engagementRate: "", femaleAudience: "", maleAudience: "", audienceMainCity: "", audienceMainCountry: "", advanced: false });
const categories = ["Beauty", "Skincare", "Haircare", "Perfume", "Fashion", "Lifestyle", "Restaurants", "Cafes", "Travel", "Mother & Baby", "Fitness", "Technology", "Home", "Events", "Other"];
const contentTypes = ["Reels", "Story", "Post", "Snap", "TikTok Video", "YouTube Short", "Live", "Review", "Unboxing", "Giveaway", "Promo Code"];
const shootingStyles = ["تصوير احترافي", "تصوير منزلي", "Lifestyle", "UGC", "Talking to Camera", "Voice Over", "تصوير منتجات", "زيارة فرع", "تصوير خارجي", "بدون ظهور وجه"];
const steps = ["البيانات الشخصية", "بيانات موثوق", "حسابات التواصل", "التفضيلات", "المراجعة والإرسال"];
const defaultCountries = ["Saudi Arabia", "United Arab Emirates", "Kuwait", "Bahrain", "Qatar", "Oman"];
const defaultCities = ["Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar", "Dhahran", "Taif", "Tabuk", "Abha", "Khamis Mushait", "Buraidah", "Hail", "Jubail", "Al Ahsa"];

export default function InfluencerOnboardingWizard({ editToken }: { editToken?: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [social, setSocial] = useState<SocialRow[]>(platforms.map(makeRow));
  const [loading, setLoading] = useState(Boolean(editToken));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("error");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [closeDestination, setCloseDestination] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>(defaultCities);
  const [countryOptions, setCountryOptions] = useState<string[]>(defaultCountries);

  const showError = useCallback((text: string, destination: string | null = null) => {
    setMessage(text);
    setFeedbackType("error");
    setCloseDestination(destination);
    setFeedbackOpen(true);
  }, []);

  const showSuccess = useCallback((text: string, destination: string) => {
    setMessage(text);
    setFeedbackType("success");
    setCloseDestination(destination);
    setFeedbackOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    if (closeDestination) {
      window.location.replace(closeDestination);
    }
  }, [closeDestination]);

  useEffect(() => {
    if (!editToken) return;
    fetch(`/api/portal-access/edit?token=${encodeURIComponent(editToken)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.message || "تعذر تحميل الطلب"); return j; })
      .then(data => {
        setForm({ ...initialForm, ...data.influencer });
        const rows = (data.socialAccounts || []).map((x: any) => ({ ...makeRow(x.platform || "Other"), ...x, advanced: false }));
        setSocial(rows.length ? rows : platforms.map(makeRow));
        setReviewNotes(data.reviewNotes || "");
      })
      .catch(e => showError(e instanceof Error ? e.message : "تعذر تحميل الطلب", "/"))
      .finally(() => setLoading(false));
  }, [editToken, showError]);

  useEffect(() => {
    fetch("/api/portal-access/location-options", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.cities)) {
          setCityOptions(Array.from(new Set([...defaultCities, ...data.cities.filter((x: unknown): x is string => typeof x === "string")])));
        }
        if (Array.isArray(data.countries)) {
          setCountryOptions(Array.from(new Set([...defaultCountries, ...data.countries.filter((x: unknown): x is string => typeof x === "string")])));
        }
      })
      .catch(() => undefined);
  }, []);

  const rememberLocationOption = useCallback(async (kind: LocationKind, value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    try {
      const response = await fetch("/api/portal-access/location-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value: cleaned, mobile: form.mobile }),
      });
      if (!response.ok) return;
      if (kind === "city") setCityOptions((items) => Array.from(new Set([...items, cleaned])));
      else setCountryOptions((items) => Array.from(new Set([...items, cleaned])));
    } catch {
      // Saving a new lookup option is helpful but must never block onboarding.
    }
  }, [form.mobile]);

  const completion = useMemo(() => {
    const checks = [Boolean(form.fullName), Boolean(form.mobile), Boolean(form.email), Boolean(form.gender), Boolean(form.birthYear), Boolean(form.city), Boolean(form.hasMawthooq), form.hasMawthooq === "no" || Boolean(form.mawthooqNumber), social.some(s => s.profileUrl || s.username), form.preferredAdCategories.length > 0, form.contentStylePreference.length > 0, form.shootingStylePreferences.length > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, social]);

  function toggle(key: "preferredAdCategories" | "contentStylePreference" | "shootingStylePreferences", value: string) {
    setForm(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(x => x !== value) : [...current[key], value] }));
  }
  function updateSocial(index: number, patch: Partial<SocialRow>) { setSocial(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  function addOtherPlatform() { setSocial(rows => [...rows, makeRow("Other")]); }

  function validateCurrent() {
    if (step === 0 && (!form.fullName.trim() || !form.mobile.trim() || !form.email.trim() || !form.gender || !form.birthYear || !form.city.trim())) return "أكمل البيانات الشخصية المطلوبة.";
    if (step === 1 && (!form.hasMawthooq || (form.hasMawthooq === "yes" && !form.mawthooqNumber.trim()))) return "أكمل بيانات موثوق.";
    if (step === 2 && !social.some(row => row.profileUrl.trim() || row.username.trim())) return "أضف حساب تواصل واحدًا على الأقل.";
    if (step === 3 && (!form.preferredAdCategories.length || !form.contentStylePreference.length || !form.shootingStylePreferences.length)) return "اختر تفضيلات التعاون والمحتوى والتصوير.";
    return "";
  }
  function next() {
    const error = validateCurrent();
    if (error) { showError(error); return; }
    if (step === 0) {
      void rememberLocationOption("city", form.city);
      void rememberLocationOption("country", form.country);
    }
    setStep(s => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const error = validateCurrent(); if (error) { showError(error); return; }
    setSubmitting(true); setMessage("");
    const activeSocial = social.filter(row => row.profileUrl.trim() || row.username.trim());
    const payload = {
      influencer: { ...form, nationalId: "", bankName: "", iban: "", accountHolderName: "" },
      socialAccounts: activeSocial.map(({ advanced, ...row }) => row), website: "",
    };
    try {
      const endpoint = editToken ? "/api/portal-access/edit" : "/api/submit-influencer";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editToken ? { token: editToken, payload } : payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر حفظ الملف");
      if (!editToken) {
        const req = await fetch("/api/portal-access/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: form.mobile, email: form.email, website: "" }) });
        const reqResult = await req.json(); if (!req.ok) throw new Error(reqResult.message || "تم حفظ الملف لكن تعذر إرسال طلب التفعيل");
      }
      const successMessage = editToken ? "تم إرسال التعديلات للمراجعة مرة أخرى. تم إغلاق رابط التعديل ولن يمكن استخدامه مرة ثانية." : "تم إرسال طلبك بنجاح. سيقوم فريق دار الأميرات بمراجعته، وسيصلك رابط التفعيل من الموظف بعد الموافقة.";
      showSuccess(successMessage, editToken ? "/" : "/");
      setStep(4);
    } catch (e) { showError(e instanceof Error ? e.message : "حدث خطأ غير متوقع"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main dir="inherit" className="min-h-screen bg-[#FCF9FD] p-10 text-center font-bold text-[#756A7A]">جاري تحميل طلبك...</main>;

  return (
    <main dir="inherit" className="min-h-screen bg-[linear-gradient(135deg,#F8F9FE,#EEF1FA)] px-4 py-7 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#432A57]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-white bg-white/90 px-5 py-4 shadow-sm">
          <div><p className="text-xs font-black text-[#8790AE]">منصة مؤثري دار الأميرات</p><h1 className="mt-1 text-xl font-black">{editToken ? "تعديل طلب التفعيل" : "طلب تفعيل حساب"}</h1></div>
          <Link href="/login" className="rounded-xl border border-[#D9DEF1] px-4 py-2 text-sm font-black text-[#A06DB9]">لدي حساب</Link>
        </header>
        {reviewNotes ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-800"><b>ملاحظات الموظف:</b> {reviewNotes}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-[28px] bg-[linear-gradient(145deg,#B682C5,#7F568E)] p-6 text-white shadow-[0_20px_50px_rgba(79,96,182,.2)] lg:sticky lg:top-6">
            <p className="text-sm font-black text-white/70">استكمال الملف</p><div className="mt-3 text-3xl font-black">{completion}%</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${completion}%` }} /></div>
            <div className="mt-7 space-y-2">{steps.map((label, i) => <button type="button" key={label} onClick={()=> i <= step && setStep(i)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-right text-sm font-bold ${i === step ? "bg-white text-[#7F568E]" : "text-white/80"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${i < step ? "bg-emerald-400 text-white" : i === step ? "bg-[#F6F0F9]" : "bg-white/10"}`}>{i < step ? "✓" : i + 1}</span>{label}</button>)}</div>
          </aside>
          <section className="rounded-[30px] border border-[#E0E4F2] bg-white p-5 shadow-[0_18px_55px_rgba(67,82,155,.08)] sm:p-8">
            {step === 0 && <PersonalStep form={form} setForm={setForm} cityOptions={cityOptions} countryOptions={countryOptions} rememberLocationOption={rememberLocationOption} />}
            {step === 1 && <MawthooqStep form={form} setForm={setForm} />}
            {step === 2 && <SocialStep rows={social} update={updateSocial} addOther={addOtherPlatform} />}
            {step === 3 && <PreferencesStep form={form} toggle={toggle} />}
            {step === 4 && <ReviewStep form={form} social={social} />}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#EEF0F6] pt-6">
              <button type="button" disabled={step === 0} onClick={()=>setStep(s=>Math.max(0,s-1))} className="rounded-2xl border border-[#D8DDF0] px-6 py-3 font-black text-[#66739C] disabled:opacity-40">السابق</button>
              {step < 4 ? <button type="button" onClick={next} className="rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-8 py-3 font-black text-white shadow-lg">التالي</button> : <button type="button" disabled={submitting} onClick={submit} className="rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-8 py-3 font-black text-white shadow-lg disabled:opacity-60">{submitting ? "جاري الإرسال..." : editToken ? "إعادة الإرسال للمراجعة" : "إرسال طلب التفعيل"}</button>}
            </div>
          </section>
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} type={feedbackType} message={message} onClose={closeFeedback} closeLabel={closeDestination ? "إغلاق الرابط" : "حسنًا"} />
    </main>
  );
}

function Field({ label, value, onChange, type="text", dir, placeholder, list }: any) { return <label className="block"><span className="mb-2 block text-sm font-black text-[#5F5068]">{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} dir={dir} placeholder={placeholder} list={list} className="h-14 w-full rounded-2xl border border-[#E9DDEF] bg-[#FEFCFF] px-4 font-bold outline-none focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10" /></label>; }

function BirthDateField({ birthYear, setBirthYear }: { birthYear: string; setBirthYear: (value: string) => void }) {
  const [dateValue, setDateValue] = useState(() => /^\d{4}$/.test(birthYear || "") ? `${birthYear}-01-01` : "");
  useEffect(() => {
    if (/^\d{4}$/.test(birthYear || "") && !dateValue) setDateValue(`${birthYear}-01-01`);
  }, [birthYear, dateValue]);
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  return <label className="block"><span className="mb-2 block text-sm font-black text-[#5F5068]">تاريخ الميلاد *</span><input type="date" value={dateValue} max={maxDate} onChange={(e)=>{setDateValue(e.target.value); setBirthYear(e.target.value ? e.target.value.slice(0,4) : "");}} className="h-14 w-full rounded-2xl border border-[#E9DDEF] bg-[#FEFCFF] px-4 font-bold outline-none focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10" /></label>;
}

function SmartLocationField({ label, value, onChange, options, listId, placeholder, onRemember }: { label:string; value:string; onChange:(value:string)=>void; options:string[]; listId:string; placeholder?:string; onRemember:()=>void }) {
  const exact = options.some((item) => item.localeCompare(value.trim(), undefined, { sensitivity: "accent" }) === 0);
  return <div className="block"><label><span className="mb-2 block text-sm font-black text-[#5F5068]">{label}</span><input value={value} onChange={(e)=>onChange(e.target.value)} onBlur={onRemember} list={listId} placeholder={placeholder} autoComplete="off" className="h-14 w-full rounded-2xl border border-[#E9DDEF] bg-[#FEFCFF] px-4 font-bold outline-none focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10" /></label><datalist id={listId}>{options.map((item)=><option key={item} value={item}/>)}</datalist>{value.trim() && !exact ? <p className="mt-2 text-xs font-bold text-[#8B6A97]">خيار جديد — سيتم حفظه في القائمة بعد الإدخال.</p> : null}</div>;
}

function PersonalStep({ form, setForm, cityOptions, countryOptions, rememberLocationOption }: any) { return <div><StepTitle title="البيانات الشخصية" desc="أدخل بياناتك الأساسية كما تريد أن تظهر في ملف صانع المحتوى."/><div className="grid gap-4 sm:grid-cols-2"><Field label="الاسم الكامل *" value={form.fullName} onChange={(v:string)=>setForm((f:any)=>({...f,fullName:v}))}/><Field label="رقم الجوال *" value={form.mobile} onChange={(v:string)=>setForm((f:any)=>({...f,mobile:v}))} dir="ltr"/><Field label="البريد الإلكتروني *" type="email" value={form.email} onChange={(v:string)=>setForm((f:any)=>({...f,email:v}))} dir="ltr"/><BirthDateField birthYear={form.birthYear} setBirthYear={(v)=>setForm((f:any)=>({...f,birthYear:v}))}/><SmartLocationField label="المدينة *" value={form.city} onChange={(v)=>setForm((f:any)=>({...f,city:v}))} options={cityOptions} listId="creator-city-options" placeholder="اختر من القائمة أو اكتب مدينة جديدة" onRemember={()=>rememberLocationOption("city", form.city)}/><SmartLocationField label="الدولة *" value={form.country} onChange={(v)=>setForm((f:any)=>({...f,country:v}))} options={countryOptions} listId="creator-country-options" placeholder="السعودية ودول الخليج أو اكتب دولة أخرى" onRemember={()=>rememberLocationOption("country", form.country)}/></div><div className="mt-5"><p className="mb-3 text-sm font-black text-[#5F5068]">الجنس *</p><div className="grid grid-cols-3 gap-3">{[["female","أنثى"],["male","ذكر"],["other","شيء آخر"]].map(([v,l])=><button key={v} type="button" onClick={()=>setForm((f:any)=>({...f,gender:v}))} className={`rounded-2xl border p-4 font-black ${form.gender===v?"border-[#A170BA] bg-[#F6F0F9] text-[#7F568E]":"border-[#E9DDEF]"}`}>{l}</button>)}</div></div></div>; }
function MawthooqStep({ form, setForm }: any) { return <div><StepTitle title="بيانات موثوق" desc="اختر حالة موثوق ثم أضف الرقم والتاريخ إذا كان لديك موثوق."/><div className="grid gap-3 sm:grid-cols-2">{[["yes","لدي موثوق"],["no","لا يوجد لدي موثوق"]].map(([v,l])=><button key={v} type="button" onClick={()=>setForm((f:any)=>({...f,hasMawthooq:v}))} className={`rounded-2xl border p-5 text-right font-black ${form.hasMawthooq===v?"border-[#A170BA] bg-[#F6F0F9]":"border-[#E9DDEF]"}`}>{l}</button>)}</div>{form.hasMawthooq==="yes"?<div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="رقم موثوق *" value={form.mawthooqNumber} onChange={(v:string)=>setForm((f:any)=>({...f,mawthooqNumber:v}))}/><Field label="تاريخ الانتهاء" type="date" value={form.mawthooqExpiryDate} onChange={(v:string)=>setForm((f:any)=>({...f,mawthooqExpiryDate:v}))}/></div>:null}</div>; }
function SocialStep({ rows, update, addOther }: any) { return <div><StepTitle title="حسابات التواصل الاجتماعي" desc="أضف رابط الحساب وعدد المتابعين. المقاييس الإضافية اختيارية وتبقى مرتبة داخل نفس صف المنصة."/><div className="space-y-4">{rows.map((row:SocialRow,i:number)=><div key={`${row.platform}-${i}`} className="rounded-[24px] border border-[#E0E4F2] bg-[#FEFCFF] p-4"><div className="grid gap-3 lg:grid-cols-[130px_1fr_160px_auto]"><div className="flex items-center rounded-xl bg-[#F6F0F9] px-3 font-black text-[#5363AA]">{row.platform==="Other"?<input value={row.otherPlatformName} onChange={e=>update(i,{otherPlatformName:e.target.value})} placeholder="اسم المنصة" className="w-full bg-transparent outline-none"/>:row.platform}</div><input dir="ltr" value={row.profileUrl} onChange={e=>update(i,{profileUrl:e.target.value})} placeholder="رابط الحساب" className="h-12 rounded-xl border border-[#E9DDEF] bg-white px-3 font-bold outline-none"/><input dir="ltr" inputMode="numeric" value={row.followersCount} onChange={e=>update(i,{followersCount:e.target.value})} placeholder="عدد المتابعين" className="h-12 rounded-xl border border-[#E9DDEF] bg-white px-3 font-bold outline-none"/><button type="button" onClick={()=>update(i,{advanced:!row.advanced})} className="rounded-xl border border-[#CBD2EB] px-3 text-xs font-black text-[#6170B8]">{row.advanced?"إخفاء المقاييس":"+ مقاييس أخرى"}</button></div>{row.advanced?<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["username","اسم المستخدم"],["averageViews","متوسط المشاهدات"],["averageLikes","متوسط الإعجابات"],["averageComments","متوسط التعليقات"],["engagementRate","نسبة التفاعل %"],["femaleAudience","جمهور إناث %"],["maleAudience","جمهور ذكور %"],["audienceMainCity","مدينة الجمهور"],["audienceMainCountry","دولة الجمهور"]].map(([k,p])=><input key={k} value={(row as any)[k]} onChange={e=>update(i,{[k]:e.target.value})} placeholder={p} className="h-11 rounded-xl border border-[#E9DDEF] bg-white px-3 text-sm font-bold outline-none"/>)}</div>:null}</div>)}</div><button type="button" onClick={addOther} className="mt-5 rounded-2xl border border-dashed border-[#AAB4DE] px-5 py-3 font-black text-[#A06DB9]">+ إضافة منصة أخرى</button></div>; }
function CheckGroup({ title, values, selected, onToggle }: any) { return <div><h3 className="mb-3 text-base font-black text-[#4C4052]">{title}</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{values.map((v:string)=><label key={v} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${selected.includes(v)?"border-[#A170BA] bg-[#F6F0F9] text-[#7F568E]":"border-[#E0E4F2]"}`}><input type="checkbox" checked={selected.includes(v)} onChange={()=>onToggle(v)} className="h-4 w-4 accent-[#A06DB9]"/>{v}</label>)}</div></div>; }
function PreferencesStep({ form, toggle }: any) { return <div><StepTitle title="تفضيلات المحتوى والتصوير" desc="اختر ما يناسبك. يمكنك تحديد أكثر من خيار في كل مجموعة."/><div className="space-y-7"><CheckGroup title="مجالات التعاون" values={categories} selected={form.preferredAdCategories} onToggle={(v:string)=>toggle("preferredAdCategories",v)}/><CheckGroup title="أنواع المحتوى" values={contentTypes} selected={form.contentStylePreference} onToggle={(v:string)=>toggle("contentStylePreference",v)}/><CheckGroup title="أسلوب التصوير" values={shootingStyles} selected={form.shootingStylePreferences} onToggle={(v:string)=>toggle("shootingStylePreferences",v)}/></div></div>; }
function ReviewStep({ form, social }: any) { const active=social.filter((x:SocialRow)=>x.profileUrl||x.username); return <div><StepTitle title="مراجعة وإرسال" desc="راجع بياناتك قبل إرسالها لفريق دار الأميرات."/><div className="grid gap-4 sm:grid-cols-2"><Summary title="البيانات الشخصية" lines={[form.fullName,form.mobile,form.email,`${form.birthYear} • ${form.city}`]}/><Summary title="موثوق" lines={[form.hasMawthooq==="yes"?`لدي موثوق: ${form.mawthooqNumber}`:"لا يوجد موثوق"]}/><Summary title="حسابات التواصل" lines={active.map((x:SocialRow)=>`${x.platform==="Other"?x.otherPlatformName:x.platform}: ${x.followersCount||"—"} متابع`)}/><Summary title="التفضيلات" lines={[...form.preferredAdCategories,...form.contentStylePreference,...form.shootingStylePreferences]}/></div><div className="mt-5 rounded-2xl bg-[#FCF9FD] p-4 text-sm font-bold leading-7 text-[#756A7A]">إرسال الطلب لا يفعّل البوابة مباشرة. سيقوم الموظف بالمراجعة ثم يوافق، يطلب تعديلًا، أو يرفض. لا يتم إرسال بريد إلكتروني؛ رابط التفعيل أو التعديل يرسله الموظف لك بالطريقة المناسبة.</div></div>; }
function Summary({title,lines}:{title:string;lines:string[]}) { return <div className="rounded-2xl border border-[#E0E4F2] p-5"><h3 className="font-black">{title}</h3><div className="mt-3 space-y-1 text-sm font-semibold text-[#78819F]">{lines.filter(Boolean).map((x,i)=><p key={`${x}-${i}`}>{x}</p>)}</div></div>; }
function StepTitle({title,desc}:{title:string;desc:string}) { return <div className="mb-7"><p className="text-sm font-black text-[#A170BA]">استكمال الملف</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2><p className="mt-2 text-sm font-semibold leading-7 text-[#806F8A]">{desc}</p></div>; }
