"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Gender = "" | "female" | "male";

type InfluencerForm = {
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  country: string;
  gender: Gender;
  nationalId: string;
  hasMawthooq: "" | "yes" | "no";
  bankName: string;
  iban: string;
  accountHolderName: string;
  mawthooqNumber: string;
  mawthooqExpiryDate: string;
  preferredAdCategories: string[];
  contentStylePreference: string[];
};

type SocialAccount = {
  recordId?: string;
  platform: string;
  username: string;
  profileUrl: string;
  followersCount: string;
  averageLikes: string;
  averageViews: string;
  averageComments: string;
  engagementRate: string;
  femaleAudience: string;
  maleAudience: string;
  audienceMainCity: string;
  audienceMainCountry: string;
};

type LookupResult = {
  success: boolean;
  exists: boolean;
  matchSource: "active" | "archive" | "multiple" | "none";
  hasAccount: boolean;
  profileCompletion?: number;
  portalAccessRequested?: boolean;
  message?: string;
  influencer?: Partial<InfluencerForm> | null;
  socialAccounts?: SocialAccount[];
};

const emptyInfluencerForm: InfluencerForm = {
  fullName: "",
  mobile: "",
  email: "",
  city: "",
  country: "Saudi Arabia",
  gender: "",
  nationalId: "",
  hasMawthooq: "",
  bankName: "",
  iban: "",
  accountHolderName: "",
  mawthooqNumber: "",
  mawthooqExpiryDate: "",
  preferredAdCategories: [],
  contentStylePreference: [],
};

const emptySocialAccount: SocialAccount = {
  platform: "",
  username: "",
  profileUrl: "",
  followersCount: "",
  averageLikes: "",
  averageViews: "",
  averageComments: "",
  engagementRate: "",
  femaleAudience: "",
  maleAudience: "",
  audienceMainCity: "",
  audienceMainCountry: "",
};

const countries = [
  "Saudi Arabia",
  "United Arab Emirates",
  "Kuwait",
  "Qatar",
  "Bahrain",
  "Oman",
  "Other",
];

const citiesByCountry: Record<string, string[]> = {
  "Saudi Arabia": [
    "Riyadh",
    "Jeddah",
    "Makkah",
    "Madinah",
    "Dammam",
    "Khobar",
    "Dhahran",
    "Taif",
    "Abha",
    "Khamis Mushait",
    "Tabuk",
    "Hail",
    "Qassim",
    "Jazan",
    "Najran",
    "Al Ahsa",
    "Yanbu",
    "Other",
  ],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Other"],
  Kuwait: ["Kuwait City", "Hawalli", "Salmiya", "Other"],
  Qatar: ["Doha", "Al Rayyan", "Other"],
  Bahrain: ["Manama", "Riffa", "Other"],
  Oman: ["Muscat", "Salalah", "Other"],
  Other: ["Other"],
};

const platformOptions = [
  "Instagram",
  "TikTok",
  "Snapchat",
  "YouTube",
  "X",
  "Facebook",
  "Other",
];

const preferredAdCategoryOptions = [
  "Beauty",
  "Skincare",
  "Haircare",
  "Perfume",
  "Fashion",
  "Lifestyle",
  "Restaurants",
  "Cafes",
  "Travel",
  "Mother & Baby",
  "Fitness",
  "Technology",
  "Home",
  "Events",
  "Other",
];

const contentStyleOptions = [
  "Reels",
  "Story",
  "Post",
  "Snap",
  "TikTok Video",
  "YouTube Short",
  "Live",
  "Visit",
  "Review",
  "Unboxing",
  "Giveaway",
  "Promo Code",
];

function hasDraft(account: SocialAccount) {
  return Object.values(account).some((value) => String(value ?? "").trim() !== "");
}

function completionDetails(form: InfluencerForm, accounts: SocialAccount[]) {
  let score = 0;
  const missing: string[] = [];

  if (form.fullName.trim()) score += 10;
  else missing.push("الاسم");

  if (/^(?:05\d{8}|5\d{8}|9665\d{8})$/.test(form.mobile.replace(/\D/g, ""))) {
    score += 10;
  } else {
    missing.push("رقم الجوال");
  }

  if (form.city.trim()) score += 5;
  else missing.push("المدينة");

  if (form.country.trim()) score += 5;
  if (form.gender) score += 5;
  else missing.push("الجنس");

  const basicSocial = accounts.some(
    (account) => account.platform && account.username.trim(),
  );
  if (basicSocial) score += 25;
  else missing.push("حساب تواصل");

  if (accounts.some((account) => account.profileUrl.trim())) score += 5;
  if (
    accounts.some(
      (account) => account.averageViews.trim() || account.engagementRate.trim(),
    )
  ) {
    score += 5;
  }

  if (form.preferredAdCategories.length > 0) score += 10;
  else missing.push("مجالات التعاون");

  if (form.contentStylePreference.length > 0) score += 10;
  else missing.push("أنواع المحتوى");

  if (form.hasMawthooq === "no") {
    score += 10;
  } else if (form.hasMawthooq === "yes") {
    score += 5;
    if (form.mawthooqNumber.trim()) score += 5;
    else missing.push("رقم موثوق");
  } else {
    missing.push("حالة موثوق");
  }

  return {
    score: Math.min(score, 100),
    missing: [...new Set(missing)],
  };
}

