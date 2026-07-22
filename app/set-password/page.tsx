import Image from "next/image";
import { setInvitedUserPassword } from "./actions";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  const messages: Record<string, string> = {
    password_short: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    password_weak: "استخدمي حرفًا كبيرًا وحرفًا صغيرًا ورقمًا واحدًا على الأقل.",
    password_mismatch: "كلمتا المرور غير متطابقتين.",
    update_failed: "تعذر حفظ كلمة المرور. افتحي رابط الدعوة مرة أخرى.",
    profile_update_failed: "تم حفظ كلمة المرور، لكن تعذر تفعيل ملف المؤثر. تواصلي مع الإدارة.",
  };

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#edf0ff,#f7f8fc_45%,#f4f5f9)] px-4 py-10"
    >
      <div className="w-full max-w-md rounded-[32px] border border-white bg-white p-7 shadow-[0_25px_70px_rgba(70,85,150,0.13)] sm:p-9">
        <div className="mb-7 text-center">
          <div className="relative mx-auto mb-4 h-20 w-28 rounded-2xl bg-[#f2f4ff]">
            <Image
              src="/da-logo.png"
              alt="دار الأميرات"
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <p className="text-sm font-bold text-[#6777ca]">دعوة بوابة المؤثر</p>
          <h1 className="mt-1 text-2xl font-black text-[#2e3f73]">
            إنشاء كلمة المرور
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#7c85a0]">
            بعد حفظ كلمة المرور سيتم تفعيل حسابك وتحويلك إلى لوحة الحملات والمستحقات.
          </p>
        </div>

        {errorCode && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-7 text-red-700">
            {messages[errorCode] ?? "حدث خطأ غير متوقع."}
          </div>
        )}

        <form action={setInvitedUserPassword} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#35467b]">
              كلمة المرور الجديدة
            </span>
            <input
              className="input-v4"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              dir="ltr"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#35467b]">
              تأكيد كلمة المرور
            </span>
            <input
              className="input-v4"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              dir="ltr"
            />
          </label>

          <p className="rounded-2xl bg-[#f6f7ff] px-4 py-3 text-xs leading-6 text-[#727c98]">
            يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف إنجليزي كبير، وحرف صغير، ورقم.
          </p>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#5f73d5] px-6 py-4 font-black text-white shadow-lg shadow-[#5f73d5]/20 transition hover:bg-[#5266c5]"
          >
            تفعيل الحساب والدخول
          </button>
        </form>
      </div>
    </main>
  );
}
