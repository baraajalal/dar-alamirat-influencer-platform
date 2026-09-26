"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackModal from "@/components/feedback-modal";
import type { AppLocale } from "@/lib/i18n/app";
import type { AppDictionary } from "@/lib/i18n/app-dictionary";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

type Gender = "" | "female" | "male" | "other";
type FieldErrors = Record<string, string>;
type LocationKind = "city" | "country";
type LegalConsentState = { termsAccepted: boolean; privacyAccepted: boolean };
type OnboardingCopy = AppDictionary["onboarding"];
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
const defaultCountries = ["Saudi Arabia", "United Arab Emirates", "Kuwait", "Bahrain", "Qatar", "Oman"];
const defaultCities = ["Riyadh", "Jeddah", "Makkah", "Madinah", "Dammam", "Khobar", "Dhahran", "Taif", "Tabuk", "Abha", "Khamis Mushait", "Buraidah", "Hail", "Jubail", "Al Ahsa"];

export default function InfluencerOnboardingWizard({ editToken, locale, copy }: { editToken?: string; locale: AppLocale; copy: OnboardingCopy }) {
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [legalConsent, setLegalConsent] = useState<LegalConsentState>({ termsAccepted: false, privacyAccepted: false });

  const clearFieldError = useCallback((path: string) => {
    setFieldErrors((current) => {
      if (!current[path]) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }, []);

  const fieldLabel = useCallback((path: string) => {
    const labels: Record<string, string> = {
      "influencer.fullName": copy.fieldLabels.fullName,
      "influencer.mobile": copy.fieldLabels.mobile,
      "influencer.email": copy.fieldLabels.email,
      "influencer.gender": copy.fieldLabels.gender,
      "influencer.birthYear": copy.fieldLabels.birthYear,
      "influencer.city": copy.fieldLabels.city,
      "influencer.country": copy.fieldLabels.country,
      "influencer.hasMawthooq": copy.fieldLabels.hasMawthooq,
      "influencer.mawthooqNumber": copy.fieldLabels.mawthooqNumber,
      "influencer.preferredAdCategories": copy.fieldLabels.categories,
      "influencer.contentStylePreference": copy.fieldLabels.contentTypes,
      "influencer.shootingStylePreferences": copy.fieldLabels.shootingStyles,
      "socialAccounts": copy.fieldLabels.social,
      "consent.termsAccepted": copy.fieldLabels.terms,
      "consent.privacyAccepted": copy.fieldLabels.privacy,
    };
    if (labels[path]) return labels[path];
    if (path.startsWith("socialAccounts.")) return copy.fieldLabels.social;
    return copy.fieldLabels.unknown;
  }, [copy]);

  const stepForPath = useCallback((path: string) => {
    if (path.startsWith("influencer.hasMawthooq") || path.startsWith("influencer.mawthooq")) return 1;
    if (path.startsWith("socialAccounts")) return 2;
    if (path.startsWith("consent.")) return 4;
    if (path.includes("preferredAdCategories") || path.includes("contentStylePreference") || path.includes("shootingStylePreferences")) return 3;
    return 0;
  }, []);

  const focusProblemField = useCallback((path: string) => {
    setStep(stepForPath(path));
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-field-path="${path}"]`)
        || document.querySelector<HTMLElement>(`[data-field-path^="${path.split(".").slice(0,2).join(".")}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    }, 120);
  }, [stepForPath]);

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

  const presentFieldErrors = useCallback((issues: FieldErrors, fallbackMessage: string) => {
    const entries = Object.entries(issues).filter(([, value]) => Boolean(value));
    if (!entries.length) {
      showError(fallbackMessage);
      return;
    }
    setFieldErrors(issues);
    const [firstPath, firstMessage] = entries[0];
    focusProblemField(firstPath);
    showError(`${copy.validation.problemPrefix} ${fieldLabel(firstPath)}: ${firstMessage}`);
  }, [copy.validation.problemPrefix, fieldLabel, focusProblemField, showError]);

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    if (closeDestination) window.location.replace(closeDestination);
  }, [closeDestination]);

  useEffect(() => {
    if (!editToken) return;
    fetch(`/api/portal-access/edit?token=${encodeURIComponent(editToken)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(locale === "ar" ? data.message || copy.api.loadFailed : copy.api.loadFailed);
        return data;
      })
      .then((data) => {
        setForm({ ...initialForm, ...data.influencer });
        const rows = (data.socialAccounts || []).map((item: Partial<SocialRow> & { platform?: string }) => ({ ...makeRow(item.platform || "Other"), ...item, advanced: false }));
        setSocial(rows.length ? rows : platforms.map(makeRow));
        setReviewNotes(data.reviewNotes || "");
      })
      .catch((error) => showError(error instanceof Error ? error.message : copy.api.loadFailed, "/"))
      .finally(() => setLoading(false));
  }, [copy.api.loadFailed, editToken, locale, showError]);

  useEffect(() => {
    fetch("/api/portal-access/location-options", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.cities)) setCityOptions(Array.from(new Set([...defaultCities, ...data.cities.filter((x: unknown): x is string => typeof x === "string")])));
        if (Array.isArray(data.countries)) setCountryOptions(Array.from(new Set([...defaultCountries, ...data.countries.filter((x: unknown): x is string => typeof x === "string")])));
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
      // Lookup enrichment must never block onboarding.
    }
  }, [form.mobile]);

  const completion = useMemo(() => {
    const checks = [Boolean(form.fullName), Boolean(form.mobile), Boolean(form.email), Boolean(form.gender), Boolean(form.birthYear), Boolean(form.city), Boolean(form.hasMawthooq), form.hasMawthooq === "no" || Boolean(form.mawthooqNumber), social.some((item) => item.profileUrl || item.username), form.preferredAdCategories.length > 0, form.contentStylePreference.length > 0, form.shootingStylePreferences.length > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, social]);

  function toggle(key: "preferredAdCategories" | "contentStylePreference" | "shootingStylePreferences", value: string) {
    setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  }
  function updateSocial(index: number, patch: Partial<SocialRow>) { setSocial((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  function addOtherPlatform() { setSocial((rows) => [...rows, makeRow("Other")]); }

  function validateCurrent(): { message: string; issues: FieldErrors } {
    const issues: FieldErrors = {};
    if (step === 0) {
      if (!form.fullName.trim()) issues["influencer.fullName"] = copy.validation.fullNameRequired;
      const mobileDigits = form.mobile.replace(/\D/g, "");
      const validMobile = /^(?:05\d{8}|5\d{8}|9665\d{8}|009665\d{8})$/.test(mobileDigits);
      if (!form.mobile.trim()) issues["influencer.mobile"] = copy.validation.mobileRequired;
      else if (!validMobile) issues["influencer.mobile"] = copy.validation.mobileInvalid;
      if (!form.email.trim()) issues["influencer.email"] = copy.validation.emailRequired;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) issues["influencer.email"] = copy.validation.emailInvalid;
      if (!form.gender) issues["influencer.gender"] = copy.validation.genderRequired;
      if (!form.birthYear) issues["influencer.birthYear"] = copy.validation.birthYearRequired;
      if (!form.city.trim()) issues["influencer.city"] = copy.validation.cityRequired;
      if (!form.country.trim()) issues["influencer.country"] = copy.validation.countryRequired;
    }
    if (step === 1) {
      if (!form.hasMawthooq) issues["influencer.hasMawthooq"] = copy.validation.mawthooqStatusRequired;
      if (form.hasMawthooq === "yes" && !form.mawthooqNumber.trim()) issues["influencer.mawthooqNumber"] = copy.validation.mawthooqNumberRequired;
    }
    if (step === 2 && !social.some((row) => row.profileUrl.trim() || row.username.trim())) issues.socialAccounts = copy.validation.socialRequired;
    if (step === 3) {
      if (!form.preferredAdCategories.length) issues["influencer.preferredAdCategories"] = copy.validation.categoryRequired;
      if (!form.contentStylePreference.length) issues["influencer.contentStylePreference"] = copy.validation.contentTypeRequired;
      if (!form.shootingStylePreferences.length) issues["influencer.shootingStylePreferences"] = copy.validation.shootingStyleRequired;
    }
    if (step === 4 && !editToken) {
      if (!legalConsent.termsAccepted) issues["consent.termsAccepted"] = copy.validation.termsRequired;
      if (!legalConsent.privacyAccepted) issues["consent.privacyAccepted"] = copy.validation.privacyRequired;
    }
    return { message: Object.values(issues)[0] || "", issues };
  }

  function next() {
    const validation = validateCurrent();
    if (validation.message) { presentFieldErrors(validation.issues, validation.message); return; }
    setFieldErrors({});
    if (step === 0) {
      void rememberLocationOption("city", form.city);
      void rememberLocationOption("country", form.country);
    }
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const validation = validateCurrent();
    if (validation.message) { presentFieldErrors(validation.issues, validation.message); return; }
    setFieldErrors({});
    setSubmitting(true);
    setMessage("");
    const activeSocial = social.filter((row) => row.profileUrl.trim() || row.username.trim());
    const payload = {
      influencer: { ...form, nationalId: "", bankName: "", iban: "", accountHolderName: "" },
      socialAccounts: activeSocial.map(({ advanced, ...row }) => row),
      consent: editToken ? undefined : {
        termsAccepted: legalConsent.termsAccepted,
        privacyAccepted: legalConsent.privacyAccepted,
        locale,
      },
      website: "",
    };
    try {
      const endpoint = editToken ? "/api/portal-access/edit" : "/api/submit-influencer";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editToken ? { token: editToken, payload } : payload) });
      const result = await response.json();
      if (!response.ok) {
        const issues = (result.issues && typeof result.issues === "object") ? result.issues as FieldErrors : {};
        presentFieldErrors(issues, locale === "ar" ? result.message || copy.api.saveFailed : copy.api.saveFailed);
        return;
      }
      // New registrations are now staged first. The API either sends a true new creator
      // to the existing activation-review flow, or holds a possible archive match for
      // an admin-only identity decision. Do not create a second portal request here.
      const successMessage = editToken
        ? copy.api.editSuccess
        : (typeof result.message === "string" && result.message.trim() ? result.message : copy.api.newSuccess);
      showSuccess(successMessage, "/");
      setStep(4);
    } catch (error) {
      showError(error instanceof Error && locale === "ar" ? error.message : copy.api.unexpected);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main data-no-auto-translate dir="inherit" className="min-h-screen bg-[#FCF9FD] p-10 text-center font-bold text-[#756A7A]">{copy.loading}</main>;

  return (
    <main data-no-auto-translate dir="inherit" className="min-h-screen bg-[linear-gradient(135deg,#F8F9FE,#EEF1FA)] px-4 py-7 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#432A57]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-white bg-white/90 px-5 py-4 shadow-sm">
          <div><p className="text-xs font-black text-[#8790AE]">{copy.headerLabel}</p><h1 className="mt-1 text-xl font-black">{editToken ? copy.editTitle : copy.newTitle}</h1></div>
          <Link href="/login" className="rounded-xl border border-[#D9DEF1] px-4 py-2 text-sm font-black text-[#A06DB9]">{copy.hasAccount}</Link>
        </header>
        {reviewNotes ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-800"><b>{copy.employeeNotes}</b> {reviewNotes}</div> : null}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-[28px] bg-[linear-gradient(145deg,#B682C5,#7F568E)] p-6 text-white shadow-[0_20px_50px_rgba(79,96,182,.2)] lg:sticky lg:top-6">
            <p className="text-sm font-black text-white/70">{copy.completion}</p><div className="mt-3 text-3xl font-black">{completion}%</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${completion}%` }} /></div>
            <div className="mt-7 space-y-2">{copy.steps.map((label, i) => <button type="button" key={label} onClick={() => i <= step && setStep(i)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-start text-sm font-bold ${i === step ? "bg-white text-[#7F568E]" : "text-white/80"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${i < step ? "bg-emerald-400 text-white" : i === step ? "bg-[#F6F0F9]" : "bg-white/10"}`}>{i < step ? "✓" : i + 1}</span>{label}</button>)}</div>
          </aside>
          <section className="rounded-[30px] border border-[#E0E4F2] bg-white p-5 shadow-[0_18px_55px_rgba(67,82,155,.08)] sm:p-8">
            {step === 0 && <PersonalStep form={form} setForm={setForm} cityOptions={cityOptions} countryOptions={countryOptions} rememberLocationOption={rememberLocationOption} errors={fieldErrors} clearError={clearFieldError} copy={copy} />}
            {step === 1 && <MawthooqStep form={form} setForm={setForm} errors={fieldErrors} clearError={clearFieldError} copy={copy} />}
            {step === 2 && <SocialStep rows={social} update={updateSocial} addOther={addOtherPlatform} copy={copy} />}
            {step === 3 && <PreferencesStep form={form} toggle={toggle} copy={copy} />}
            {step === 4 && <ReviewStep form={form} social={social} legalConsent={legalConsent} setLegalConsent={setLegalConsent} errors={fieldErrors} clearError={clearFieldError} editMode={Boolean(editToken)} copy={copy} />}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#EEF0F6] pt-6">
              <button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-2xl border border-[#D8DDF0] px-6 py-3 font-black text-[#66739C] disabled:opacity-40">{copy.previous}</button>
              {step < 4 ? <button type="button" onClick={next} className="rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-8 py-3 font-black text-white shadow-lg">{copy.next}</button> : <button type="button" disabled={submitting} onClick={submit} className="rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-8 py-3 font-black text-white shadow-lg disabled:opacity-60">{submitting ? copy.saving : editToken ? copy.resubmit : copy.submit}</button>}
            </div>
          </section>
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} type={feedbackType} title={feedbackType === "success" ? copy.successTitle : copy.errorTitle} message={message} onClose={closeFeedback} closeLabel={closeDestination && editToken ? copy.closeLink : copy.okay} />
    </main>
  );
}

function Field({ label, value, onChange, type="text", dir, placeholder, list, fieldPath, error, onClearError }: any) { return <label className="block" data-field-path={fieldPath}><span className={`mb-2 block text-sm font-black ${error ? "text-red-600" : "text-[#5F5068]"}`}>{label}</span><input type={type} value={value} onChange={(event) => { onChange(event.target.value); if (error) onClearError?.(fieldPath); }} dir={dir} placeholder={placeholder} list={list} aria-invalid={Boolean(error)} className={`h-14 w-full rounded-2xl border bg-[#FEFCFF] px-4 font-bold outline-none transition ${error ? "border-red-500 ring-4 ring-red-500/10 hover:border-red-600 focus:border-red-600 focus:ring-red-500/15" : "border-[#E9DDEF] focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10"}`} />{error ? <span className="mt-2 block text-xs font-bold text-red-600">{error}</span> : null}</label>; }

function BirthDateField({ birthYear, setBirthYear, error, onClearError, label }: { birthYear: string; setBirthYear: (value: string) => void; error?: string; onClearError?: () => void; label: string }) {
  const [dateValue, setDateValue] = useState(() => /^\d{4}$/.test(birthYear || "") ? `${birthYear}-01-01` : "");
  useEffect(() => { if (/^\d{4}$/.test(birthYear || "") && !dateValue) setDateValue(`${birthYear}-01-01`); }, [birthYear, dateValue]);
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  return <label className="block" data-field-path="influencer.birthYear"><span className={`mb-2 block text-sm font-black ${error ? "text-red-600" : "text-[#5F5068]"}`}>{label}</span><input type="date" value={dateValue} max={maxDate} onChange={(event) => { setDateValue(event.target.value); setBirthYear(event.target.value ? event.target.value.slice(0,4) : ""); if (error) onClearError?.(); }} aria-invalid={Boolean(error)} className={`h-14 w-full rounded-2xl border bg-[#FEFCFF] px-4 font-bold outline-none transition ${error ? "border-red-500 ring-4 ring-red-500/10 hover:border-red-600 focus:border-red-600" : "border-[#E9DDEF] focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10"}`} />{error ? <span className="mt-2 block text-xs font-bold text-red-600">{error}</span> : null}</label>;
}

function SmartLocationField({ label, value, onChange, options, listId, placeholder, onRemember, fieldPath, error, onClearError, newOptionText }: { label:string; value:string; onChange:(value:string)=>void; options:string[]; listId:string; placeholder?:string; onRemember:()=>void; fieldPath:string; error?:string; onClearError?:()=>void; newOptionText:string }) {
  const exact = options.some((item) => item.localeCompare(value.trim(), undefined, { sensitivity: "accent" }) === 0);
  return <div className="block" data-field-path={fieldPath}><label><span className={`mb-2 block text-sm font-black ${error ? "text-red-600" : "text-[#5F5068]"}`}>{label}</span><input value={value} onChange={(event) => { onChange(event.target.value); if (error) onClearError?.(); }} onBlur={onRemember} list={listId} placeholder={placeholder} autoComplete="off" aria-invalid={Boolean(error)} className={`h-14 w-full rounded-2xl border bg-[#FEFCFF] px-4 font-bold outline-none transition ${error ? "border-red-500 ring-4 ring-red-500/10 hover:border-red-600 focus:border-red-600" : "border-[#E9DDEF] focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10"}`} /></label>{error ? <span className="mt-2 block text-xs font-bold text-red-600">{error}</span> : null}<datalist id={listId}>{options.map((item) => <option key={item} value={item}/>)}</datalist>{value.trim() && !exact ? <p className="mt-2 text-xs font-bold text-[#8B6A97]">{newOptionText}</p> : null}</div>;
}

function PersonalStep({ form, setForm, cityOptions, countryOptions, rememberLocationOption, errors, clearError, copy }: any) {
  const genderOptions = [["female", copy.personal.female], ["male", copy.personal.male], ["other", copy.personal.other]];
  return <div><StepTitle title={copy.personal.title} desc={copy.personal.description} eyebrow={copy.completion}/><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.personal.fullName} fieldPath="influencer.fullName" error={errors["influencer.fullName"]} onClearError={clearError} value={form.fullName} onChange={(value:string) => setForm((current:FormState) => ({...current,fullName:value}))}/><Field label={copy.personal.mobile} fieldPath="influencer.mobile" error={errors["influencer.mobile"]} onClearError={clearError} value={form.mobile} onChange={(value:string) => setForm((current:FormState) => ({...current,mobile:value}))} dir="ltr"/><Field label={copy.personal.email} fieldPath="influencer.email" error={errors["influencer.email"]} onClearError={clearError} type="email" value={form.email} onChange={(value:string) => setForm((current:FormState) => ({...current,email:value}))} dir="ltr"/><BirthDateField label={copy.personal.birthYear} birthYear={form.birthYear} setBirthYear={(value) => setForm((current:FormState) => ({...current,birthYear:value}))} error={errors["influencer.birthYear"]} onClearError={() => clearError("influencer.birthYear")}/><SmartLocationField label={copy.personal.city} fieldPath="influencer.city" error={errors["influencer.city"]} onClearError={() => clearError("influencer.city")} value={form.city} onChange={(value) => setForm((current:FormState) => ({...current,city:value}))} options={cityOptions} listId="creator-city-options" placeholder={copy.personal.cityPlaceholder} onRemember={() => rememberLocationOption("city", form.city)} newOptionText={copy.newLocationOption}/><SmartLocationField label={copy.personal.country} fieldPath="influencer.country" error={errors["influencer.country"]} onClearError={() => clearError("influencer.country")} value={form.country} onChange={(value) => setForm((current:FormState) => ({...current,country:value}))} options={countryOptions} listId="creator-country-options" placeholder={copy.personal.countryPlaceholder} onRemember={() => rememberLocationOption("country", form.country)} newOptionText={copy.newLocationOption}/></div><div className={`mt-5 rounded-2xl ${errors["influencer.gender"] ? "border border-red-500 p-3" : ""}`} data-field-path="influencer.gender"><p className={`mb-3 text-sm font-black ${errors["influencer.gender"] ? "text-red-600" : "text-[#5F5068]"}`}>{copy.personal.gender}</p><div className="grid grid-cols-3 gap-3">{genderOptions.map(([value,label]) => <button key={value} type="button" onClick={() => { setForm((current:FormState) => ({...current,gender:value as Gender})); clearError("influencer.gender"); }} className={`rounded-2xl border p-4 font-black ${form.gender===value ? "border-[#A170BA] bg-[#F6F0F9] text-[#7F568E]" : "border-[#E9DDEF]"}`}>{label}</button>)}</div>{errors["influencer.gender"] ? <p className="mt-2 text-xs font-bold text-red-600">{errors["influencer.gender"]}</p> : null}</div></div>;
}

function MawthooqStep({ form, setForm, errors, clearError, copy }: any) {
  return <div><StepTitle title={copy.mawthooq.title} desc={copy.mawthooq.description} eyebrow={copy.completion}/><div data-field-path="influencer.hasMawthooq" className={`grid gap-3 rounded-2xl sm:grid-cols-2 ${errors["influencer.hasMawthooq"] ? "border border-red-500 p-3" : ""}`}>{[["yes",copy.mawthooq.yes],["no",copy.mawthooq.no]].map(([value,label]) => <button key={value} type="button" onClick={() => { setForm((current:FormState) => ({...current,hasMawthooq:value as "yes"|"no"})); clearError("influencer.hasMawthooq"); }} className={`rounded-2xl border p-5 text-start font-black ${form.hasMawthooq===value ? "border-[#A170BA] bg-[#F6F0F9]" : "border-[#D9DEF0]"}`}>{label}</button>)}</div>{errors["influencer.hasMawthooq"] ? <p className="mt-2 text-xs font-bold text-red-600">{errors["influencer.hasMawthooq"]}</p> : null}{form.hasMawthooq==="yes" ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={copy.mawthooq.number} fieldPath="influencer.mawthooqNumber" error={errors["influencer.mawthooqNumber"]} onClearError={clearError} value={form.mawthooqNumber} onChange={(value:string) => setForm((current:FormState) => ({...current,mawthooqNumber:value}))}/><Field label={copy.mawthooq.expiry} type="date" fieldPath="influencer.mawthooqExpiryDate" value={form.mawthooqExpiryDate} onChange={(value:string) => setForm((current:FormState) => ({...current,mawthooqExpiryDate:value}))}/></div> : null}</div>;
}

function SocialStep({ rows, update, addOther, copy }: { rows: SocialRow[]; update: (index:number, patch:Partial<SocialRow>)=>void; addOther:()=>void; copy:OnboardingCopy }) {
  const metrics = Object.entries(copy.social.metrics) as Array<[keyof SocialRow, string]>;
  return <div><StepTitle title={copy.social.title} desc={copy.social.description} eyebrow={copy.completion}/><div className="space-y-4">{rows.map((row,index) => <div key={`${row.platform}-${index}`} className="rounded-[24px] border border-[#E0E4F2] bg-[#FEFCFF] p-4"><div className="grid gap-3 lg:grid-cols-[130px_1fr_160px_auto]"><div className="flex items-center rounded-xl bg-[#F6F0F9] px-3 font-black text-[#5363AA]">{row.platform==="Other" ? <input value={row.otherPlatformName} onChange={(event) => update(index,{otherPlatformName:event.target.value})} placeholder={copy.social.platformName} className="w-full bg-transparent outline-none"/> : row.platform}</div><input dir="ltr" value={row.profileUrl} onChange={(event) => update(index,{profileUrl:event.target.value})} placeholder={copy.social.profileUrl} className="h-12 rounded-xl border border-[#E9DDEF] bg-white px-3 font-bold outline-none"/><input dir="ltr" inputMode="numeric" value={row.followersCount} onChange={(event) => update(index,{followersCount:event.target.value})} placeholder={copy.social.followers} className="h-12 rounded-xl border border-[#E9DDEF] bg-white px-3 font-bold outline-none"/><button type="button" onClick={() => update(index,{advanced:!row.advanced})} className="rounded-xl border border-[#CBD2EB] px-3 text-xs font-black text-[#6170B8]">{row.advanced ? copy.social.hideMetrics : copy.social.moreMetrics}</button></div>{row.advanced ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([key,placeholder]) => <input key={String(key)} value={String(row[key] ?? "")} onChange={(event) => update(index,{[key]:event.target.value})} placeholder={placeholder} className="h-11 rounded-xl border border-[#E9DDEF] bg-white px-3 text-sm font-bold outline-none"/>)}</div> : null}</div>)}</div><button type="button" onClick={addOther} className="mt-5 rounded-2xl border border-dashed border-[#AAB4DE] px-5 py-3 font-black text-[#A06DB9]">{copy.social.addPlatform}</button></div>;
}

function CheckGroup({ title, values, labels, selected, onToggle }: { title:string; values:string[]; labels:Record<string,string>; selected:string[]; onToggle:(value:string)=>void }) { return <div><h3 className="mb-3 text-base font-black text-[#4C4052]">{title}</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{values.map((value) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-bold ${selected.includes(value) ? "border-[#A170BA] bg-[#F6F0F9] text-[#7F568E]" : "border-[#E0E4F2]"}`}><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="h-4 w-4 accent-[#A06DB9]"/>{labels[value] ?? value}</label>)}</div></div>; }

function PreferencesStep({ form, toggle, copy }: { form:FormState; toggle:(key:"preferredAdCategories"|"contentStylePreference"|"shootingStylePreferences",value:string)=>void; copy:OnboardingCopy }) { return <div><StepTitle title={copy.preferences.title} desc={copy.preferences.description} eyebrow={copy.completion}/><div className="space-y-7"><CheckGroup title={copy.preferences.categories} values={categories} labels={copy.preferences.categoryLabels as Record<string,string>} selected={form.preferredAdCategories} onToggle={(value) => toggle("preferredAdCategories",value)}/><CheckGroup title={copy.preferences.contentTypes} values={contentTypes} labels={copy.preferences.contentTypeLabels as Record<string,string>} selected={form.contentStylePreference} onToggle={(value) => toggle("contentStylePreference",value)}/><CheckGroup title={copy.preferences.shootingStyles} values={shootingStyles} labels={copy.preferences.shootingStyleLabels as Record<string,string>} selected={form.shootingStylePreferences} onToggle={(value) => toggle("shootingStylePreferences",value)}/></div></div>; }

function ReviewStep({ form, social, legalConsent, setLegalConsent, errors, clearError, editMode, copy }: { form:FormState; social:SocialRow[]; legalConsent:LegalConsentState; setLegalConsent:React.Dispatch<React.SetStateAction<LegalConsentState>>; errors:FieldErrors; clearError:(path:string)=>void; editMode:boolean; copy:OnboardingCopy }) {
  const active = social.filter((item) => item.profileUrl || item.username);
  const categoryLabels = copy.preferences.categoryLabels as Record<string,string>;
  const contentLabels = copy.preferences.contentTypeLabels as Record<string,string>;
  const shootingLabels = copy.preferences.shootingStyleLabels as Record<string,string>;
  const preferenceLines = [
    ...form.preferredAdCategories.map((value) => categoryLabels[value] ?? value),
    ...form.contentStylePreference.map((value) => contentLabels[value] ?? value),
    ...form.shootingStylePreferences.map((value) => shootingLabels[value] ?? value),
  ];
  return <div>
    <StepTitle title={copy.review.title} desc={copy.review.description} eyebrow={copy.completion}/>
    <div className="grid gap-4 sm:grid-cols-2">
      <Summary title={copy.review.personal} lines={[form.fullName,form.mobile,form.email,`${form.birthYear} • ${form.city}`]}/>
      <Summary title={copy.review.mawthooq} lines={[form.hasMawthooq==="yes" ? `${copy.review.mawthooqYes} ${form.mawthooqNumber}` : copy.review.mawthooqNo]}/>
      <Summary title={copy.review.social} lines={active.map((item) => `${item.platform==="Other" ? item.otherPlatformName : item.platform}: ${item.followersCount || "—"} ${copy.review.followerSuffix}`)}/>
      <Summary title={copy.review.preferences} lines={preferenceLines}/>
    </div>
    {!editMode ? <section className="mt-5 rounded-2xl border border-[#E5D8EB] bg-[#FCF9FD] p-5">
      <h3 className="font-black text-[#4C3658]">{copy.review.consentsTitle}</h3>
      <p className="mt-2 text-xs font-bold leading-6 text-[#817187]">{copy.review.consentsDescription}</p>
      <div className="mt-4 space-y-3">
        <label data-field-path="consent.termsAccepted" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${errors["consent.termsAccepted"] ? "border-red-500 bg-red-50" : "border-[#E8DDED] bg-white"}`}>
          <input type="checkbox" checked={legalConsent.termsAccepted} onChange={(event) => { setLegalConsent((current) => ({...current,termsAccepted:event.target.checked})); clearError("consent.termsAccepted"); }} className="mt-1 h-4 w-4 accent-[#A06DB9]"/>
          <span className="text-sm font-bold leading-7">{copy.review.agreePrefix} <Link href="/terms" target="_blank" className="font-black text-[#8A58A3] underline">{copy.review.terms}</Link> <span dir="ltr" className="text-xs text-[#9A8AA0]">({LEGAL_DOCUMENT_VERSIONS.terms})</span>.</span>
        </label>
        {errors["consent.termsAccepted"] ? <p className="text-xs font-bold text-red-600">{errors["consent.termsAccepted"]}</p> : null}
        <label data-field-path="consent.privacyAccepted" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${errors["consent.privacyAccepted"] ? "border-red-500 bg-red-50" : "border-[#E8DDED] bg-white"}`}>
          <input type="checkbox" checked={legalConsent.privacyAccepted} onChange={(event) => { setLegalConsent((current) => ({...current,privacyAccepted:event.target.checked})); clearError("consent.privacyAccepted"); }} className="mt-1 h-4 w-4 accent-[#A06DB9]"/>
          <span className="text-sm font-bold leading-7">{copy.review.agreePrefix} <Link href="/privacy" target="_blank" className="font-black text-[#8A58A3] underline">{copy.review.privacy}</Link> <span dir="ltr" className="text-xs text-[#9A8AA0]">({LEGAL_DOCUMENT_VERSIONS.privacy})</span>.</span>
        </label>
        {errors["consent.privacyAccepted"] ? <p className="text-xs font-bold text-red-600">{errors["consent.privacyAccepted"]}</p> : null}
      </div>
    </section> : null}
    <div className="mt-5 rounded-2xl bg-[#FCF9FD] p-4 text-sm font-bold leading-7 text-[#756A7A]">{copy.review.workflowNote}</div>
  </div>;
}

function Summary({title,lines}:{title:string;lines:string[]}) { return <div className="rounded-2xl border border-[#E0E4F2] p-5"><h3 className="font-black">{title}</h3><div className="mt-3 space-y-1 text-sm font-semibold text-[#78819F]">{lines.filter(Boolean).map((line,index) => <p key={`${line}-${index}`}>{line}</p>)}</div></div>; }
function StepTitle({title,desc,eyebrow}:{title:string;desc:string;eyebrow:string}) { return <div className="mb-7"><p className="text-sm font-black text-[#A170BA]">{eyebrow}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2><p className="mt-2 text-sm font-semibold leading-7 text-[#806F8A]">{desc}</p></div>; }
