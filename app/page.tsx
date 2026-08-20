import Image from "next/image";
import Link from "next/link";

const benefits = [
  "فرص تعاون وحملات متنوعة مع دار الأميرات",
  "تجربة المنتجات ومشاركة رأيك وملاحظاتك معنا",
  "هدايا وعينات وتجارب حصرية لصُنّاع المحتوى (PR)",
  "إدارة ملفك وحساباتك وفرصك من مكان واحد",
  "متابعة الحملات والتعاونات والمستحقات بعد تفعيل حسابك",
];

const socialPlatforms = [
  { label: "YT", className: "bg-[#ff0033] text-white" },
  { label: "♪", className: "bg-black text-white" },
  { label: "IG", className: "bg-gradient-to-br from-[#ff8a45] via-[#f33f7a] to-[#7c45d6] text-white" },
  { label: "SC", className: "bg-[#ffeb3b] text-black" },
];

const footerFeatures = [
  { icon: "gift", title: "هدايا وتجارب حصرية", text: "لأعضاء مجتمعنا المميزين" },
  { icon: "megaphone", title: "حملات مستمرة", text: "مع علامات تجارية رائدة" },
  { icon: "shield", title: "منصة موثوقة وآمنة", text: "لإدارة تعاوناتك بسهولة" },
  { icon: "chart", title: "تطوير ونمو مستمر", text: "ندعم رحلتك كصانع محتوى" },
];

function CheckIcon() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8f5bc7] text-sm font-black text-white shadow-[0_6px_18px_rgba(143,91,199,.22)]">
      ✓
    </span>
  );
}

