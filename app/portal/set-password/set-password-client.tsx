"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function passwordError(value: string) {
  if (value.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
  if (!/[a-z]/.test(value)) return "أضيفي حرفًا إنجليزيًا صغيرًا.";
  if (!/[A-Z]/.test(value)) return "أضيفي حرفًا إنجليزيًا كبيرًا.";
  if (!/[0-9]/.test(value)) return "أضيفي رقمًا واحدًا على الأقل.";
  if (!/[^A-Za-z0-9]/.test(value)) return "أضيفي رمزًا خاصًا مثل ! أو @.";
  return "";
}

export default function SetPasswordClient({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationMessage = passwordError(password);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (password !== confirmation) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        throw new Error("تعذر حفظ كلمة المرور. أعيدي تسجيل الدخول وحاولي مرة أخرى.");
      }

      const response = await fetch(
        "/api/influencer-activation/password-complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId }),
        },
      );
      const result = (await response.json()) as {
        message?: string;
        nextPath?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.message || "تعذر إكمال تفعيل حساب المؤثر.",
        );
      }

      setMessage(result.message ?? "تم تفعيل الحساب.");
      window.location.replace(result.nextPath || "/portal/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "تعذر إنشاء كلمة المرور.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#edf0ff,#f7f8fc_45%,#f4f5f9)] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif]"
    >
      <div className="w-full max-w-lg rounded-[32px] border border-white bg-white p-7 shadow-[0_25px_70px_rgba(70,85,150,0.13)] sm:p-9">
        <div className="mb-7 text-center">
          <img
            src="/da-logo.png"
            alt="دار الأميرات"
            className="mx-auto mb-4 h-24 w-24 rounded-2xl object-contain"
          />
          <p className="text-sm font-bold text-[#6777CA]">آخر خطوة للتفعيل</p>
          <h1 className="mt-1 text-2xl font-black text-[#2E3F73]">
            أنشئي كلمة مرور خاصة
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#7C85A0]">
            بعد الحفظ ستنتقلين مباشرة إلى بيانات البنك، ثم تظهر لك لوحة الحملات
            والمستحقات وملف الأعمال.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#35467B]">
              كلمة المرور الجديدة
            </span>
            <input
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              autoComplete="new-password"
              className="h-14 w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] px-4 font-bold outline-none focus:border-[#6877C8]"
              dir="ltr"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#35467B]">
              تأكيد كلمة المرور
            </span>
            <input
              value={confirmation}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmation(event.target.value)}
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              autoComplete="new-password"
              className="h-14 w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] px-4 font-bold outline-none focus:border-[#6877C8]"
              dir="ltr"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-bold text-[#697391]">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setShowPassword(event.target.checked)}
              className="h-4 w-4 accent-[#6877C8]"
            />
            إظهار كلمة المرور
          </label>

          <div className="rounded-2xl bg-[#F6F7FF] px-4 py-3 text-xs leading-6 text-[#727C98]">
            8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، ورمز خاص.
          </div>

          {message ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#6575CB,#4F60B6)] font-black text-white shadow-[0_16px_32px_rgba(79,96,182,0.25)] disabled:opacity-50"
          >
            {submitting ? "جاري التفعيل..." : "حفظ كلمة المرور والمتابعة"}
          </button>
        </form>
      </div>
    </main>
  );
}
