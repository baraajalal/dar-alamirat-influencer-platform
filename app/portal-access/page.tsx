"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M3 6.5h18v11H3v-11Zm0 .5 9 6 9-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7 3h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3c0 1.1-.9 2-2 2C10.7 19 5 13.3 5 6a3 3 0 0 1 2-3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M14 8l4 4-4 4M18 12H7m4-8H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Zm-3 9 2 2 4-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FloralDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#D8DDF7]/55 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#A9B9E6]/30 blur-3xl" />

      <div className="absolute left-[-2.5rem] top-8 h-36 w-36 rounded-full border-[20px] border-white/55 shadow-[0_20px_40px_rgba(104,119,200,0.08)]" />
      <div className="absolute left-8 top-5 h-20 w-10 rotate-[25deg] rounded-[100%_0_100%_0] bg-white/75" />
      <div className="absolute left-24 top-16 h-16 w-8 rotate-[60deg] rounded-[100%_0_100%_0] bg-[#D8DDF7]/70" />

      <div className="absolute bottom-8 right-6 h-28 w-28 rounded-[42%_58%_55%_45%] bg-white/65 shadow-[0_18px_35px_rgba(104,119,200,0.08)]" />
      <div className="absolute bottom-14 right-28 h-16 w-8 -rotate-[35deg] rounded-[100%_0_100%_0] bg-[#D8DDF7]/70" />
      <div className="absolute bottom-8 right-40 h-12 w-6 rotate-[20deg] rounded-[100%_0_100%_0] bg-white/75" />

      <div className="absolute right-12 top-8 h-px w-20 rotate-[22deg] bg-[#D3B15C]/60" />
      <span className="absolute right-12 top-5 h-3 w-3 rounded-full bg-[#F7D27A] shadow-[0_0_12px_rgba(247,210,122,0.75)]" />
      <span className="absolute right-24 top-10 h-2 w-2 rounded-full bg-[#D3B15C]" />
    </div>
  );
}