function completionLabel(score: number) {
  if (score === 100) return "ملف مكتمل";
  if (score >= 80) return "جاهز للتعاون";
  if (score >= 50) return "ملف جيد";
  return "الملف يحتاج استكمال";
}

export default function Home() {
  const [form, setForm] = useState<InfluencerForm>(emptyInfluencerForm);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountForm, setAccountForm] =
    useState<SocialAccount>(emptySocialAccount);
  const [editingAccountIndex, setEditingAccountIndex] = useState<number | null>(
    null,
  );
  const [showAdvancedSocial, setShowAdvancedSocial] = useState(false);
  const [showExtraProfile, setShowExtraProfile] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");
  const [checkTone, setCheckTone] = useState<
    "info" | "success" | "warning" | "error"
  >("info");
  const [accountExists, setAccountExists] = useState(false);
  const [portalAccessRequested, setPortalAccessRequested] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [savedCompletion, setSavedCompletion] = useState(0);
  const [website, setWebsite] = useState("");

  const lastCheckedMobileRef = useRef("");
  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupSequenceRef = useRef(0);

  const completion = useMemo(
    () => completionDetails(form, accounts),
    [form, accounts],
  );

  function updateFormField<K extends keyof InfluencerForm>(
    field: K,
    value: InfluencerForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAccountField<K extends keyof SocialAccount>(
    field: K,
    value: SocialAccount[K],
  ) {
    setAccountForm((current) => ({ ...current, [field]: value }));
  }

  function togglePreference(
    field: "preferredAdCategories" | "contentStylePreference",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  }

  function normalizeDraft(account: SocialAccount): SocialAccount {
    return {
      ...account,
      username: account.username.trim().replace(/^@/, ""),
      profileUrl: account.profileUrl.trim(),
      followersCount: account.followersCount.replace(/[\s,]/g, ""),
    };
  }

  function applyAccountDraft(showAlert = true): SocialAccount[] | null {
    if (!hasDraft(accountForm)) return accounts;

    if (!accountForm.platform || !accountForm.username.trim()) {
      if (showAlert) alert("اختاري المنصة وأدخلي اسم المستخدم.");
      return null;
    }

    const draft = normalizeDraft(accountForm);
    const duplicate = accounts.some(
      (account, index) =>
        index !== editingAccountIndex &&
        account.platform.toLowerCase() === draft.platform.toLowerCase() &&
        account.username.toLowerCase() === draft.username.toLowerCase(),
    );

    if (duplicate) {
      if (showAlert) alert("هذا الحساب مضاف مسبقًا.");
      return null;
    }

    if (editingAccountIndex !== null) {
      return accounts.map((account, index) =>
        index === editingAccountIndex ? draft : account,
      );
    }

    return [...accounts, draft];
  }

  function saveSocialDraft() {
    const next = applyAccountDraft();
    if (!next) return;
    setAccounts(next);
    setAccountForm({ ...emptySocialAccount });
    setEditingAccountIndex(null);
    setShowAdvancedSocial(false);
  }

  function editSocialAccount(index: number) {
    setAccountForm({ ...accounts[index] });
    setEditingAccountIndex(index);
    setShowAdvancedSocial(
      Boolean(
        accounts[index].averageViews ||
          accounts[index].averageLikes ||
          accounts[index].engagementRate ||
          accounts[index].femaleAudience ||
          accounts[index].maleAudience,
      ),
    );
    document
      .getElementById("social-account-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelSocialEdit() {
    setAccountForm({ ...emptySocialAccount });
    setEditingAccountIndex(null);
    setShowAdvancedSocial(false);
  }

  function removeSocialAccount(index: number) {
    setAccounts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (editingAccountIndex === index) cancelSocialEdit();
  }

  function resetProfileForMobile(mobile: string) {
    setForm({ ...emptyInfluencerForm, mobile });
    setAccounts([]);
    setAccountForm({ ...emptySocialAccount });
    setEditingAccountIndex(null);
    setPortalAccessRequested(false);
  }

  async function checkInfluencerByMobile(
    mobileValue: string,
    signal: AbortSignal,
    sequence: number,
  ) {
    const cleanMobile = mobileValue.trim();

    try {
      setIsChecking(true);
      setCheckMessage("");
      setCheckTone("info");
      setAccountExists(false);

      const response = await fetch("/api/check-influencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: cleanMobile }),
        signal,
      });

      const result = (await response.json()) as LookupResult;
      if (sequence !== lookupSequenceRef.current) return;

      if (!response.ok) {
        setCheckTone("error");
        setCheckMessage(result.message || "حدث خطأ أثناء البحث عن البيانات.");
        return;
      }

      if (result.hasAccount) {
        resetProfileForMobile(cleanMobile);
        setAccountExists(true);
        setCheckTone("warning");
        setCheckMessage(
          "رقم الجوال مرتبط بحساب بوابة مفعل. يلزم تسجيل الدخول لتحديث الملف.",
        );
        return;
      }

      if (result.matchSource === "multiple") {
        resetProfileForMobile(cleanMobile);
        setCheckTone("warning");
        setCheckMessage(
          "وجدنا أكثر من سجل مرتبط بهذا الرقم. يرجى التواصل مع الإدارة للمراجعة.",
        );
        return;
      }

      if (!result.exists) {
        resetProfileForMobile(cleanMobile);
        setCheckTone("info");
        setCheckMessage(
          "لم نجد ملفًا سابقًا. أكملي البيانات لإنشاء ملف مؤثر جديد.",
        );
        return;
      }

      const prefill = result.influencer ?? {};
      setForm({
        ...emptyInfluencerForm,
        fullName: prefill.fullName || "",
        mobile: cleanMobile,
        email: prefill.email || "",
        city: prefill.city || "",
        country: prefill.country || "Saudi Arabia",
        gender: prefill.gender || "",
        hasMawthooq: prefill.hasMawthooq || "",
        mawthooqNumber: prefill.mawthooqNumber || "",
        mawthooqExpiryDate: prefill.mawthooqExpiryDate || "",
        preferredAdCategories: Array.isArray(prefill.preferredAdCategories)
          ? prefill.preferredAdCategories
          : [],
        contentStylePreference: Array.isArray(prefill.contentStylePreference)
          ? prefill.contentStylePreference
          : [],
      });

      setAccounts(
        Array.isArray(result.socialAccounts) ? result.socialAccounts : [],
      );
      setAccountForm({ ...emptySocialAccount });
      setEditingAccountIndex(null);
      setPortalAccessRequested(Boolean(result.portalAccessRequested));
      setCheckTone("success");
      setCheckMessage(
        result.matchSource === "archive"
          ? "تم استرجاع بياناتك من الأرشيف. راجعيها وأكملي الناقص."
          : "تم استرجاع ملفك الحالي وتفضيلاتك وحسابات التواصل.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
      if (sequence === lookupSequenceRef.current) {
        setCheckTone("error");
        setCheckMessage("حدث خطأ غير متوقع أثناء البحث.");
      }
    } finally {
      if (sequence === lookupSequenceRef.current) setIsChecking(false);
    }
  }

  useEffect(() => {
    const digits = form.mobile.replace(/\D/g, "");
    const ready =
      (digits.startsWith("05") && digits.length === 10) ||
      (digits.startsWith("9665") && digits.length === 12) ||
      (digits.startsWith("5") && digits.length === 9);

    if (!ready) {
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
      lastCheckedMobileRef.current = "";
      setIsChecking(false);
      setCheckMessage("");
      setAccountExists(false);
      return;
    }

    if (digits === lastCheckedMobileRef.current) return;

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    const sequence = ++lookupSequenceRef.current;
    lastCheckedMobileRef.current = digits;

    void checkInfluencerByMobile(form.mobile, controller.signal, sequence);

    return () => controller.abort();
  }, [form.mobile]);

  async function submitForm() {
    if (
      !form.fullName.trim() ||
      !form.mobile.trim() ||
      !form.city.trim() ||
      !form.country.trim() ||
      !form.gender ||
      !form.hasMawthooq
    ) {
      alert("أكملي الاسم والجوال والمدينة والجنس وحالة موثوق.");
      return;
    }

    if (form.hasMawthooq === "yes" && !form.mawthooqNumber.trim()) {
      alert("أدخلي رقم موثوق.");
      return;
    }

    if (form.preferredAdCategories.length === 0) {
      alert("اختاري مجال تعاون واحدًا على الأقل.");
      return;
    }

    if (form.contentStylePreference.length === 0) {
      alert("اختاري نوع محتوى واحدًا على الأقل.");
      return;
    }

    if (accountExists) {
      alert("هذا الملف مرتبط بحساب بوابة. استخدمي تسجيل الدخول.");
      return;
    }

    const accountsToSubmit = applyAccountDraft();
    if (!accountsToSubmit || accountsToSubmit.length === 0) {
      if (accountsToSubmit?.length === 0) alert("أضيفي حساب تواصل واحدًا على الأقل.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/submit-influencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer: form,
          socialAccounts: accountsToSubmit,
          website,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.message || "حدث خطأ أثناء حفظ البيانات.");
        return;
      }

      setAccounts(accountsToSubmit);
      setAccountForm({ ...emptySocialAccount });
      setEditingAccountIndex(null);
      setSavedCompletion(Number(result.profileCompletion ?? completion.score));
      setRegistrationMessage(result.message || "تم حفظ وتحديث بياناتك بنجاح.");
      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ غير متوقع أثناء الحفظ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progressColor =
    completion.score >= 80
      ? "from-emerald-400 to-emerald-500"
      : completion.score >= 50
        ? "from-[#6877d8] to-[#8c99e8]"
        : "from-[#f0b74a] to-[#f6cd71]";

  const inputClass =
    "h-14 w-full rounded-2xl border border-[#D8DDF7] bg-white px-4 text-sm font-bold text-[#33447F] outline-none transition placeholder:text-[#A4ABC3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:shadow-[0_0_0_4px_rgba(104,119,200,0.11)]";

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_14%,rgba(216,221,247,0.78),transparent_29%),radial-gradient(circle_at_92%_82%,rgba(169,185,230,0.35),transparent_27%),linear-gradient(135deg,#FDFDFF_0%,#F7F8FC_48%,#F1F3FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#314176]"
    >
      <DecorativeBackground />

      <header className="relative z-20 border-b border-white/80 bg-white/74 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(82,99,185,0.24)] transition hover:-translate-y-0.5"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/portal-access"
              className="hidden rounded-2xl border border-[#D8DDF7] bg-white/85 px-5 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF] sm:inline-flex"
            >
              تفعيل بوابة المؤثر
            </Link>
          </div>

          <div className="inline-flex rounded-full border border-[#D8DDF7] bg-white/88 p-1 shadow-[0_8px_22px_rgba(104,119,200,0.08)]">
            <button
              type="button"
              className="rounded-full bg-[#6877C8] px-5 py-2 text-xs font-black text-white shadow-[0_7px_18px_rgba(104,119,200,0.25)]"
              aria-current="true"
            >
              العربية
            </button>
            <button
              type="button"
              disabled
              title="سيتم تفعيل اللغة الإنجليزية لاحقًا"
              className="cursor-not-allowed rounded-full px-5 py-2 text-xs font-bold text-[#929AB8] opacity-70"
            >
              English
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-8">
        <section className="order-2 min-w-0 lg:order-1">
          <div className="overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/82 shadow-[0_32px_90px_rgba(71,86,153,0.14)] backdrop-blur-2xl">
            <div className="border-b border-[#E8EBF8] bg-white/72 px-5 py-6 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7180D2,#5667BD)] text-xl font-black text-white shadow-[0_14px_28px_rgba(86,103,189,0.24)]">
                    03
                  </span>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#33447F] sm:text-3xl">
                      الملف الشخصي للمؤثر
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-7 text-[#7E87A7]">
                      أدخلي رقم الجوال لاسترجاع بياناتك، ثم راجعي وعدّلي المعلومات قبل الحفظ.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:min-w-[460px]">
                  <StepPill number="01" label="البيانات" active />
                  <StepPill number="02" label="موثوق" active={Boolean(form.hasMawthooq)} />
                  <StepPill number="03" label="الحسابات" active={accounts.length > 0} />
                  <StepPill
                    number="04"
                    label="التفضيلات"
                    active={
                      form.preferredAdCategories.length > 0 &&
                      form.contentStylePreference.length > 0
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5 sm:p-8 lg:p-10">
              <SectionCard
                id="personal-information"
                number="01"
                title="معلوماتك الشخصية"
                description="البيانات الأساسية المستخدمة في البحث والتواصل وإدارة الحملات."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="رقم الجوال" hint="يبدأ البحث تلقائيًا بعد آخر رقم">
                    <div className="relative">
                      <input
                        className={`${inputClass} pl-24`}
                        inputMode="tel"
                        dir="ltr"
                        placeholder="05XXXXXXXX"
                        maxLength={13}
                        value={form.mobile}
                        onChange={(event) =>
                          updateFormField(
                            "mobile",
                            event.target.value.replace(/[^0-9+]/g, "").slice(0, 13),
                          )
                        }
                      />
                      {isChecking && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#6877C8]">
                          جاري البحث...
                        </span>
                      )}
                    </div>
                    {checkMessage && (
                      <div
                        className={`mt-2 rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${
                          checkTone === "success"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : checkTone === "warning"
                              ? "border border-amber-200 bg-amber-50 text-amber-800"
                              : checkTone === "error"
                                ? "border border-red-200 bg-red-50 text-red-700"
                                : "border border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        {checkMessage}
                        {accountExists && (
                          <Link href="/login" className="mr-2 font-black underline">
                            تسجيل الدخول
                          </Link>
                        )}
                      </div>
                    )}
                  </Field>

                  <Field label="الاسم الكامل">
                    <input
                      className={inputClass}
                      value={form.fullName}
                      onChange={(event) => updateFormField("fullName", event.target.value)}
                      placeholder="الاسم الكامل"
                    />
                  </Field>

                  <Field label="البريد الإلكتروني" hint="اختياري">
                    <input
                      className={inputClass}
                      type="email"
                      dir="ltr"
                      value={form.email}
                      onChange={(event) => updateFormField("email", event.target.value)}
                      placeholder="example@email.com"
                    />
                  </Field>

                  <Field label="الدولة">
                    <select
                      className={inputClass}
                      value={form.country}
                      onChange={(event) => {
                        updateFormField("country", event.target.value);
                        updateFormField("city", "");
                      }}
                    >
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {countryLabel(country)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="المدينة">
                    <input
                      className={inputClass}
                      list="city-options"
                      value={form.city}
                      onChange={(event) => updateFormField("city", event.target.value)}
                      placeholder="الرياض"
                    />
                    <datalist id="city-options">
                      {(citiesByCountry[form.country] || []).map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </Field>

                  <Field label="الجنس">
                    <div className="grid grid-cols-2 gap-3">
                      <ChoiceButton
                        selected={form.gender === "female"}
                        onClick={() => updateFormField("gender", "female")}
                      >
                        أنثى
                      </ChoiceButton>
                      <ChoiceButton
                        selected={form.gender === "male"}
                        onClick={() => updateFormField("gender", "male")}
                      >
                        ذكر
                      </ChoiceButton>
                    </div>
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                id="mawthooq-information"
                number="02"
                title="بيانات موثوق"
                description="حددي حالة موثوق، وستظهر الحقول اللازمة فقط عند اختيار نعم."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceButton
                    selected={form.hasMawthooq === "yes"}
                    onClick={() => updateFormField("hasMawthooq", "yes")}
                  >
                    لدي ترخيص موثوق
                  </ChoiceButton>
                  <ChoiceButton
                    selected={form.hasMawthooq === "no"}
                    onClick={() => updateFormField("hasMawthooq", "no")}
                  >
                    لا أملك ترخيص موثوق
                  </ChoiceButton>
                </div>

                {form.hasMawthooq === "yes" && (
                  <div className="mt-5 grid gap-4 border-t border-[#ECEEF8] pt-5 md:grid-cols-2">
                    <Field label="رقم موثوق">
                      <input
                        className={inputClass}
                        dir="ltr"
                        value={form.mawthooqNumber}
                        onChange={(event) =>
                          updateFormField("mawthooqNumber", event.target.value)
                        }
                        placeholder="رقم الترخيص"
                      />
                    </Field>
                    <Field label="تاريخ انتهاء موثوق" hint="اختياري">
                      <input
                        className={inputClass}
                        type="date"
                        value={form.mawthooqExpiryDate}
                        onChange={(event) =>
                          updateFormField("mawthooqExpiryDate", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                )}

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#E2E6F8] bg-[#F8F9FE] px-4 py-3 text-sm font-medium leading-7 text-[#737D9E]">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8ECFF] font-black text-[#6575C9]">
                    i
                  </span>
                  بيانات الهوية والبنك تبقى محفوظة في قاعدة البيانات، ولا تُطلب في هذه الصفحة العامة. يتم استكمالها داخل البوابة المؤمنة عند وجود مستحقات مالية.
                </div>
              </SectionCard>

              <SectionCard
                id="social-accounts"
                number="03"
                title="حسابات التواصل الاجتماعي"
                description="أضيفي المنصة واسم المستخدم أولًا، والإحصائيات المتقدمة اختيارية."
              >
                {accounts.length > 0 && (
                  <div className="mb-5 overflow-hidden rounded-2xl border border-[#E4E8F7] bg-white">
                    <div className="hidden grid-cols-[1fr_1.4fr_0.9fr_0.9fr_auto] gap-3 bg-[#F6F7FD] px-4 py-3 text-xs font-black text-[#7882A1] md:grid">
                      <span>المنصة</span>
                      <span>اسم المستخدم</span>
                      <span>المتابعون</span>
                      <span>التفاعل</span>
                      <span>الإجراء</span>
                    </div>
                    <div className="divide-y divide-[#EEF0F8]">
                      {accounts.map((account, index) => (
                        <article
                          key={`${account.platform}-${account.username}-${index}`}
                          className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1.4fr_0.9fr_0.9fr_auto] md:items-center"
                        >
                          <span className="inline-flex w-fit rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#5D70C9]">
                            {platformLabel(account.platform)}
                          </span>
                          <strong className="text-sm text-[#33447F]" dir="ltr">
                            @{account.username}
                          </strong>
                          <span className="text-sm font-bold text-[#6E7898]">
                            {account.followersCount || "—"}
                          </span>
                          <span className="text-sm font-bold text-[#6E7898]">
                            {account.engagementRate
                              ? `${account.engagementRate}%`
                              : "—"}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => editSocialAccount(index)}
                              className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#5E70C8]"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSocialAccount(index)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                            >
                              حذف
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  id="social-account-editor"
                  className="rounded-[1.5rem] border border-[#E1E5F6] bg-[#F9FAFE] p-4 sm:p-5"
                >
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-[#34457E]">
                        {editingAccountIndex !== null ? "تعديل الحساب" : "إضافة حساب"}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-[#8A92AD]">
                        المنصة واسم المستخدم هما الحقلان الأساسيان فقط.
                      </p>
                    </div>
                    {editingAccountIndex !== null && (
                      <button
                        type="button"
                        onClick={cancelSocialEdit}
                        className="text-sm font-black text-[#7D86A4]"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="المنصة">
                      <select
                        className={inputClass}
                        value={accountForm.platform}
                        onChange={(event) =>
                          updateAccountField("platform", event.target.value)
                        }
                      >
                        <option value="">اختاري المنصة</option>
                        {platformOptions.map((platform) => (
                          <option key={platform} value={platform}>
                            {platformLabel(platform)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="اسم المستخدم">
                      <input
                        className={inputClass}
                        dir="ltr"
                        value={accountForm.username}
                        onChange={(event) =>
                          updateAccountField("username", event.target.value)
                        }
                        placeholder="username"
                      />
                    </Field>

                    <Field label="عدد المتابعين" hint="اختياري">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        dir="ltr"
                        value={accountForm.followersCount}
                        onChange={(event) =>
                          updateAccountField("followersCount", event.target.value)
                        }
                        placeholder="125000"
                      />
                    </Field>

                    <Field label="رابط الحساب" hint="اختياري">
                      <input
                        className={inputClass}
                        dir="ltr"
                        value={accountForm.profileUrl}
                        onChange={(event) =>
                          updateAccountField("profileUrl", event.target.value)
                        }
                        placeholder="https://..."
                      />
                    </Field>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E8F5] pt-5">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSocial((current) => !current)}
                      className="text-sm font-black text-[#6072C8]"
                    >
                      {showAdvancedSocial
                        ? "إخفاء الإحصائيات المتقدمة"
                        : "+ إضافة إحصائيات متقدمة اختيارية"}
                    </button>

                    <button
                      type="button"
                      onClick={saveSocialDraft}
                      className="rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-6 py-3.5 text-sm font-black text-white shadow-[0_13px_26px_rgba(82,99,185,0.22)] transition hover:-translate-y-0.5"
                    >
                      {editingAccountIndex !== null
                        ? "حفظ تعديل الحساب"
                        : "إضافة الحساب"}
                    </button>
                  </div>

                  {showAdvancedSocial && (
                    <div className="mt-5 grid gap-4 border-t border-[#E5E8F5] pt-5 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="متوسط المشاهدات">
                        <input
                          className={inputClass}
                          value={accountForm.averageViews}
                          onChange={(event) =>
                            updateAccountField("averageViews", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="متوسط الإعجابات">
                        <input
                          className={inputClass}
                          value={accountForm.averageLikes}
                          onChange={(event) =>
                            updateAccountField("averageLikes", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="متوسط التعليقات">
                        <input
                          className={inputClass}
                          value={accountForm.averageComments}
                          onChange={(event) =>
                            updateAccountField("averageComments", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="معدل التفاعل %">
                        <input
                          className={inputClass}
                          value={accountForm.engagementRate}
                          onChange={(event) =>
                            updateAccountField("engagementRate", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="نسبة النساء %">
                        <input
                          className={inputClass}
                          value={accountForm.femaleAudience}
                          onChange={(event) =>
                            updateAccountField("femaleAudience", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="نسبة الرجال %">
                        <input
                          className={inputClass}
                          value={accountForm.maleAudience}
                          onChange={(event) =>
                            updateAccountField("maleAudience", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="مدينة الجمهور">
                        <input
                          className={inputClass}
                          value={accountForm.audienceMainCity}
                          onChange={(event) =>
                            updateAccountField("audienceMainCity", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="دولة الجمهور">
                        <input
                          className={inputClass}
                          value={accountForm.audienceMainCountry}
                          onChange={(event) =>
                            updateAccountField("audienceMainCountry", event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                id="collaboration-preferences"
                number="04"
                title="تفضيلات المحتوى والتعاون"
                description="اختاري المجالات وأنواع المحتوى المناسبة لك."
              >
                <PreferenceGroup
                  title="مجالات الإعلان المناسبة لك"
                  options={preferredAdCategoryOptions}
                  selected={form.preferredAdCategories}
                  onToggle={(value) =>
                    togglePreference("preferredAdCategories", value)
                  }
                />

                <div className="my-6 h-px bg-[#ECEEF8]" />

                <PreferenceGroup
                  title="أنواع المحتوى التي تفضلينها"
                  options={contentStyleOptions}
                  selected={form.contentStylePreference}
                  onToggle={(value) =>
                    togglePreference("contentStylePreference", value)
                  }
                />
              </SectionCard>

              <input
                type="text"
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                className="hidden"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />

              <section className="rounded-[1.75rem] border border-[#DDE2F6] bg-[linear-gradient(135deg,#F7F8FE,#FFFFFF)] p-5 sm:p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-[#6877C8]">
                      اكتمال الملف الحالي: {completion.score}%
                    </p>
                    <h2 className="mt-1 text-xl font-black text-[#33447F]">
                      راجعي بياناتك ثم احفظي التحديث
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-[#7B84A1]">
                      يتم حفظ أي تعديل مفتوح في حسابات التواصل تلقائيًا مع الملف.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={submitForm}
                    disabled={isSubmitting || isChecking || accountExists}
                    className="min-w-64 rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-8 py-4 text-base font-black text-white shadow-[0_18px_34px_rgba(82,99,185,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isSubmitting
                      ? "جاري الحفظ..."
                      : isChecking
                        ? "جاري البحث..."
                        : accountExists
                          ? "سجلي الدخول لتحديث الملف"
                          : "حفظ وتحديث بياناتي"}
                  </button>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#E0E4F6] bg-white/85 p-5 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-[#34457E]">
                      هل تريدين متابعة الحملات والمستحقات؟
                    </p>
                    <p className="mt-2 text-sm font-medium leading-7 text-[#78819E]">
                      تحديث الملف لا يتطلب حسابًا. يتم تفعيل حساب المستخدم عند الحاجة إلى متابعة الحملات أو المستحقات المالية.
                    </p>
                    {portalAccessRequested && (
                      <p className="mt-2 text-sm font-black text-emerald-700">
                        تم إرسال طلب تفعيل سابق لهذا الملف.
                      </p>
                    )}
                  </div>
                  <Link
                    href="/portal-access"
                    className="rounded-2xl border border-[#CBD3F4] bg-[#F7F8FE] px-6 py-3.5 text-center font-black text-[#5C6FC7] transition hover:bg-[#EEF1FF]"
                  >
                    طلب تفعيل حساب مستخدم
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </section>

        <aside className="order-1 lg:order-2">
          <div className="space-y-5 lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-[2.25rem] border border-white/85 bg-white/82 shadow-[0_28px_75px_rgba(71,86,153,0.15)] backdrop-blur-2xl">
              <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#7180D2,#5566BB)] p-7">
                <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full border-[26px] border-white/10" />
                <Image
                  src="/da-logo.png"
                  alt="دار الأميرات"
                  width={180}
                  height={180}
                  className="relative z-10 h-40 w-40 object-contain drop-shadow-[0_12px_24px_rgba(39,53,111,0.2)]"
                  priority
                />
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#8B93AE]">اكتمال الملف</p>
                    <h2 className="mt-1 text-xl font-black text-[#33447F]">
                      {completionLabel(completion.score)}
                    </h2>
                  </div>
                  <div
                    className="grid h-20 w-20 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#6877C8 ${completion.score * 3.6}deg, #E7EAF8 0deg)`,
                    }}
                  >
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-black text-[#5B6CC1]">
                      {completion.score}%
                    </div>
                  </div>
                </div>

                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#EAEDF8]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-l ${progressColor} transition-all duration-500`}
                    style={{ width: `${completion.score}%` }}
                  />
                </div>

                <p className="mt-4 text-xs font-medium leading-6 text-[#7D86A3]">
                  {completion.missing.length > 0
                    ? `متبقي: ${completion.missing.slice(0, 4).join("، ")}`
                    : "جميع عناصر الملف الأساسية مكتملة."}
                </p>

                {form.hasMawthooq === "yes" && (
                  <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                    ✓ مؤثر موثوق
                  </span>
                )}
              </div>
            </section>

            <nav className="rounded-[2rem] border border-white/85 bg-white/82 p-3 shadow-[0_22px_60px_rgba(71,86,153,0.11)] backdrop-blur-2xl">
              <SidebarLink href="#personal-information" number="01" label="البيانات الشخصية" />
              <SidebarLink href="#mawthooq-information" number="02" label="حالة موثوق" />
              <SidebarLink href="#social-accounts" number="03" label="حسابات التواصل" />
              <SidebarLink href="#collaboration-preferences" number="04" label="تفضيلات التعاون" />
            </nav>
          </div>
        </aside>
      </div>

      {isChecking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26345F]/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-7 text-center shadow-[0_30px_80px_rgba(40,53,105,0.25)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#E5E8F7] border-t-[#6877C8]" />
            <h2 className="mt-5 text-xl font-black text-[#33447F]">جاري البحث عن ملفك</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-[#7D86A5]">
              نراجع قاعدة البيانات والأرشيف وحسابات التواصل السابقة.
            </p>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26345F]/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white p-7 text-center shadow-[0_34px_90px_rgba(40,53,105,0.28)] sm:p-9">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-600">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-black text-[#33447F]">تم حفظ الملف بنجاح</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-[#78819E]">
              {registrationMessage}
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-[#F5F7FE] p-4">
              <p className="text-sm font-bold text-[#7B84A3]">نسبة اكتمال الملف</p>
              <p className="mt-1 text-3xl font-black text-[#5E70C8]">{savedCompletion}%</p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="rounded-2xl border border-[#D8DDF3] px-6 py-3.5 font-black text-[#5F698B]"
              >
                إغلاق
              </button>
              <Link
                href="/portal-access"
                className="rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-6 py-3.5 font-black text-white"
              >
                أرغب بتفعيل البوابة
              </Link>
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-10 mt-4 border-t border-white/85 bg-white/65 px-4 py-7 text-center text-sm font-medium text-[#7D86A2] backdrop-blur-xl">
        © 2026 دار الأميرات — بوابة إدارة المؤثرين
      </footer>
    </main>
  );
}

function DecorativeBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-20 h-80 w-80 rounded-full border-[44px] border-white/40" />
      <div className="absolute -bottom-28 right-10 h-96 w-96 rounded-full border-[55px] border-[#D8DDF7]/24" />
      <div className="absolute left-6 top-[28%] h-36 w-16 rotate-[18deg] rounded-[100%_0_100%_0] bg-white/42" />
      <div className="absolute left-24 top-[36%] h-24 w-10 rotate-[52deg] rounded-[100%_0_100%_0] bg-[#D8DDF7]/42" />
      <div className="absolute bottom-24 right-12 h-28 w-12 -rotate-[22deg] rounded-[100%_0_100%_0] bg-white/48" />
      <span className="absolute right-[8%] top-24 h-2.5 w-2.5 rounded-full bg-[#F7D27A] shadow-[0_0_12px_rgba(247,210,122,0.7)]" />
      <span className="absolute right-[12%] top-32 h-1.5 w-1.5 rounded-full bg-[#D0AD56]" />
    </div>
  );
}

function StepPill({
  number,
  label,
  active,
}: {
  number: string;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-2 py-3 text-center transition ${
        active
          ? "border-[#C9D1F3] bg-[#F0F2FF]"
          : "border-[#E8EAF4] bg-[#FAFBFE]"
      }`}
    >
      <span
        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
          active
            ? "bg-[#6877C8] text-white shadow-[0_8px_16px_rgba(104,119,200,0.22)]"
            : "bg-[#ECEEF7] text-[#939BB3]"
        }`}
      >
        {number}
      </span>
      <span className="mt-2 block text-[11px] font-black text-[#697391]">{label}</span>
    </div>
  );
}

function SectionCard({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[1.75rem] border border-[#E3E7F6] bg-white/92 p-5 shadow-[0_14px_40px_rgba(78,92,151,0.065)] sm:p-6"
    >
      <div className="mb-6 flex items-start gap-4 border-b border-[#ECEEF8] pb-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7180D2,#5667BD)] text-sm font-black text-white shadow-[0_11px_22px_rgba(86,103,189,0.2)]">
          {number}
        </span>
        <div>
          <h2 className="text-lg font-black text-[#33447F] sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[#8991AC]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex min-h-5 flex-wrap items-center gap-2 text-sm font-black text-[#3B4B80]">
        {label}
        {hint && <small className="font-medium text-[#99A0B8]">{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-2xl border px-4 text-sm font-black transition ${
        selected
          ? "border-[#6877C8] bg-[#EEF1FF] text-[#5365BA] shadow-[0_8px_20px_rgba(83,101,186,0.10)]"
          : "border-[#DDE1F1] bg-white text-[#6E7896] hover:border-[#B7C1E9] hover:bg-[#FAFBFF]"
      }`}
    >
      {children}
    </button>
  );
}

function PreferenceGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-4 font-black text-[#3A4A80]">{title}</h3>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-4 py-2.5 text-sm font-black transition ${
                active
                  ? "border-[#6877C8] bg-[#6877C8] text-white shadow-[0_10px_22px_rgba(104,119,200,0.18)]"
                  : "border-[#DFE3F3] bg-[#FAFBFF] text-[#6C7694] hover:border-[#BAC4EA]"
              }`}
            >
              {active && <span className="ml-1">✓</span>}
              {preferenceLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  number,
  label,
}: {
  href: string;
  number: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-black text-[#53618D] transition hover:bg-[#F1F3FF] hover:text-[#5263B9]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF1FF] text-xs font-black text-[#6072C7]">
        {number}
      </span>
      {label}
    </a>
  );
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    Instagram: "إنستغرام",
    TikTok: "تيك توك",
    Snapchat: "سناب شات",
    YouTube: "يوتيوب",
    X: "إكس",
    Facebook: "فيسبوك",
    Other: "أخرى",
  };
  return labels[platform] ?? platform;
}

function countryLabel(country: string) {
  const labels: Record<string, string> = {
    "Saudi Arabia": "المملكة العربية السعودية",
    "United Arab Emirates": "الإمارات العربية المتحدة",
    Kuwait: "الكويت",
    Qatar: "قطر",
    Bahrain: "البحرين",
    Oman: "عُمان",
    Other: "أخرى",
  };
  return labels[country] ?? country;
}

function preferenceLabel(value: string) {
  const labels: Record<string, string> = {
    Beauty: "الجمال",
    Skincare: "العناية بالبشرة",
    Haircare: "العناية بالشعر",
    Perfume: "العطور",
    Fashion: "الأزياء",
    Lifestyle: "أسلوب الحياة",
    Restaurants: "المطاعم",
    Cafes: "المقاهي",
    Travel: "السفر",
    "Mother & Baby": "الأم والطفل",
    Fitness: "اللياقة",
    Technology: "التقنية",
    Home: "المنزل",
    Events: "الفعاليات",
    Other: "أخرى",
    Reels: "ريلز",
    Story: "ستوري",
    Post: "منشور",
    Snap: "سناب",
    "TikTok Video": "فيديو تيك توك",
    "YouTube Short": "يوتيوب شورت",
    Live: "بث مباشر",
    Visit: "زيارة",
    Review: "مراجعة",
    Unboxing: "فتح صندوق",
    Giveaway: "مسابقة",
    "Promo Code": "كود خصم",
  };
  return labels[value] ?? value;
}
