"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "./actions";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      {open ? (
        <>
          <path
            d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <circle
            cx="12"
            cy="12"
            r="2.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </>
      ) : (
        <>
          <path
            d="m3 3 18 18M10.7 6.1A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16.5 16.5 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.4 6 9.5 6c1 0 2-.2 2.9-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </>
      )}
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.3 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.3-1.9V7.4H2.9A10 10 0 0 0 2 12c0 1.6.4 3.2.9 4.6l3.4-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2 10 10 0 0 0 2.9 7.4l3.4 2.7C7.1 7.7 9.4 5.9 12 5.9Z"
      />
    </svg>
  );
}

function FloralDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#D8DDF7]/45 blur-3xl" />
      <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-[#A9B9E6]/25 blur-3xl" />

      <div className="absolute left-[-2.5rem] top-4 h-32 w-32 rounded-full border-[18px] border-white/45 shadow-[0_20px_40px_rgba(104,119,200,0.08)]" />
      <div className="absolute left-6 top-2 h-20 w-10 rotate-[25deg] rounded-[100%_0_100%_0] bg-white/60" />
      <div className="absolute left-20 top-12 h-16 w-8 rotate-[60deg] rounded-[100%_0_100%_0] bg-[#D8DDF7]/55" />

      <div className="absolute bottom-4 right-4 h-24 w-24 rounded-[42%_58%_55%_45%] bg-white/55 shadow-[0_18px_35px_rgba(104,119,200,0.08)]" />
      <div className="absolute bottom-10 right-24 h-14 w-7 -rotate-[35deg] rounded-[100%_0_100%_0] bg-[#D8DDF7]/65" />
      <div className="absolute bottom-5 right-32 h-11 w-5 rotate-[20deg] rounded-[100%_0_100%_0] bg-white/70" />

      <div className="absolute right-8 top-7 h-px w-16 rotate-[25deg] bg-[#D3B15C]/55" />
      <span className="absolute right-8 top-4 h-2.5 w-2.5 rounded-full bg-[#F7D27A] shadow-[0_0_10px_rgba(247,210,122,0.65)]" />
      <span className="absolute right-20 top-8 h-1.5 w-1.5 rounded-full bg-[#D3B15C]" />
    </div>
  );
}

export default function LoginForm({
  error,
  registered,
}: {
  error?: string;
  registered: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(216,221,247,0.8),transparent_34%),radial-gradient(circle_at_86%_78%,rgba(169,185,230,0.45),transparent_28%),linear-gradient(135deg,#FDFDFF_0%,#F5F6FB_52%,#EEF1FB_100%)] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif]"
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-50">
        <div className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full border border-white/70" />
        <div className="absolute bottom-[6%] right-[10%] h-80 w-80 rounded-full border border-[#D8DDF7]/60" />
      </div>

      <section className="relative w-full max-w-[500px] overflow-hidden rounded-[2.6rem] border border-white/80 bg-white/78 shadow-[0_35px_100px_rgba(67,82,155,0.18)] backdrop-blur-2xl">
        <FloralDecoration />

        <div className="relative z-10 px-6 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
          <div className="mb-5 flex justify-center">
            <div className="inline-flex rounded-full border border-[#D8DDF7] bg-white/85 p-1 shadow-[0_8px_24px_rgba(104,119,200,0.10)]">
              <button
                type="button"
                className="rounded-full bg-[#6877C8] px-5 py-2 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(104,119,200,0.28)]"
                aria-current="true"
              >
                العربية
              </button>
              <button
                type="button"
                disabled
                title="سيتم تفعيل اللغة الإنجليزية لاحقًا"
                className="cursor-not-allowed rounded-full px-5 py-2 text-xs font-bold text-[#8C94B5] opacity-70"
              >
                English
              </button>
            </div>
          </div>

          <div className="mx-auto mb-7 flex h-36 w-36 items-center justify-center rounded-[2rem] bg-[linear-gradient(145deg,#7180D2,#5868BB)] shadow-[0_24px_48px_rgba(88,104,187,0.28)] ring-8 ring-white/55">
            <img
              src="/da-logo.png"
              alt="دار الأميرات"
              className="h-28 w-28 object-contain"
            />
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-3xl font-black tracking-tight text-[#33447F] sm:text-[2rem]">
              تسجيل الدخول للمؤثر
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-7 text-[#7D86A7]">
              المنصة المتكاملة لإدارة الحملات والتعاون مع العلامات التجارية
            </p>
          </div>

          {registered && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-bold leading-7 text-emerald-800">
              تم تفعيل حسابك بنجاح، ويمكنك تسجيل الدخول الآن.
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-bold leading-7 text-red-700">
              {error}
            </div>
          )}

          <form action={login} className="space-y-4">
            <label className="relative block">
              <span className="sr-only">البريد الإلكتروني أو رقم الجوال</span>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6877C8]">
                <UserIcon />
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="البريد الإلكتروني أو رقم الجوال"
                className="h-16 w-full rounded-2xl border border-[#D8DDF7] bg-white/78 pr-12 pl-4 text-sm font-semibold text-[#33447F] outline-none transition placeholder:text-[#A1A8C3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]"
                dir="rtl"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">كلمة المرور</span>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6877C8]">
                <LockIcon />
              </span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="كلمة المرور"
                className="h-16 w-full rounded-2xl border border-[#D8DDF7] bg-white/78 pr-12 pl-12 text-sm font-semibold text-[#33447F] outline-none transition placeholder:text-[#A1A8C3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]"
                dir="rtl"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#7884B8] transition hover:bg-[#EEF0FB] hover:text-[#5364B9]"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </label>

            <div className="flex items-center justify-between gap-4 px-1 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-bold text-[#68708F]">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-[#BBC3E8] accent-[#6877C8]"
                />
                تذكرني
              </label>

              <Link
                href="/forgot-password"
                className="font-bold text-[#6877C8] transition hover:text-[#4E5FB3]"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              className="relative mt-2 h-16 w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#6575CB_0%,#4F60B6_100%)] px-6 text-base font-black text-white shadow-[0_18px_35px_rgba(79,96,182,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(79,96,182,0.36)] focus:outline-none focus:ring-4 focus:ring-[#A9B9E6]/55 active:translate-y-0"
            >
              <span aria-hidden="true" className="absolute -left-5 -top-8 h-24 w-24 rounded-full bg-white/10" />
              <span aria-hidden="true" className="absolute bottom-[-1.2rem] right-3 h-16 w-8 rotate-45 rounded-[100%_0_100%_0] bg-white/10" />
              <span className="relative">تسجيل الدخول</span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-sm font-bold text-[#8189A8]">
            <span className="h-px flex-1 bg-gradient-to-l from-[#D6B55F]/70 to-[#D8DDF7]" />
            <span>أو</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#D6B55F]/70 to-[#D8DDF7]" />
          </div>

          <button
            type="button"
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#D8DDF7] bg-white/88 px-5 text-sm font-extrabold text-[#465078] shadow-[0_12px_26px_rgba(104,119,200,0.08)] transition hover:-translate-y-0.5 hover:border-[#A9B9E6] hover:bg-white"
          >
            <GoogleIcon />
            تسجيل الدخول عبر Google
          </button>

          <div className="mt-7 text-center text-sm font-semibold text-[#7D86A7]">
            ليس لديك حساب؟{" "}
            <Link href="/" className="font-black text-[#5B6CC1] hover:text-[#4658AD]">
              تسجيل بياناتك
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
