import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLocale } from "@/lib/i18n/app";
import PasswordChangeForm, { type StaffPasswordCopy } from "./password-change-form";

export const dynamic = "force-dynamic";

const copyByLocale: Record<"ar" | "en", {
  eyebrow: string;
  title: string;
  description: (name: string) => string;
  passwordWeak: string;
  passwordMismatch: string;
  updateFailed: string;
  metadataFailed: string;
  unexpected: string;
  form: StaffPasswordCopy;
}> = {
  ar: {
    eyebrow: "خطوة أخيرة لحماية حسابك",
    title: "أنشئ كلمة مرورك الجديدة",
    description: (name) => `مرحبًا ${name}. تم قبول كلمة المرور المؤقتة. اختر الآن كلمة مرور سهلة التذكر لك وآمنة للحساب، وبعد الحفظ ستدخل للنظام مباشرة.`,
    passwordWeak: "استخدم 10 أحرف على الأقل، مع حرف واحد ورقم واحد على الأقل.",
    passwordMismatch: "تأكيد كلمة المرور غير مطابق.",
    updateFailed: "تعذر تحديث كلمة المرور. أعد المحاولة.",
    metadataFailed: "تم تحديث كلمة المرور لكن تعذر إكمال تفعيل الحساب. تواصل مع مدير النظام.",
    unexpected: "حدث خطأ غير متوقع.",
    form: {
      newPassword: "كلمة المرور الجديدة",
      confirmPassword: "تأكيد كلمة المرور",
      showPassword: "إظهار كلمة المرور",
      hidePassword: "إخفاء كلمة المرور",
      requirementLength: "10 أحرف على الأقل",
      requirementLetter: "حرف واحد على الأقل",
      requirementNumber: "رقم واحد على الأقل",
      mismatch: "كلمتا المرور غير متطابقتين.",
      saveAndContinue: "حفظ والدخول للنظام",
      saving: "جاري الحفظ...",
    },
  },
  en: {
    eyebrow: "One last step to secure your account",
    title: "Create your new password",
    description: (name) => `Welcome ${name}. Your temporary password was accepted. Choose a memorable, secure password now and you will continue straight to the dashboard.`,
    passwordWeak: "Use at least 10 characters with at least one letter and one number.",
    passwordMismatch: "The password confirmation does not match.",
    updateFailed: "We could not update your password. Please try again.",
    metadataFailed: "Your password was updated, but account activation could not be completed. Contact your administrator.",
    unexpected: "An unexpected error occurred.",
    form: {
      newPassword: "New password",
      confirmPassword: "Confirm password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      requirementLength: "At least 10 characters",
      requirementLetter: "At least one letter",
      requirementNumber: "At least one number",
      mismatch: "The passwords do not match.",
      saveAndContinue: "Save & open dashboard",
      saving: "Saving...",
    },
  },
};

export default async function StaffChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const copy = copyByLocale[locale];
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

  const messages: Record<string, string> = {
    password_weak: copy.passwordWeak,
    password_mismatch: copy.passwordMismatch,
    update_failed: copy.updateFailed,
    metadata_failed: copy.metadataFailed,
  };

  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FBF7FD] px-4 py-8 sm:py-10"
    >
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#EAD9F0] blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-[#F3E9F7] blur-3xl" />

      <section className="relative w-full max-w-xl rounded-[28px] border border-[#EAD9F0] bg-white p-5 shadow-[0_30px_90px_rgba(63,34,85,0.14)] sm:rounded-[32px] sm:p-10">
        <div className="text-center">
          <img src="/da-logo.png" alt="Dar Al Amirat" className="mx-auto h-20 w-24 object-contain sm:h-24 sm:w-28" />
          <p className="mt-4 text-sm font-extrabold text-[#9566AF]">{copy.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-[#3F2255] sm:text-3xl">{copy.title}</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-[#806B89]">{copy.description(profile.full_name)}</p>
        </div>

        {errorCode ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-7 text-rose-700">
            {messages[errorCode] ?? copy.unexpected}
          </div>
        ) : null}

        <PasswordChangeForm copy={copy.form} />
      </section>
    </main>
  );
}