function MiniIcon({ type }: { type: string }) {
  if (type === "gift") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M8.5 7C6 7 5 5.8 5 4.5S6.1 2 7.5 2C10 2 12 7 12 7M15.5 7C18 7 19 5.8 19 4.5S17.9 2 16.5 2C14 2 12 7 12 7" />
      </svg>
    );
  }
  if (type === "megaphone") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 13V9l12-5v14L4 13Z" /><path d="M16 9c2 0 4 1.2 4 3s-2 3-4 3M7 14l1.5 6h3L10 13" />
      </svg>
    );
  }
  if (type === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2 20 5v6c0 5-3.4 8.8-8 11-4.6-2.2-8-6-8-11V5l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#fbf8ff] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#36205d]"
    >
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_8%_55%,rgba(188,145,229,.24),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(237,224,250,.92),transparent_33%),linear-gradient(135deg,#fff,#faf6ff_44%,#f4ebfc)]" />
        <div className="pointer-events-none absolute -left-28 top-60 -z-10 h-[460px] w-[460px] rounded-full border border-white/70 bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -right-32 bottom-10 -z-10 h-[420px] w-[420px] rounded-full bg-[#dbc5ee]/30 blur-3xl" />

        <header className="border-b border-[#eadff4]/75 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-12">
            <Link href="/" aria-label="الصفحة الرئيسية" className="shrink-0">
              <Image
                src="/da-mark.png"
                alt="DA - دار الأميرات"
                width={90}
                height={78}
                priority
                className="h-[58px] w-auto object-contain sm:h-[66px]"
              />
            </Link>

            <nav className="hidden items-center gap-7 text-sm font-bold text-[#655877] lg:flex">
              <a href="#home" className="relative text-[#8b56bd] after:absolute after:-bottom-3 after:right-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#9b67c9]">الرئيسية</a>
              <a href="#about" className="transition hover:text-[#8b56bd]">عن المنصة</a>
              <a href="#how" className="transition hover:text-[#8b56bd]">كيف نعمل</a>
              <a href="#opportunities" className="transition hover:text-[#8b56bd]">الفرص</a>
              <a href="#faq" className="transition hover:text-[#8b56bd]">الأسئلة الشائعة</a>
              <a href="#contact" className="transition hover:text-[#8b56bd]">تواصل معنا</a>
            </nav>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#c9a9e6] bg-white/85 px-4 py-3 text-sm font-black text-[#7b4eaa] shadow-[0_10px_25px_rgba(116,75,157,.08)] transition hover:-translate-y-0.5 hover:bg-[#fbf7ff] sm:px-6"
            >
              <span>تسجيل الدخول</span>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
              </svg>
            </Link>
          </div>
        </header>

        <section id="home" className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-9 pt-10 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-14 lg:px-12 lg:pb-12 lg:pt-12">
          <div className="order-2 lg:order-1">
            <div className="relative rounded-[34px] border border-white/90 bg-white/62 p-3 shadow-[0_30px_90px_rgba(104,68,141,.13)] backdrop-blur-xl sm:p-5">
              <div className="rounded-[28px] border border-[#eee4f7] bg-white/88 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3 text-[#7e51a8]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6effc]">♡</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6effc]">✉</span>
                </div>

                <div className="grid items-center gap-4 rounded-[24px] border border-[#efe6f7] bg-gradient-to-l from-white to-[#fdfaff] p-5 sm:grid-cols-[1fr_auto]">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f4edf9] px-3 py-1.5 text-xs font-black text-[#8256a8]">ملفك الشخصي</span>
                    <h3 className="mt-3 text-2xl font-black text-[#352052]">أكملي ملفك</h3>
                    <p className="mt-1 text-xs font-bold text-[#887b98]">اكتملي ملفك لزيادة فرص التعاون</p>
                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#eee6f5]">
                      <div className="h-full w-3/4 rounded-full bg-gradient-to-l from-[#7d4ab4] to-[#a66fd1]" />
                    </div>
                  </div>
                  <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[5px] border-white bg-[radial-gradient(circle_at_30%_28%,#f3dcff,#c69cdd_48%,#9b6abd)] shadow-[0_15px_35px_rgba(126,77,171,.18)]">
                    <span className="text-4xl font-black text-white/90">DA</span>
                    <span className="absolute -bottom-2 -left-2 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-white text-sm font-black text-[#8f5bc7] shadow-lg">75%</span>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-[#efe6f7] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-black text-[#462a68]">حساباتك الاجتماعية</h3>
                      <p className="mt-1 text-xs font-semibold text-[#978aa6]">اربط حساباتك لزيادة فرصك في الحملات</p>
                    </div>
                    <button type="button" className="rounded-full border border-[#d9c4ea] px-4 py-2 text-xs font-black text-[#8557ad]">+ إضافة حساب</button>
                  </div>
                  <div className="mt-5 flex items-center gap-3" dir="ltr">
                    {socialPlatforms.map((platform) => (
                      <span key={platform.label} className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-black shadow-sm ${platform.className}`}>
                        {platform.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div id="opportunities" className="mt-4 rounded-[24px] border border-[#efe6f7] bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-black text-[#462a68]">فرص متاحة لك</h3>
                    <span className="rounded-full bg-[#f5eefb] px-3 py-1 text-[11px] font-black text-[#8e5dbc]">جديد</span>
                  </div>
                  <div className="grid gap-4 rounded-[20px] bg-[#fcf9ff] p-4 sm:grid-cols-[112px_1fr]">
                    <div className="flex min-h-[116px] items-center justify-center rounded-[18px] bg-[linear-gradient(145deg,#f4e9fb,#d8b9eb)] p-4">
                      <div className="flex items-end gap-2">
                        <span className="h-14 w-6 rounded-t-xl bg-white/80 shadow-sm" />
                        <span className="h-20 w-9 rounded-[12px] bg-[#a46bc8]/75 shadow-sm" />
                        <span className="h-12 w-10 rounded-xl bg-white/90 shadow-sm" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-black text-[#482a69]">تجربة مجموعة العناية الجديدة</h4>
                      <p className="mt-1 text-xs font-semibold text-[#9487a4]">منتجات العناية بالبشرة · إصدار جديد</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-[#8a58b4]">
                        <span className="rounded-full bg-[#f2e8f9] px-3 py-1">PR</span>
                        <span className="rounded-full bg-[#f2e8f9] px-3 py-1">تجربة منتجات</span>
                        <span className="rounded-full bg-[#f2e8f9] px-3 py-1">هدية</span>
                      </div>
                      <button type="button" className="mt-4 w-fit rounded-full border border-[#d7c0e7] px-4 py-2 text-xs font-black text-[#8254aa]">عرض التفاصيل ←</button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid items-center gap-4 rounded-[24px] border border-[#efe6f7] bg-gradient-to-l from-[#fff] to-[#fcf8ff] p-5 sm:grid-cols-[1fr_130px]">
                  <div>
                    <p className="text-xs font-black text-[#8758ae]">دعوات المجتمع وPR</p>
                    <h4 className="mt-2 font-black text-[#482a69]">فعاليات حصرية لصُنّاع المحتوى</h4>
                    <p className="mt-1 text-xs font-semibold text-[#9588a4]">جلسات تعريفية وتجارب خاصة بأعضاء المجتمع</p>
                    <button type="button" className="mt-4 rounded-full border border-[#d8c4e8] px-4 py-2 text-xs font-black text-[#8355aa]">اكتشف المزيد</button>
                  </div>
                  <div className="h-24 rounded-[18px] bg-[radial-gradient(circle_at_50%_30%,#d9a6ed,#8c54b4_55%,#57316f)] shadow-inner" />
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 flex flex-col justify-center lg:order-2 lg:pr-3">
            <span className="w-fit rounded-full bg-[#f0e5f8] px-4 py-2 text-sm font-black text-[#8a58b4]">منصة صُنّاع المحتوى</span>
            <h1 className="mt-6 max-w-3xl text-[2.65rem] font-black leading-[1.2] tracking-[-0.02em] text-[#3e1f67] sm:text-5xl lg:text-[4.2rem]">
              اصنع، جرّب، وشاركنا رأيك
            </h1>
            <p id="about" className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[#756a82] sm:text-lg sm:leading-9">
              مجتمع دار الأميرات لصُنّاع المحتوى، حيث نشاركك منتجاتنا وتجاربنا وفرص التعاون، ونستمع لصوتك وملاحظاتك لنصنع تجارب أفضل معًا.
            </p>

            <div id="how" className="mt-8 space-y-4">
              {benefits.map((item) => (
                <div key={item} className="flex items-center gap-4 text-sm font-bold text-[#5f536b] sm:text-base">
                  <CheckIcon />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/portal-access/request"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-[#7f4bb5] to-[#a66bcf] px-7 text-base font-black text-white shadow-[0_18px_38px_rgba(126,74,181,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(126,74,181,.3)]"
              >
                انضم إلى مجتمع صُنّاع المحتوى
                <span aria-hidden>←</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-[#b98ed8] bg-white/75 px-7 text-base font-black text-[#7a4ba4] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
              >
                تسجيل الدخول
                <span aria-hidden>←</span>
              </Link>
            </div>

            <div className="mt-7 flex items-center gap-4 text-sm font-bold text-[#786c84]">
              <div className="flex -space-x-2 space-x-reverse" dir="ltr">
                {["DA", "PR", "+"].map((x) => (
                  <span key={x} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#e8d6f4] to-[#b785d1] text-[10px] font-black text-white shadow-sm">{x}</span>
                ))}
              </div>
              <div>
                <div className="font-black text-[#574461]">مجتمع من صُنّاع المحتوى</div>
                <div className="mt-0.5 text-xs font-semibold text-[#94879f]">نجرّب، نشارك، وننمو معًا</div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:px-12">
          <div className="grid overflow-hidden rounded-[28px] border border-white/90 bg-white/76 shadow-[0_18px_55px_rgba(105,72,137,.08)] backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
            {footerFeatures.map((feature, index) => (
              <div key={feature.title} className={`flex items-center gap-4 px-6 py-6 text-[#8a58b4] ${index !== footerFeatures.length - 1 ? "lg:border-l lg:border-[#eee3f6]" : ""}`}>
                <MiniIcon type={feature.icon} />
                <div>
                  <h3 className="text-sm font-black text-[#764b9d]">{feature.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#94879f]">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div id="contact" className="mt-6 flex flex-col items-center justify-between gap-3 px-2 text-center text-xs font-semibold text-[#9a8ca5] sm:flex-row sm:text-right">
            <p>منصة صُنّاع المحتوى · دار الأميرات</p>
            <Link href="/staff/login" className="transition hover:text-[#8153a9]">دخول الموظفين والإدارة</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
