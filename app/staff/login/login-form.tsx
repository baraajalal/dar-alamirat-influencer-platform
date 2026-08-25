"use client";

import { useState } from "react";
import Link from "next/link";
import { staffLogin } from "./actions";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M4 6h16v12H4zM4 7l8 6 8-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
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
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {!open ? <path d="m4 4 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /> : null}
    </svg>
  );
}

export default function StaffLoginForm({ error, success }: { error?: string; success?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main dir="inherit" className="relative min-h-screen overflow-hidden bg-[#FAF6FC] px-4 py-8 font-['Tajawal',Tahoma,Arial,sans-serif] sm:px-8 lg:flex lg:items-center lg:justify-center">
      <div aria-hidden="true" className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-[#E9D9EE]/80 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#E9D99F]/20 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(71,88,160,0.18)] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative hidden min-h-[680px] overflow-hidden bg-[linear-gradient(150deg,#B682C5_0%,#9566AF_58%,#754A93_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="absolute -left-20 -top-20 h-64 w-64 rounded-full border border-white/15" />
          <div aria-hidden="true" className="absolute bottom-20 right-10 h-48 w-48 rounded-full bg-white/5 blur-sm" />
          <div>
            <img src="/da-logo.png" alt="دار الأميرات" className="h-28 w-32 object-contain brightness-0 invert" />
            <div className="mt-16 max-w-md">
              <p className="text-sm font-bold tracking-[0.22em] text-white/70">EMPLOYEE / ADMIN EXPERIENCE</p>
              <h1 className="mt-4 text-4xl font-black leading-tight">مرحبًا بعودتك</h1>
              <p className="mt-5 text-base font-medium leading-8 text-white/78">
                بوابة الموظفين لإدارة الحملات، المؤثرين، المحتوى، الموافقات والعمليات المالية من مكان واحد.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-bold text-white/75">
            <div className="rounded-2xl border border-white/15 bg-white/8 px-3 py-4">إدارة الحملات</div>
            <div className="rounded-2xl border border-white/15 bg-white/8 px-3 py-4">المراجعة</div>
            <div className="rounded-2xl border border-white/15 bg-white/8 px-3 py-4">التقارير</div>
          </div>
        </aside>

        <div className="flex min-h-[650px] items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#AD7EC4,#9566AF)] shadow-[0_22px_45px_rgba(86,104,188,0.28)] ring-8 ring-[#F4ECF7]">
                <img src="/da-logo.png" alt="دار الأميرات" className="h-20 w-20 object-contain" />
              </div>
              <p className="text-sm font-extrabold text-[#A170BA]">بوابة فريق دار الأميرات</p>
              <h2 className="mt-2 text-3xl font-black text-[#402A4B]">تسجيل دخول الموظف</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#75677B]">استخدم بريدك الوظيفي وكلمة المرور التي زودتك بها الإدارة.</p>
            </div>

            {success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-7 text-emerald-700">{success}</div> : null}

            {error ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-7 text-rose-700">{error}</div> : null}

            <form action={staffLogin} className="space-y-4">
              <label className="relative block">
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#A170BA]"><MailIcon /></span>
                <input name="email" type="email" required autoComplete="email" placeholder="البريد الإلكتروني" className="h-16 w-full rounded-2xl border border-[#EBDDF2] bg-[#FEFCFF] pr-12 pl-4 text-sm font-bold text-[#432A57] outline-none transition placeholder:text-[#A797AE] focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]" dir="ltr" />
              </label>

              <label className="relative block">
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#A170BA]"><LockIcon /></span>
                <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="كلمة المرور" className="h-16 w-full rounded-2xl border border-[#EBDDF2] bg-[#FEFCFF] pr-12 pl-12 text-sm font-bold text-[#432A57] outline-none transition placeholder:text-[#A797AE] focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]" dir="ltr" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#8E7898] hover:bg-[#F6F0F9]" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><EyeIcon open={showPassword} /></button>
              </label>

              <div className="flex items-center justify-between gap-4 px-1 text-sm">
                <label className="flex items-center gap-2 font-bold text-[#75677B]"><input type="checkbox" name="remember" className="h-4 w-4 rounded border-[#DBC8E2] accent-[#A170BA]" />تذكرني</label>
                <span className="font-bold text-[#94889A]">نسيت كلمة المرور؟ تواصل مع الإدارة</span>
              </div>

              <button type="submit" className="relative h-16 w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#A06DB9_0%,#84539E_100%)] px-6 text-base font-black text-white shadow-[0_18px_35px_rgba(79,96,182,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(79,96,182,0.36)] focus:outline-none focus:ring-4 focus:ring-[#D8BDE3]/55">
                تسجيل الدخول
              </button>
            </form>

            <div className="mt-7 rounded-2xl bg-[#F8F3FA] px-4 py-3 text-center text-xs font-bold leading-6 text-[#75677B]">
              هذه الصفحة مخصصة للموظفين والإدارة فقط.
              <div className="mt-2"><Link href="/login" className="font-black text-[#8B56BD] underline decoration-[#D8BDE3] underline-offset-4 hover:text-[#754A93]">الانتقال إلى دخول صُنّاع المحتوى</Link></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
