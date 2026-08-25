import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changeForcedStaffPassword } from "./actions";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  password_weak: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل وتحتوي حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.",
  password_mismatch: "تأكيد كلمة المرور الجديدة غير مطابق.",
  update_failed: "تعذر تحديث كلمة المرور. أعد المحاولة.",
  metadata_failed: "تم تحديث كلمة المرور لكن تعذر إنهاء خطوة التفعيل. تواصل مع مدير النظام.",
};

export default async function StaffChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/staff/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role === "influencer") redirect("/staff/login?error=not_staff");
  if (!profile.is_active) redirect("/staff/login?error=account_disabled");
  if (user.app_metadata?.must_change_password !== true) redirect("/dashboard");

  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FBF7FD] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif]">
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#EAD9F0] blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-[#F3E9F7] blur-3xl" />

      <section className="relative w-full max-w-xl rounded-[32px] border border-[#EAD9F0] bg-white p-6 shadow-[0_30px_90px_rgba(63,34,85,0.14)] sm:p-10">
        <div className="text-center">
          <img src="/da-logo.png" alt="دار الأميرات" className="mx-auto h-24 w-28 object-contain" />
          <p className="mt-4 text-sm font-extrabold text-[#9566AF]">حماية الحساب الوظيفي</p>
          <h1 className="mt-2 text-3xl font-black text-[#3F2255]">غيّر كلمة المرور قبل المتابعة</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-[#806B89]">
            مرحبًا {profile.full_name}. تم التحقق من كلمة المرور المؤقتة عند تسجيل الدخول. أنشئ الآن كلمة مرور خاصة بك لفتح بقية النظام.
          </p>
        </div>

        {errorCode ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-7 text-rose-700">
            {messages[errorCode] ?? "حدث خطأ غير متوقع."}
          </div>
        ) : null}

        <form action={changeForcedStaffPassword} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#5A3473]">كلمة المرور الجديدة</span>
            <input name="new_password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="h-14 w-full rounded-2xl border border-[#E6D7EC] bg-[#FEFCFF] px-4 font-bold text-[#432A57] outline-none transition focus:border-[#9566AF] focus:ring-4 focus:ring-[#9566AF]/10" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#5A3473]">تأكيد كلمة المرور الجديدة</span>
            <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="h-14 w-full rounded-2xl border border-[#E6D7EC] bg-[#FEFCFF] px-4 font-bold text-[#432A57] outline-none transition focus:border-[#9566AF] focus:ring-4 focus:ring-[#9566AF]/10" />
          </label>

          <div className="rounded-2xl bg-[#F3E9F7] px-4 py-3 text-xs font-bold leading-6 text-[#6F547A]">
            استخدم 8 أحرف على الأقل، وحرفًا كبيرًا وصغيرًا ورقمًا ورمزًا خاصًا. بعد الحفظ سيفتح لك النظام مباشرة.
          </div>

          <button type="submit" className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#AD79C5,#754A93)] text-base font-black text-white shadow-[0_16px_32px_rgba(117,74,147,0.24)] transition hover:-translate-y-0.5">
            تحديث كلمة المرور وفتح النظام
          </button>
        </form>
      </section>
    </main>
  );
}