export default function PortalAccessPage() {
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  async function submitRequest() {
    if (!mobile.trim() || !email.trim()) {
      setTone("error");
      setMessage("أدخلي رقم الجوال والبريد الإلكتروني.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const response = await fetch("/api/portal-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, email, website }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTone("error");
        setMessage(result.message || "تعذر إرسال طلب التفعيل.");
        return;
      }

      setTone("success");
      setMessage(result.message);
      setMobile("");
      setEmail("");
    } catch {
      setTone("error");
      setMessage("حدث خطأ في الاتصال. حاولي مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_12%,rgba(216,221,247,0.82),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(169,185,230,0.48),transparent_30%),linear-gradient(135deg,#FDFDFF_0%,#F5F6FB_52%,#EEF1FB_100%)] px-4 py-8 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F] sm:px-6 lg:px-8"
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-45">
        <div className="absolute left-[7%] top-[10%] h-80 w-80 rounded-full border border-white/80" />
        <div className="absolute bottom-[4%] right-[8%] h-96 w-96 rounded-full border border-[#D8DDF7]/65" />
      </div>

      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.7rem] border border-white/80 bg-white/76 shadow-[0_36px_110px_rgba(67,82,155,0.17)] backdrop-blur-2xl">
        <FloralDecoration />

        <div className="relative z-10 p-5 sm:p-8 lg:p-10">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-full border border-[#D8DDF7] bg-white/90 p-1 shadow-[0_8px_24px_rgba(104,119,200,0.10)]">
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

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D8DDF7] bg-white/88 px-5 py-3 text-sm font-extrabold text-[#5B6CC1] shadow-[0_10px_26px_rgba(104,119,200,0.08)] transition hover:-translate-y-0.5 hover:border-[#A9B9E6] hover:bg-white"
            >
              العودة إلى تحديث الملف
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-stretch">
            <aside className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(150deg,#7180D2_0%,#596ABD_58%,#5060B2_100%)] p-7 text-white shadow-[0_28px_60px_rgba(88,104,187,0.28)] sm:p-9">
              <div aria-hidden="true" className="absolute inset-0">
                <div className="absolute -right-12 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-[#D8DDF7]/18 blur-2xl" />
                <div className="absolute bottom-8 right-8 h-20 w-10 rotate-45 rounded-[100%_0_100%_0] bg-white/10" />
              </div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2rem] bg-white/12 ring-8 ring-white/10 backdrop-blur">
                  <Image
                    src="/da-logo.png"
                    alt="دار الأميرات"
                    width={128}
                    height={128}
                    className="h-28 w-28 object-contain"
                    priority
                  />
                </div>

                <div className="mt-8 text-center">
                  <p className="text-xs font-bold text-white/72">بوابة المؤثر</p>
                  <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
                    دخول آمن لإدارة حملاتك ومستحقاتك
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-7 text-white/80">
                    الحساب غير مطلوب لتحديث الملف العام، ويصبح ضروريًا عند متابعة حملة أو الاطلاع على المدفوعات والمستحقات.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3 text-center text-sm font-extrabold">
                  {["الحملات", "مراجعة المحتوى", "روابط النشر", "المستحقات"].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 backdrop-blur"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8">
                  <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-7 text-white/85 backdrop-blur">
                    <span className="mt-1 text-[#F7D27A]">
                      <ShieldIcon />
                    </span>
                    <p>
                      تفاصيل الحملات والمدفوعات لا تظهر في البحث العام، ولا يمكن الوصول إليها إلا بعد تفعيل الحساب.
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="flex flex-col rounded-[2rem] border border-[#D8DDF7] bg-white/88 p-6 shadow-[0_18px_45px_rgba(104,119,200,0.09)] sm:p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FB] text-[#6877C8] shadow-[0_10px_24px_rgba(104,119,200,0.10)]">
                  <LoginIcon />
                </div>

                <p className="text-sm font-extrabold text-[#6877C8]">لدي حساب مفعل</p>
                <h2 className="mt-2 text-2xl font-black text-[#33447F]">
                  تسجيل الدخول
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-[#7D86A7]">
                  ادخلي إلى لوحة المؤثر لمتابعة الحملات، إرسال المحتوى، إضافة رابط النشر، ومراجعة حالة المستحقات.
                </p>

                <div className="mt-7 space-y-3">
                  {["متابعة الحملات النشطة", "استلام ملاحظات المراجعة", "الاطلاع على حالة الدفع"].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm font-bold text-[#5F6B98]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF0FB] text-xs text-[#6877C8]">✓</span>
                      {item}
                    </div>
                  ))}
                </div>

                <Link
                  href="/login"
                  className="relative mt-auto flex h-16 w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#6575CB_0%,#4F60B6_100%)] px-6 text-base font-black text-white shadow-[0_18px_35px_rgba(79,96,182,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(79,96,182,0.36)] focus:outline-none focus:ring-4 focus:ring-[#A9B9E6]/55"
                >
                  <span aria-hidden="true" className="absolute -left-5 -top-8 h-24 w-24 rounded-full bg-white/10" />
                  <span className="relative flex items-center gap-2">
                    تسجيل الدخول إلى البوابة
                    <LoginIcon />
                  </span>
                </Link>
              </section>

              <section className="rounded-[2rem] border border-[#D8DDF7] bg-white/88 p-6 shadow-[0_18px_45px_rgba(104,119,200,0.09)] sm:p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF5D9] text-[#D3A33C] shadow-[0_10px_24px_rgba(247,210,122,0.20)]">
                  <UserIcon />
                </div>

                <p className="text-sm font-extrabold text-[#D3A33C]">لا يوجد لدي حساب</p>
                <h2 className="mt-2 text-2xl font-black text-[#33447F]">
                  طلب تفعيل حساب مستخدم
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-[#7D86A7]">
                  يجب أن يكون ملفك محفوظًا مسبقًا. بعد مراجعة الطلب ستصلك دعوة التفعيل على البريد الإلكتروني.
                </p>

                <div className="mt-6 space-y-4">
                  <label className="relative block">
                    <span className="mb-2 block text-sm font-extrabold text-[#425184]">رقم الجوال</span>
                    <span className="pointer-events-none absolute right-4 top-[3.15rem] -translate-y-1/2 text-[#6877C8]">
                      <PhoneIcon />
                    </span>
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      value={mobile}
                      onChange={(event) => setMobile(event.target.value)}
                      placeholder="05XXXXXXXX"
                      className="h-15 w-full rounded-2xl border border-[#D8DDF7] bg-white/75 pr-12 pl-4 text-left text-sm font-semibold text-[#33447F] outline-none transition placeholder:text-[#A1A8C3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]"
                      dir="ltr"
                    />
                  </label>

                  <label className="relative block">
                    <span className="mb-2 block text-sm font-extrabold text-[#425184]">البريد الإلكتروني لاستقبال الدعوة</span>
                    <span className="pointer-events-none absolute right-4 top-[3.15rem] -translate-y-1/2 text-[#6877C8]">
                      <MailIcon />
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      className="h-15 w-full rounded-2xl border border-[#D8DDF7] bg-white/75 pr-12 pl-4 text-left text-sm font-semibold text-[#33447F] outline-none transition placeholder:text-[#A1A8C3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.12)]"
                      dir="ltr"
                    />
                  </label>

                  <input
                    type="text"
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="off"
                    className="hidden"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />

                  {message && (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${
                        tone === "success"
                          ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                          : tone === "error"
                            ? "border-red-200 bg-red-50/90 text-red-700"
                            : "border-blue-200 bg-blue-50/90 text-blue-700"
                      }`}
                      role="status"
                    >
                      {message}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={isSubmitting}
                    className="relative h-15 w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#F7D27A_0%,#E6B74C_100%)] px-6 text-base font-black text-[#4A4260] shadow-[0_16px_32px_rgba(230,183,76,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(230,183,76,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden="true" className="absolute -right-6 -top-7 h-20 w-20 rounded-full bg-white/18" />
                    <span className="relative">{isSubmitting ? "جاري إرسال الطلب..." : "إرسال طلب التفعيل"}</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
