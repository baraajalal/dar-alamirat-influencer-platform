"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "./actions";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      {open ? (
        <>
          <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : (
        <path d="m3 3 18 18M10.7 6.1A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16.5 16.5 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.4 6 9.5 6c1 0 2-.2 2.9-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      )}
    </svg>
  );
}

function FloralDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#EBDDF2]/45 blur-3xl" />
      <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-[#D8BDE3]/25 blur-3xl" />
      <div className="absolute left-[-2.5rem] top-4 h-32 w-32 rounded-full border-[18px] border-white/45 shadow-[0_20px_40px_rgba(104,119,200,0.08)]" />
      <div className="absolute bottom-4 right-4 h-24 w-24 rounded-[42%_58%_55%_45%] bg-white/55 shadow-[0_18px_35px_rgba(104,119,200,0.08)]" />
      <div className="absolute right-8 top-7 h-px w-16 rotate-[25deg] bg-[#D3B15C]/55" />
      <span className="absolute right-8 top-4 h-2.5 w-2.5 rounded-full bg-[#F7D27A] shadow-[0_0_10px_rgba(247,210,122,0.65)]" />
      <span className="absolute right-20 top-8 h-1.5 w-1.5 rounded-full bg-[#D3B15C]" />
    </div>
  );
}

export default function LoginForm({ error, registered }: { error?: string; registered: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const router = useRouter();
  const isEnglish = typeof document !== "undefined" && document.documentElement.lang === "en";

  async function setLocale(locale: "ar" | "en") {
    if (switchingLocale) return;
    setSwitchingLocale(true);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error("locale_update_failed");
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.documentElement.dataset.locale = locale;
      router.refresh();
    } finally {
      setSwitchingLocale(false);
    }
  }

  return (
    <main dir="inherit" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(216,221,247,0.8),transparent_34%),radial-gradient(circle_at_86%_78%,rgba(169,185,230,0.45),transparent_28%),linear-gradient(135deg,#FFFDFF_0%,#FAF7FC_52%,#F7F0F9_100%)] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif]">
      <section className="relative w-full max-w-[500px] overflow-hidden rounded-[2.6rem] border border-white/80 bg-white/78 shadow-[0_35px_100px_rgba(67,82,155,0.18)] backdrop-blur-2xl">
        <FloralDecoration />
        <div className="relative z-10 px-6 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
          <div className="mb-5 flex justify-center" data-no-auto-translate>
            <div className="inline-flex rounded-full border border-[#EBDDF2] bg-white/85 p-1 shadow-[0_8px_24px_rgba(104,119,200,0.10)]">
              <button type="button" onClick={() => setLocale("ar")} disabled={switchingLocale} className={`rounded-full px-5 py-2 text-xs font-extrabold transition ${!isEnglish ? "bg-[#A170BA] text-white shadow-[0_8px_18px_rgba(104,119,200,0.28)]" : "text-[#8C7597] hover:bg-[#F7F0FA]"}`}>العربية</button>
              <button type="button" onClick={() => setLocale("en")} disabled={switchingLocale} className={`rounded-full px-5 py-2 text-xs font-extrabold transition ${isEnglish ? "bg-[#A170BA] text-white shadow-[0_8px_18px_rgba(104,119,200,0.28)]" : "text-[#8C7597] hover:bg-[#F7F0FA]"}`}>English</button>
            </div>
          </div>

          <div className="mx-auto mb-7 flex h-32 w-32 items-center justify-center rounded-[2rem] bg-white/88 shadow-[0_20px_45px_rgba(88,104,187,0.16)] ring-1 ring-[#E8D9EE]">
            <img src="/da-mark.png" alt="DA" className="h-24 w-24 object-contain" />
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-3xl font-black tracking-tight text-[#432A57] sm:text-[2rem]">تسجيل الدخول لصانع المحتوى</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-7 text-[#806F8A]">المنصة المتكاملة لإدارة الحملات والتعاون والفرص مع دار الأميرات</p>
          </div>

          {registered && <div className="mb-5 rounded-2xl border border-[#E2CFEA] bg-[#F8F1FA] px-4 py-3 text-sm font-bold leading-7 text-[#6F477E]">تم تفعيل حسابك بنجاح، ويمكنك تسجيل الدخول الآن.</div>}
          {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-bold leading-7 text-red-700">{error === "staff_account_use_staff_login" ? (isEnglish ? "This is a staff account. Please use the staff login page." : "هذا حساب موظف. يرجى استخدام صفحة دخول الموظفين.") : error}</div>}

          <form action={login} className="space-y-4">
            <label className="relative block">
              <span className="sr-only">البريد الإلكتروني أو رقم الجوال</span>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#A170BA]"><UserIcon /></span>
              <input name="identifier" type="text" required autoComplete="username" inputMode="email" placeholder="البريد الإلكتروني أو رقم الجوال" className="h-16 w-full rounded-2xl border border-[#EBDDF2] bg-white/78 pr-12 pl-4 text-sm font-semibold text-[#432A57] outline-none transition placeholder:text-[#A797AE] hover:border-[#D8BDE3] focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]" dir="inherit" />
            </label>

            <label className="relative block">
              <span className="sr-only">كلمة المرور</span>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#A170BA]"><LockIcon /></span>
              <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="كلمة المرور" className="h-16 w-full rounded-2xl border border-[#EBDDF2] bg-white/78 pr-12 pl-12 text-sm font-semibold text-[#432A57] outline-none transition placeholder:text-[#A797AE] hover:border-[#D8BDE3] focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]" dir="inherit" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#8E7898] transition hover:bg-[#F6F0F9] hover:text-[#7F568E]" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><EyeIcon open={showPassword} /></button>
            </label>

            <div className="flex items-center justify-between gap-4 px-1 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-bold text-[#75677B]"><input type="checkbox" name="remember" className="h-4 w-4 rounded border-[#DBC8E2] accent-[#A170BA]" />تذكرني</label>
              <button type="button" disabled aria-disabled="true" title="سيتم تفعيل استعادة كلمة المرور لاحقًا" className="cursor-not-allowed font-bold text-[#A170BA] opacity-55">نسيت كلمة المرور؟</button>
            </div>

            <button type="submit" className="relative mt-2 h-16 w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#A06DB9_0%,#84539E_100%)] px-6 text-base font-black text-white shadow-[0_18px_35px_rgba(79,96,182,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(79,96,182,0.36)] focus:outline-none focus:ring-4 focus:ring-[#D8BDE3]/55 active:translate-y-0"><span className="relative">تسجيل الدخول</span></button>
          </form>

          <div className="mt-7 space-y-3 text-center text-sm font-semibold text-[#806F8A]">
            <div>{isEnglish ? "Don't have an account?" : "ليس لديك حساب؟"} <Link href="/" className="font-black text-[#8B56BD] hover:text-[#754A93]">{isEnglish ? "Submit your profile" : "تسجيل بياناتك"}</Link></div>
            <div className="border-t border-[#EBDDF2] pt-4">
              <span>{isEnglish ? "Dar Al Amirat staff?" : "من موظفي دار الأميرات؟"} </span>
              <Link href="/staff/login" className="font-black text-[#8B56BD] underline decoration-[#D8BDE3] underline-offset-4 hover:text-[#754A93]">{isEnglish ? "Staff login" : "دخول الموظفين"}</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
