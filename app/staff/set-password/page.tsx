import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setStaffPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/staff/login?error=invalid_invite");

  const { data: profile } = await supabase.from("profiles").select("full_name,email,role,is_active,invitation_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role === "influencer") redirect("/staff/login?error=not_staff");
  if (!profile.is_active) redirect("/staff/login?error=account_disabled");
  if (profile.invitation_status === "active") redirect("/staff/login?activated=1");

  const messages: Record<string, string> = {
    password_short: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    password_weak: "استخدم حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا خاصًا.",
    password_mismatch: "كلمتا المرور غير متطابقتين.",
    update_failed: "تعذر حفظ كلمة المرور. افتح رابط الدعوة مرة أخرى.",
    profile_update_failed: "تم حفظ كلمة المرور، لكن تعذر تفعيل ملف الموظف. تواصل مع الإدارة.",
  };

  return (
    <main dir="inherit" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAF6FC] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif]">
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#E9D9EE] blur-3xl" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_30px_90px_rgba(71,88,160,0.18)] lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="hidden min-h-[620px] bg-[linear-gradient(150deg,#B682C5,#9566AF_60%,#754A93)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <img src="/da-logo.png" alt="دار الأميرات" className="h-28 w-32 object-contain brightness-0 invert" />
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-white/70">EMPLOYEE ACTIVATION</p>
            <h1 className="mt-3 text-4xl font-black">ابدأ تجربتك مع الفريق</h1>
            <p className="mt-5 text-base font-medium leading-8 text-white/78">أنشئ كلمة مرور آمنة، وبعد تفعيل الحساب ستنتقل إلى صفحة دخول الموظفين لتسجيل الدخول لأول مرة.</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/8 p-5 text-sm font-bold leading-7 text-white/80">دعوتك مرتبطة بصلاحياتك ودورك داخل النظام، ولن تظهر لك إلا الأقسام المسموح بها.</div>
        </aside>

        <div className="flex min-h-[620px] items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#AD7EC4,#9566AF)] shadow-[0_22px_45px_rgba(86,104,188,0.28)] ring-8 ring-[#F4ECF7]"><img src="/da-logo.png" alt="دار الأميرات" className="h-20 w-20 object-contain" /></div>
              <p className="text-sm font-extrabold text-[#A170BA]">قبول دعوة الموظف</p>
              <h2 className="mt-2 text-3xl font-black text-[#402A4B]">مرحبًا {profile.full_name}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#75677B]">أنشئ كلمة المرور الخاصة بحسابك الوظيفي<br /><span dir="ltr" className="font-bold text-[#A06DB9]">{profile.email ?? user.email}</span></p>
            </div>

            {errorCode ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{messages[errorCode] ?? "حدث خطأ غير متوقع."}</div> : null}

            <form action={setStaffPassword} className="space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-black text-[#4C4052]">كلمة المرور الجديدة</span><input name="password" type="password" minLength={8} required autoComplete="new-password" className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FEFCFF] px-4 font-bold text-[#432A57] outline-none focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10" dir="ltr" /></label>
              <label className="block"><span className="mb-2 block text-sm font-black text-[#4C4052]">تأكيد كلمة المرور</span><input name="confirm_password" type="password" minLength={8} required autoComplete="new-password" className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FEFCFF] px-4 font-bold text-[#432A57] outline-none focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10" dir="ltr" /></label>
              <div className="rounded-2xl bg-[#F8F3FA] px-4 py-3 text-xs font-semibold leading-6 text-[#727C98]">8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، ورمز خاص مثل ! أو @.</div>
              <button type="submit" className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] font-black text-white shadow-[0_16px_32px_rgba(79,96,182,0.25)] transition hover:-translate-y-0.5">تفعيل الحساب والانتقال لتسجيل الدخول</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
